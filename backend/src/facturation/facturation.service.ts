import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CotationService } from '../cotation/cotation.service';
import { AuthUser } from '../auth/current-user.decorator';
import { MethodePaiement } from '@prisma/client';

@Injectable()
export class FacturationService {
  constructor(
    private prisma: PrismaService,
    private cotation: CotationService,
  ) {}

  async creerDevis(dossierId: string, user: AuthUser) {
    const resume = await this.cotation.resume(dossierId);
    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: { type: 'DEVIS', creeLe: { gte: new Date(`${year}-01-01`) } },
    });
    const numero = `DEV-${year}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.facture.create({
      data: {
        numero,
        dossierId,
        type: 'DEVIS',
        statut: 'ENVOYE',
        montantTotal: resume.total,
        genereParId: user.id,
      },
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
      include: { paiements: true },
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

    return this.prisma.facture.create({
      data: {
        numero: `FAC-${year}-${String(count + 1).padStart(4, '0')}`,
        dossierId: devis.dossierId,
        type: 'FACTURE',
        statut: 'PAYE',
        montantTotal: devis.montantTotal,
        dateEncaissement: new Date(),
        genereParId: user.id,
      },
    });
  }

  listByDossier(dossierId: string) {
    return this.prisma.facture.findMany({
      where: { dossierId },
      include: { paiements: true },
      orderBy: { creeLe: 'desc' },
    });
  }
}
