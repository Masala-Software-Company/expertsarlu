import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MethodePaiement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CotationService } from '../cotation/cotation.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FacturationService {
  constructor(
    private prisma: PrismaService,
    private cotation: CotationService,
    private pdf: PdfService,
    private notifications: NotificationsService,
  ) {}

  private async attachPdf(
    factureId: string,
    input: {
      titre: string;
      numero: string;
      patient?: string;
      dossierNumero?: string;
      destination?: string;
      lignes: { code?: string; description: string; quantite?: number; montant: number }[];
      total: number;
      paye?: number;
      devise?: string;
      signePar?: string;
      note?: string;
      codeVerification?: string;
      emisLe?: Date;
    },
  ) {
    const existing = await this.prisma.facture.findUnique({
      where: { id: factureId },
      select: { codeVerification: true },
    });
    const code =
      (input.codeVerification && input.codeVerification.trim()) ||
      existing?.codeVerification ||
      PdfService.makeVerificationCode(`${input.numero}-${factureId}-${Date.now()}`);

    const publicBase =
      process.env.APP_PUBLIC_URL ||
      process.env.PUBLIC_API_URL ||
      'https://expertsarlu-production.up.railway.app';
    const verifyUrl = `${publicBase.replace(/\/$/, '')}/api/facturation/verifier/${code}`;

    const stored = await this.pdf.buildAndStore({
      ...input,
      codeVerification: code,
      verifyUrl,
      emisLe: input.emisLe,
    });

    return this.prisma.facture.update({
      where: { id: factureId },
      data: {
        pdfChemin: stored.chemin,
        codeVerification: stored.codeVerification,
      },
      include: {
        paiements: true,
        dossier: { select: { numero: true, patient: true } },
      },
    });
  }

  async creerDevis(dossierId: string, user: AuthUser) {
    const resume = await this.cotation.resume(dossierId);
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { patient: true },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');

    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: { type: 'DEVIS', creeLe: { gte: new Date(`${year}-01-01`) } },
    });
    const numero = `DEV-${year}-${String(count + 1).padStart(4, '0')}`;
    const signatureToken = randomUUID();

    const facture = await this.prisma.facture.create({
      data: {
        numero,
        dossierId,
        type: 'DEVIS',
        statut: 'ENVOYE',
        montantTotal: resume.total,
        genereParId: user.id,
        signatureToken,
      },
    });

    return this.attachPdf(facture.id, {
      titre: 'DEVIS',
      numero,
      patient: dossier.patient
        ? `${dossier.patient.prenom} ${dossier.patient.nom}`
        : undefined,
      dossierNumero: dossier.numero,
      destination: dossier.destination ?? undefined,
      lignes: resume.lignes.map((l, i) => ({
        code: `LN-${String(i + 1).padStart(3, '0')}`,
        description: l.description,
        quantite: 1,
        montant: Number(l.montant),
      })),
      total: Number(resume.total),
      paye: 0,
      note: `Lien de signature : /api/facturation/signer/${signatureToken}`,
    });
  }

  async enregistrerPaiement(
    factureId: string,
    data: { montant: number; methode: MethodePaiement; reference?: string },
  ) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { paiements: true },
    });
    if (!facture) throw new NotFoundException();

    const paiement = await this.prisma.paiement.create({
      data: {
        factureId,
        montant: data.montant,
        methode: data.methode,
        reference: data.reference,
        valide: true,
      },
    });

    const totalPaye =
      facture.paiements.reduce((s, p) => s + Number(p.montant), 0) +
      Number(data.montant);

    if (totalPaye >= Number(facture.montantTotal)) {
      await this.prisma.facture.update({
        where: { id: factureId },
        data: { statut: 'PAYE', dateEncaissement: new Date() },
      });
      await this.prisma.dossier.update({
        where: { id: facture.dossierId },
        data: { statut: 'FACTURE_PAYE', verrouille: true },
      });
    }

    return paiement;
  }

  /**
   * Règle bloquante caisse : pas de facture officielle PDF
   * sans paiement validé correspondant.
   */
  async genererFactureOfficielle(factureId: string, user: AuthUser) {
    const devis = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { paiements: true, dossier: { include: { patient: true } } },
    });
    if (!devis) throw new NotFoundException();

    const payeValide = devis.paiements.some((p) => p.valide);
    if (!payeValide && devis.statut !== 'PAYE') {
      throw new BadRequestException(
        'Impossible de générer une facture officielle sans paiement validé',
      );
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: { type: 'FACTURE', creeLe: { gte: new Date(`${year}-01-01`) } },
    });
    const numero = `FAC-${year}-${String(count + 1).padStart(4, '0')}`;
    const resume = await this.cotation.resume(devis.dossierId);

    const facture = await this.prisma.facture.create({
      data: {
        numero,
        dossierId: devis.dossierId,
        type: 'FACTURE',
        statut: 'PAYE',
        montantTotal: devis.montantTotal,
        dateEncaissement: new Date(),
        genereParId: user.id,
      },
    });

    return this.attachPdf(facture.id, {
      titre: 'FACTURE',
      numero,
      patient: devis.dossier.patient
        ? `${devis.dossier.patient.prenom} ${devis.dossier.patient.nom}`
        : undefined,
      dossierNumero: devis.dossier.numero,
      destination: devis.dossier.destination ?? undefined,
      lignes: resume.lignes.map((l, i) => ({
        code: `LN-${String(i + 1).padStart(3, '0')}`,
        description: l.description,
        quantite: 1,
        montant: Number(l.montant),
      })),
      total: Number(devis.montantTotal),
      paye: Number(devis.montantTotal),
      note: 'Document officiel — paiement validé',
    });
  }

  listByDossier(dossierId: string) {
    return this.prisma.facture.findMany({
      where: { dossierId },
      include: { paiements: true, dossier: { select: { numero: true, patient: true } } },
      orderBy: { creeLe: 'desc' },
    });
  }

  async creerFactureManuelle(
    dossierId: string,
    user: AuthUser,
    body: {
      type?: 'FACTURE' | 'DEVIS';
      lignes: { code?: string; description: string; quantite?: number; montant: number }[];
    },
  ) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { patient: true },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (!body.lignes?.length) throw new BadRequestException('Au moins une ligne est requise');

    const total = body.lignes.reduce((s, l) => s + Number(l.montant), 0);
    const year = new Date().getFullYear();
    const type = body.type ?? 'FACTURE';
    const count = await this.prisma.facture.count({
      where: { type, creeLe: { gte: new Date(`${year}-01-01`) } },
    });
    const prefix = type === 'FACTURE' ? 'FAC' : 'DEV';
    const numero = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;

    const facture = await this.prisma.facture.create({
      data: {
        numero,
        dossierId,
        type,
        statut: 'ENVOYE',
        montantTotal: total,
        genereParId: user.id,
      },
    });

    return this.attachPdf(facture.id, {
      titre: type,
      numero,
      patient: dossier.patient
        ? `${dossier.patient.prenom} ${dossier.patient.nom}`
        : undefined,
      dossierNumero: dossier.numero,
      destination: dossier.destination ?? undefined,
      lignes: body.lignes.map((l) => ({
        code: l.code,
        description: l.description,
        quantite: l.quantite ?? 1,
        montant: Number(l.montant),
      })),
      total,
      paye: 0,
      note: 'Document généré manuellement depuis eXpert',
    });
  }

  /** Buffer frais — stream HTTP du PDF régénéré (design = aperçu logiciel). */
  async getPdfBuffer(factureId: string): Promise<{
    buffer: Buffer;
    filename: string;
    codeVerification: string;
  }> {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: {
        paiements: true,
        dossier: { include: { patient: true } },
      },
    });
    if (!facture) throw new NotFoundException();

    const resume = await this.cotation.resume(facture.dossierId);
    const paye = facture.paiements
      .filter((p) => p.valide)
      .reduce((s, p) => s + Number(p.montant), 0);
    const titre =
      facture.type === 'FACTURE'
        ? 'FACTURE'
        : facture.signeLe
          ? 'DEVIS SIGNÉ'
          : 'DEVIS';

    const code =
      facture.codeVerification ||
      PdfService.makeVerificationCode(`${facture.numero}-${facture.id}-${Date.now()}`);

    const publicBase =
      process.env.APP_PUBLIC_URL ||
      process.env.PUBLIC_API_URL ||
      'https://expertsarlu-production.up.railway.app';
    const verifyUrl = `${publicBase.replace(/\/$/, '')}/api/facturation/verifier/${code}`;

    const stored = await this.pdf.buildAndStore({
      titre,
      numero: facture.numero,
      patient: facture.dossier.patient
        ? `${facture.dossier.patient.prenom} ${facture.dossier.patient.nom}`
        : undefined,
      dossierNumero: facture.dossier.numero,
      destination: facture.dossier.destination ?? undefined,
      lignes:
        resume.lignes.length > 0
          ? resume.lignes.map((l, i) => ({
              code: `LN-${String(i + 1).padStart(3, '0')}`,
              description: l.description,
              quantite: 1,
              montant: Number(l.montant),
            }))
          : [
              {
                code: 'TOT',
                description:
                  facture.type === 'FACTURE'
                    ? 'Facturation dossier'
                    : 'Devis de prise en charge',
                quantite: 1,
                montant: Number(facture.montantTotal),
              },
            ],
      total: Number(facture.montantTotal),
      paye: facture.type === 'FACTURE' ? Number(facture.montantTotal) : paye,
      signePar: facture.signeParNom ?? undefined,
      codeVerification: code,
      verifyUrl,
      emisLe: facture.creeLe,
    });

    await this.prisma.facture.update({
      where: { id: factureId },
      data: {
        pdfChemin: stored.chemin,
        codeVerification: stored.codeVerification,
      },
    });

    return {
      buffer: stored.buffer,
      filename: `${facture.numero}.pdf`,
      codeVerification: stored.codeVerification,
    };
  }

  async getPdfStream(factureId: string) {
    const { buffer } = await this.getPdfBuffer(factureId);
    const { Readable } = await import('stream');
    return { stream: Readable.from(buffer), contentType: 'application/pdf' };
  }

  async regenererPdf(factureId: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: {
        paiements: true,
        dossier: { include: { patient: true } },
      },
    });
    if (!facture) throw new NotFoundException();
    const resume = await this.cotation.resume(facture.dossierId);
    const paye = facture.paiements
      .filter((p) => p.valide)
      .reduce((s, p) => s + Number(p.montant), 0);
    const titre =
      facture.type === 'FACTURE'
        ? 'FACTURE'
        : facture.signeLe
          ? 'DEVIS SIGNÉ'
          : 'DEVIS';
    return this.attachPdf(facture.id, {
      titre,
      numero: facture.numero,
      patient: facture.dossier.patient
        ? `${facture.dossier.patient.prenom} ${facture.dossier.patient.nom}`
        : undefined,
      dossierNumero: facture.dossier.numero,
      destination: facture.dossier.destination ?? undefined,
      lignes:
        resume.lignes.length > 0
          ? resume.lignes.map((l, i) => ({
              code: `LN-${String(i + 1).padStart(3, '0')}`,
              description: l.description,
              quantite: 1,
              montant: Number(l.montant),
            }))
          : [
              {
                code: 'TOT',
                description:
                  facture.type === 'FACTURE'
                    ? 'Facturation dossier'
                    : 'Devis de prise en charge',
                quantite: 1,
                montant: Number(facture.montantTotal),
              },
            ],
      total: Number(facture.montantTotal),
      paye: facture.type === 'FACTURE' ? Number(facture.montantTotal) : paye,
      signePar: facture.signeParNom ?? undefined,
      // Force génération si absent
      codeVerification: facture.codeVerification || undefined,
      emisLe: facture.creeLe,
    });
  }

  async signerParToken(token: string, nom: string) {
    const facture = await this.prisma.facture.findFirst({
      where: { signatureToken: token },
      include: { dossier: { include: { patient: true } } },
    });
    if (!facture) throw new NotFoundException('Lien de signature invalide');
    if (facture.signeLe) {
      throw new BadRequestException('Ce devis est déjà signé');
    }
    const updated = await this.prisma.facture.update({
      where: { id: facture.id },
      data: {
        signeLe: new Date(),
        signeParNom: nom.trim(),
        statut: 'ACCEPTE',
      },
      include: { dossier: { include: { patient: true } } },
    });
    const resume = await this.cotation.resume(facture.dossierId);
    return this.attachPdf(updated.id, {
      titre: 'DEVIS SIGNÉ',
      numero: updated.numero,
      patient: updated.dossier.patient
        ? `${updated.dossier.patient.prenom} ${updated.dossier.patient.nom}`
        : undefined,
      dossierNumero: updated.dossier.numero,
      destination: updated.dossier.destination ?? undefined,
      lignes: resume.lignes.map((l, i) => ({
        code: `LN-${String(i + 1).padStart(3, '0')}`,
        description: l.description,
        quantite: 1,
        montant: Number(l.montant),
      })),
      total: Number(updated.montantTotal),
      paye: 0,
      signePar: nom.trim(),
      codeVerification: updated.codeVerification ?? undefined,
    });
  }

  async infoSignature(token: string) {
    const facture = await this.prisma.facture.findFirst({
      where: { signatureToken: token },
      select: {
        id: true,
        numero: true,
        montantTotal: true,
        devise: true,
        signeLe: true,
        type: true,
        dossier: {
          select: {
            numero: true,
            patient: { select: { nom: true, prenom: true } },
          },
        },
      },
    });
    if (!facture) throw new NotFoundException();
    return facture;
  }

  /** File d’attente caisse : devis / factures non soldés. */
  async fileCaisse() {
    return this.prisma.facture.findMany({
      where: { statut: { notIn: ['ANNULE'] } },
      orderBy: { creeLe: 'desc' },
      take: 40,
      include: {
        dossier: {
          select: {
            numero: true,
            patient: { select: { prenom: true, nom: true } },
          },
        },
      },
    });
  }

  async pipelineFinancier() {
    const factures = await this.prisma.facture.findMany({
      include: {
        paiements: true,
        dossier: {
          include: {
            creePar: { select: { id: true, nom: true } },
            patient: true,
          },
        },
      },
    });

    let facture = 0;
    let encaisse = 0;
    let enAttente = 0;
    const parAgent: Record<string, { nom: string; facture: number; encaisse: number }> = {};
    const parDestination: Record<string, { facture: number; encaisse: number }> = {};

    for (const f of factures) {
      const total = Number(f.montantTotal);
      const paye = f.paiements
        .filter((p) => p.valide)
        .reduce((s, p) => s + Number(p.montant), 0);
      facture += total;
      encaisse += paye;
      if (f.statut !== 'PAYE') enAttente += Math.max(0, total - paye);

      const agent = f.dossier.creePar;
      if (!parAgent[agent.id]) {
        parAgent[agent.id] = { nom: agent.nom, facture: 0, encaisse: 0 };
      }
      parAgent[agent.id].facture += total;
      parAgent[agent.id].encaisse += paye;

      const dest = f.dossier.destination || 'Non précisée';
      if (!parDestination[dest]) {
        parDestination[dest] = { facture: 0, encaisse: 0 };
      }
      parDestination[dest].facture += total;
      parDestination[dest].encaisse += paye;
    }

    return {
      facture,
      encaisse,
      enAttente,
      parAgent: Object.values(parAgent),
      parDestination: Object.entries(parDestination).map(([destination, v]) => ({
        destination,
        ...v,
      })),
    };
  }

  async verifierParCode(code: string) {
    const normalized = code.trim().toUpperCase();
    const facture = await this.prisma.facture.findFirst({
      where: { codeVerification: normalized },
      select: {
        numero: true,
        type: true,
        montantTotal: true,
        devise: true,
        codeVerification: true,
        creeLe: true,
        dossier: {
          select: {
            numero: true,
            patient: { select: { prenom: true, nom: true } },
          },
        },
      },
    });
    if (!facture) throw new NotFoundException('Code de vérification invalide');
    return {
      valide: true,
      ...facture,
      patient: facture.dossier.patient
        ? `${facture.dossier.patient.prenom} ${facture.dossier.patient.nom}`
        : null,
      dossierNumero: facture.dossier.numero,
    };
  }

  async supprimerFacture(factureId: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new BadRequestException(
        'Seul le Super Admin peut supprimer directement. Demandez une suppression.',
      );
    }
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId } });
    if (!facture) throw new NotFoundException();
    await this.prisma.demandeSuppressionFacture.deleteMany({ where: { factureId } });
    await this.prisma.facture.delete({ where: { id: factureId } });
    return { ok: true, numero: facture.numero };
  }

  async demanderSuppression(
    factureId: string,
    user: AuthUser,
    motif: string,
  ) {
    if (user.role === 'SUPER_ADMIN') {
      return this.supprimerFacture(factureId, user);
    }
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { dossier: { select: { numero: true } } },
    });
    if (!facture) throw new NotFoundException();

    const pending = await this.prisma.demandeSuppressionFacture.findFirst({
      where: { factureId, statut: 'EN_ATTENTE' },
    });
    if (pending) {
      throw new BadRequestException('Une demande de suppression est déjà en attente');
    }

    const demande = await this.prisma.demandeSuppressionFacture.create({
      data: {
        factureId,
        demandeParId: user.id,
        motif: motif.trim() || 'Demande de suppression',
      },
      include: {
        facture: { select: { numero: true, type: true } },
        demandePar: { select: { nom: true } },
      },
    });

    const supers = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', actif: true },
      select: { id: true },
    });
    for (const s of supers) {
      await this.notifications.create(
        s.id,
        'FACTURE_DELETE_REQUEST',
        `Suppression ${demande.facture.numero} demandée`,
        {
          demandeId: demande.id,
          factureId,
          numero: demande.facture.numero,
          motif: demande.motif,
          demandePar: demande.demandePar.nom,
          dossierNumero: facture.dossier.numero,
        },
      );
    }

    return demande;
  }

  listDemandesSuppression() {
    return this.prisma.demandeSuppressionFacture.findMany({
      where: { statut: 'EN_ATTENTE' },
      orderBy: { creeLe: 'desc' },
      include: {
        facture: {
          select: {
            id: true,
            numero: true,
            type: true,
            montantTotal: true,
            dossier: { select: { id: true, numero: true } },
          },
        },
        demandePar: { select: { id: true, nom: true, email: true } },
      },
    });
  }

  async approuverSuppression(demandeId: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Réservé au Super Admin');
    }
    const demande = await this.prisma.demandeSuppressionFacture.findUnique({
      where: { id: demandeId },
      include: { facture: true, demandePar: true },
    });
    if (!demande || demande.statut !== 'EN_ATTENTE') {
      throw new NotFoundException('Demande introuvable');
    }
    const numero = demande.facture.numero;
    await this.prisma.$transaction(async (tx) => {
      await tx.demandeSuppressionFacture.update({
        where: { id: demandeId },
        data: {
          statut: 'APPROUVE',
          traiteParId: user.id,
          traiteLe: new Date(),
        },
      });
      await tx.facture.delete({ where: { id: demande.factureId } });
    });
    await this.notifications.create(
      demande.demandeParId,
      'FACTURE_DELETE_APPROVED',
      `Suppression de ${numero} approuvée`,
      { numero },
    );
    return { ok: true, numero };
  }

  async refuserSuppression(demandeId: string, user: AuthUser, motif?: string) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Réservé au Super Admin');
    }
    const demande = await this.prisma.demandeSuppressionFacture.findUnique({
      where: { id: demandeId },
    });
    if (!demande || demande.statut !== 'EN_ATTENTE') {
      throw new NotFoundException('Demande introuvable');
    }
    const updated = await this.prisma.demandeSuppressionFacture.update({
      where: { id: demandeId },
      data: {
        statut: 'REFUSE',
        traiteParId: user.id,
        traiteLe: new Date(),
        motif: motif?.trim()
          ? `${demande.motif} | Refus : ${motif.trim()}`
          : demande.motif,
      },
      include: { facture: { select: { numero: true } } },
    });
    await this.notifications.create(
      demande.demandeParId,
      'FACTURE_DELETE_REFUSED',
      `Suppression de ${updated.facture.numero} refusée`,
      { numero: updated.facture.numero },
    );
    return updated;
  }

  async regenererTousLesPdfs() {
    const all = await this.prisma.facture.findMany({ select: { id: true, numero: true } });
    const results: { numero: string; code: string }[] = [];
    for (const f of all) {
      const buf = await this.getPdfBuffer(f.id);
      results.push({ numero: f.numero, code: buf.codeVerification });
    }
    return results;
  }
}
