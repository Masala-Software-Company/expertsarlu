import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';

export type PdfDocInput = {
  titre: string;
  numero: string;
  patient?: string;
  destination?: string;
  lignes: { description: string; montant: number }[];
  total: number;
  devise?: string;
  note?: string;
  signePar?: string;
};

@Injectable()
export class PdfService {
  constructor(
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  async buildAndStore(input: PdfDocInput, folder = 'pdfs'): Promise<string> {
    const buffer = await this.render(input);
    return this.storage.put(
      folder,
      `${input.numero}.pdf`,
      buffer,
      'application/pdf',
    );
  }

  render(input: PdfDocInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fillColor('#144EB9')
        .fontSize(22)
        .text('eXpert SARLU', { continued: false });
      doc
        .fillColor('#0A0A0A')
        .fontSize(10)
        .text('Bureau de Coordination Médicale Internationale');
      doc.moveDown();
      doc.fontSize(16).text(input.titre);
      doc.fontSize(11).fillColor('#444').text(`N° ${input.numero}`);
      if (input.patient) doc.text(`Patient : ${input.patient}`);
      if (input.destination) doc.text(`Destination : ${input.destination}`);
      doc.moveDown();

      doc.fillColor('#0A0A0A').fontSize(11);
      for (const l of input.lignes) {
        doc.text(l.description, { continued: true, width: 350 });
        doc.text(
          `${Number(l.montant).toFixed(2)} ${input.devise ?? 'USD'}`,
          { align: 'right' },
        );
      }
      doc.moveDown();
      doc
        .fontSize(13)
        .fillColor('#144EB9')
        .text(
          `Total : ${Number(input.total).toFixed(2)} ${input.devise ?? 'USD'}`,
          { align: 'right' },
        );

      if (input.signePar) {
        doc.moveDown(2);
        doc.fillColor('#0A0A0A').fontSize(11).text(`Signé électroniquement par : ${input.signePar}`);
        doc.text(`Date : ${new Date().toLocaleString('fr-FR')}`);
      }
      if (input.note) {
        doc.moveDown().fontSize(9).fillColor('#666').text(input.note);
      }

      doc.end();
    });
  }

  /** Fallback local path helper when storage returns relative path */
  async writeLocal(buffer: Buffer, name: string) {
    const root = this.config.get('GED_STORAGE_PATH', './uploads');
    const dir = join(root, 'pdfs');
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${randomUUID()}-${name}`);
    await writeFile(path, buffer);
    return path;
  }
}
