import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from =
      this.config.get<string>('RESEND_FROM') ||
      'eXpert SARLU <onboarding@resend.dev>';
    this.client = apiKey ? new Resend(apiKey) : null;
    if (!this.client) {
      this.log.warn(
        'RESEND_API_KEY manquant — les e-mails seront uniquement journalisés (pas d’envoi réel).',
      );
    }
  }

  enabled() {
    return Boolean(this.client);
  }

  async send(opts: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ ok: boolean; id?: string; skipped?: boolean }> {
    const to = Array.isArray(opts.to) ? opts.to : [opts.to];
    const recipients = to.map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) {
      return { ok: false, skipped: true };
    }

    if (!this.client) {
      this.log.log(`[mail:dry-run] → ${recipients.join(', ')} | ${opts.subject}`);
      return { ok: true, skipped: true };
    }

    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: recipients,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      if (error) {
        this.log.error(`Resend error: ${error.message}`);
        return { ok: false };
      }
      this.log.log(`E-mail envoyé ${data?.id} → ${recipients.join(', ')}`);
      return { ok: true, id: data?.id };
    } catch (err) {
      this.log.error(`E-mail échoué: ${String(err)}`);
      return { ok: false };
    }
  }

  async sendRappelRendezVous(input: {
    to: string;
    patientNom: string;
    dossierNumero: string;
    type: string;
    dateHeure: Date;
    lieu?: string | null;
    horizon: 'J-1' | 'J0';
  }) {
    const when = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const titre =
      input.horizon === 'J-1'
        ? `Rappel : rendez-vous demain — ${input.dossierNumero}`
        : `Rappel : rendez-vous aujourd’hui — ${input.dossierNumero}`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0A0A0A">
        <p style="color:#144EB9;font-weight:700;font-size:14px;margin:0 0 8px">eXpert SARLU</p>
        <h1 style="font-size:22px;margin:0 0 16px">${titre}</h1>
        <p>Bonjour ${input.patientNom},</p>
        <p>Nous vous rappelons votre rendez-vous :</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666">Dossier</td><td style="padding:8px 0;font-weight:600">${input.dossierNumero}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Type</td><td style="padding:8px 0;font-weight:600">${input.type}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Date</td><td style="padding:8px 0;font-weight:600">${when}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Lieu</td><td style="padding:8px 0;font-weight:600">${input.lieu || 'À confirmer'}</td></tr>
        </table>
        <p style="color:#666;font-size:13px">Merci de vous présenter à l’heure indiquée. Pour toute question, contactez le bureau eXpert SARLU.</p>
      </div>
    `;

    return this.send({
      to: input.to,
      subject: titre,
      html,
      text: `${titre}\n${input.type} — ${when}\nLieu: ${input.lieu || 'À confirmer'}`,
    });
  }
}
