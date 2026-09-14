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
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FacturationService {
  constructor(
    private prisma: PrismaService,
    private cotation: CotationService,
    private pdf: PdfService,
    private storage: StorageService,
  ) {}

  private async attachPdf(
    factureId: string,
    input: {
      titre: string;
      numero: string;
      patient?: string;
      destination?: string;
      lignes: { description: string; montant: number }[];
      total: number;
      devise?: string;
      signePar?: string;
      note?: string;
    },
  ) {
    const chemin = await this.pdf.buildAndStore(input);
    return this.prisma.facture.update({
      where: { id: factureId },
      data: { pdfChemin: chemin },
      include: { paiements: true },
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
      destination: dossier.destination ?? undefined,
      lignes: resume.lignes.map((l) => ({
        description: l.description,
        montant: Number(l.montant),
      })),
      total: Number(resume.total),
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
      destination: devis.dossier.destination ?? undefined,
      lignes: resume.lignes.map((l) => ({
        description: l.description,
        montant: Number(l.montant),
      })),
      total: Number(devis.montantTotal),
      note: 'Document officiel — paiement validé',
    });
  }

  listByDossier(dossierId: string) {
    return this.prisma.facture.findMany({
      where: { dossierId },
      include: { paiements: true },
      orderBy: { creeLe: 'desc' },
    });
  }

  async getPdfStream(factureId: string) {
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId } });
    if (!facture?.pdfChemin) throw new NotFoundException('PDF introuvable');
    const opened = await this.storage.open(facture.pdfChemin);
    if (!opened) throw new NotFoundException('Fichier PDF manquant');
    return opened;
  }

  async regenererPdf(factureId: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { dossier: { include: { patient: true } } },
    });
    if (!facture) throw new NotFoundException();
    const resume = await this.cotation.resume(facture.dossierId);
    return this.attachPdf(facture.id, {
      titre: facture.type === 'FACTURE' ? 'FACTURE' : 'DEVIS',
      numero: facture.numero,
      patient: facture.dossier.patient
        ? `${facture.dossier.patient.prenom} ${facture.dossier.patient.nom}`
        : undefined,
      destination: facture.dossier.destination ?? undefined,
      lignes: resume.lignes.map((l) => ({
        description: l.description,
        montant: Number(l.montant),
      })),
      total: Number(facture.montantTotal),
      signePar: facture.signeParNom ?? undefined,
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
      destination: updated.dossier.destination ?? undefined,
      lignes: resume.lignes.map((l) => ({
        description: l.description,
        montant: Number(l.montant),
      })),
      total: Number(updated.montantTotal),
      signePar: nom.trim(),
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
}
