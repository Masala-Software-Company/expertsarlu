import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { randomUUID, createHash, randomBytes } from 'crypto';
import { StorageService } from '../storage/storage.service';

export type PdfLigne = {
  code?: string;
  description: string;
  quantite?: number;
  montant: number;
};

export type PdfDocInput = {
  titre: 'FACTURE' | 'DEVIS' | string;
  numero: string;
  patient?: string;
  dossierNumero?: string;
  destination?: string;
  lignes: PdfLigne[];
  total: number;
  paye?: number;
  devise?: string;
  note?: string;
  signePar?: string;
  codeVerification?: string;
  emisLe?: Date;
  verifyUrl?: string;
};

const COMPANY = {
  name: "L'EXPERT SARLU",
  tagline: 'Évacuation & Mobilité Médicale Internationale',
  rccm: 'CD/KNG/RCCM/26-B-02466',
  idNat: '01-F4300-N00001D',
  impot: 'A2625365A',
};

async function resolveLogo(): Promise<Buffer | null> {
  const candidates = [
    join(process.cwd(), 'src/assets/logos/logo-blue.png'),
    join(process.cwd(), 'assets/logos/logo-blue.png'),
    join(process.cwd(), '../frontend/src/assets/logos/logo-blue.png'),
    join(__dirname, '../assets/logos/logo-blue.png'),
    join(__dirname, '../../../frontend/src/assets/logos/logo-blue.png'),
  ];
  for (const p of candidates) {
    try {
      await access(p);
      return await readFile(p);
    } catch {
      /* next */
    }
  }
  return null;
}

function money(n: number) {
  return `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $US`;
}

@Injectable()
export class PdfService {
  constructor(
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  /** Code unique lisible (12 car. hex majuscules). */
  static makeVerificationCode(seed?: string) {
    const raw =
      seed ||
      `${Date.now()}-${randomBytes(16).toString('hex')}-${randomUUID()}`;
    return createHash('sha256')
      .update(raw)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
  }

  async buildAndStore(input: PdfDocInput, folder = 'pdfs'): Promise<{
    chemin: string;
    codeVerification: string;
    buffer: Buffer;
  }> {
    const code =
      (input.codeVerification && input.codeVerification.trim()) ||
      PdfService.makeVerificationCode(`${input.numero}|${Date.now()}`);
    const buffer = await this.render({ ...input, codeVerification: code });
    const chemin = await this.storage.put(
      folder,
      `${input.numero}.pdf`,
      buffer,
      'application/pdf',
    );
    return { chemin, codeVerification: code, buffer };
  }

  render(input: PdfDocInput): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const titre = String(input.titre || 'DEVIS').toUpperCase();
        const isFacture = titre.includes('FACTURE') && !titre.includes('DEVIS');
        const labelDoc = isFacture ? 'FACTURE' : titre.includes('SIGNÉ') ? 'DEVIS SIGNÉ' : 'DEVIS';
        const code =
          (input.codeVerification && input.codeVerification.trim()) ||
          PdfService.makeVerificationCode(`${input.numero}|${input.total}`);

        const verifyPayload =
          input.verifyUrl ||
          `eXpert SARLU|${labelDoc}|${input.numero}|${code}|dossier:${input.dossierNumero || '—'}`;

        const qrPng = await QRCode.toBuffer(verifyPayload, {
          type: 'png',
          width: 180,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0A0A0A', light: '#FFFFFF' },
        });
        const logo = await resolveLogo();

        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `${labelDoc} ${input.numero}`,
            Author: "L'EXPERT SARLU",
            Subject: `Code ${code}`,
          },
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageW = doc.page.width;
        const left = 40;
        const right = pageW - 40;
        const brand = '#144EB9';
        const contentW = right - left;

        // Header
        if (logo) {
          doc.image(logo, left, 36, { height: 38 });
        } else {
          doc.fillColor(brand).font('Helvetica-Bold').fontSize(20).text('eXpert', left, 42);
        }

        doc
          .fillColor('#0A0A0A')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(COMPANY.name, left + 115, 38, { width: 230 });
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(COMPANY.tagline, left + 115, 54, { width: 240 });

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#334155')
          .text(`RCCM : ${COMPANY.rccm}`, right - 190, 38, {
            width: 190,
            align: 'right',
          })
          .text(`ID NAT : ${COMPANY.idNat}`, { width: 190, align: 'right' })
          .text(`N° IMPÔT : ${COMPANY.impot}`, { width: 190, align: 'right' });

        doc
          .moveTo(left, 88)
          .lineTo(right, 88)
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .stroke();

        // Title
        doc.rect(left, 102, 4, 44).fill(brand);
        doc
          .fillColor(brand)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(labelDoc, left + 14, 106);
        doc
          .fillColor('#0F172A')
          .fontSize(18)
          .text(input.numero, left + 14, 122);

        const emis = input.emisLe ?? new Date();
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(9)
          .text('Émise le', right - 160, 106, { width: 160, align: 'right' });
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(
            emis.toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            right - 160,
            122,
            { width: 160, align: 'right' },
          );

        // Meta box — Client / Dossier / Code (jamais vide)
        const boxY = 162;
        doc.roundedRect(left, boxY, contentW, 62, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
        const colW = contentW / 3;
        const meta: [string, string][] = [
          ['CLIENT', (input.patient || '—').trim() || '—'],
          ['DOSSIER', (input.dossierNumero || '—').trim() || '—'],
          ['CODE DE VÉRIFICATION', code],
        ];
        meta.forEach(([label, value], i) => {
          const x = left + 14 + i * colW;
          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(8)
            .text(label, x, boxY + 14, { width: colW - 24 });
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(i === 2 ? 12 : 11)
            .text(value, x, boxY + 32, { width: colW - 24 });
        });

        // Table
        let y = boxY + 82;
        doc.roundedRect(left, y, contentW, 26, 6).fill('#EEF3FB');
        doc.fillColor(brand).font('Helvetica-Bold').fontSize(9);
        doc.text('CODE', left + 12, y + 8, { width: 70 });
        doc.text('FRAIS', left + 90, y + 8, { width: 250 });
        doc.text('QTÉ', left + 350, y + 8, { width: 50, align: 'right' });
        doc.text('TOTAL', left + 410, y + 8, {
          width: contentW - 422,
          align: 'right',
        });
        y += 34;

        const lignes =
          input.lignes?.length > 0
            ? input.lignes
            : [{ code: '—', description: 'Aucune ligne', quantite: 1, montant: 0 }];

        for (const l of lignes) {
          if (y > 640) {
            doc.addPage();
            y = 50;
          }
          const qty = l.quantite ?? 1;
          doc.fillColor('#0F172A').font('Helvetica').fontSize(10);
          doc.text(l.code || '—', left + 12, y, { width: 70 });
          doc.text(l.description || '—', left + 90, y, { width: 250 });
          doc.text(String(qty), left + 350, y, { width: 50, align: 'right' });
          doc.font('Helvetica-Bold').text(money(Number(l.montant)), left + 410, y, {
            width: contentW - 422,
            align: 'right',
          });
          y += 24;
          doc
            .moveTo(left, y - 6)
            .lineTo(right, y - 6)
            .strokeColor('#F1F5F9')
            .lineWidth(0.8)
            .stroke();
        }

        // Totals
        y += 12;
        const paye =
          input.paye ?? (isFacture ? Number(input.total) : 0);
        const reste = Math.max(0, Number(input.total) - Number(paye));
        const totals: [string, number][] = [
          ['Total', Number(input.total)],
          ['Payé', Number(paye)],
          ['Reste', reste],
        ];
        for (const [label, amount] of totals) {
          const bold = label === 'Reste';
          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(10)
            .text(label, right - 210, y, { width: 80, align: 'right' });
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(bold ? 12 : 10)
            .text(money(amount), right - 120, y, {
              width: 120,
              align: 'right',
            });
          y += 18;
        }

        // Auth footer — QR + code toujours visibles
        const footerY = Math.min(Math.max(y + 40, 680), 740);
        doc.roundedRect(left, footerY - 8, contentW, 88, 10).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc.image(qrPng, left + 12, footerY, { width: 72, height: 72 });
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(9)
          .text('Authentification du document', left + 100, footerY + 12);
        doc
          .fillColor(brand)
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(code, left + 100, footerY + 30);
        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(8)
          .text(
            'Scannez le QR code pour vérifier l’authenticité de ce document.',
            left + 100,
            footerY + 54,
            { width: 360 },
          );

        if (input.signePar) {
          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(8)
            .text(`Signé électroniquement par ${input.signePar}`, left + 100, footerY + 68);
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async renderAssistanceCard(input: {
    numero: string;
    patientNom: string;
    destination?: string;
    pathologie?: string;
    statut: string;
    nationalite?: string;
    telephone?: string;
    email?: string;
    accompagnateurs?: string[];
    priorite?: string;
  }): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const logo = await resolveLogo();
        const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const brand = '#144EB9';
        const w = doc.page.width;
        const h = doc.page.height;

        doc.rect(0, 0, w, h).fill('#0B1F44');
        doc.roundedRect(24, 24, w - 48, h - 48, 18).fill('#FFFFFF');

        if (logo) doc.image(logo, 48, 48, { height: 42 });
        else doc.fillColor(brand).font('Helvetica-Bold').fontSize(22).text('eXpert', 48, 54);

        doc
          .fillColor(brand)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('CARTE D’ASSISTANCE MÉDICALE', 48, 100);
        doc.fillColor('#0F172A').fontSize(28).text(input.patientNom, 48, 122);
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(12)
          .text(`Dossier ${input.numero}`, 48, 158);

        const rows = [
          ['Statut', input.statut],
          ['Destination', input.destination || '—'],
          ['Pathologie', input.pathologie || '—'],
          ['Nationalité', input.nationalite || '—'],
          ['Contact', input.telephone || input.email || '—'],
          ['Priorité', input.priorite || 'Normale'],
        ];
        let y = 200;
        for (const [k, v] of rows) {
          doc.fillColor('#94A3B8').fontSize(9).text(k.toUpperCase(), 48, y);
          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(13).text(v, 180, y);
          y += 28;
        }

        if (input.accompagnateurs?.length) {
          doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text('ACCOMPAGNATEURS', 48, y);
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(input.accompagnateurs.join(' · '), 180, y, { width: 400 });
        }

        doc
          .fillColor(brand)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(
            "L'EXPERT SARLU — Évacuation & Mobilité Médicale Internationale",
            48,
            h - 70,
          );

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async writeLocal(buffer: Buffer, name: string) {
    const root = this.config.get('GED_STORAGE_PATH', './uploads');
    const dir = join(root, 'pdfs');
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${randomUUID()}-${name}`);
    await writeFile(path, buffer);
    return path;
  }
}
