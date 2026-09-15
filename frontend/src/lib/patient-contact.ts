/** Liens de contact patient → WhatsApp / e-mail avec message prérempli. */

import { STATUT_LABELS } from './utils';

export function digitsOnlyPhone(raw?: string | null) {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

export function buildPatientOutreachMessage(opts: {
  prenom?: string | null;
  nom?: string | null;
  numeroDossier?: string | null;
  statut?: string | null;
}) {
  const name = [opts.prenom, opts.nom].filter(Boolean).join(' ').trim() || 'Madame, Monsieur';
  const dossier = opts.numeroDossier?.trim() || '—';
  const statut =
    (opts.statut && (STATUT_LABELS[opts.statut] ?? opts.statut)) || 'en cours de traitement';

  return (
    `Bonjour ${name},\n\n` +
    `Ici l’équipe eXpert SARLU concernant votre dossier ${dossier} ` +
    `(statut actuel : ${statut}).\n\n` +
    `Nous restons à votre disposition pour la suite de votre prise en charge.\n\n` +
    `Cordialement,\nBureau eXpert SARLU`
  );
}

export function whatsappChatUrl(
  telephone: string | null | undefined,
  message: string,
) {
  const phone = digitsOnlyPhone(telephone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function mailtoPatientUrl(
  email: string | null | undefined,
  opts: {
    prenom?: string | null;
    nom?: string | null;
    numeroDossier?: string | null;
    statut?: string | null;
    body?: string | null;
    subject?: string | null;
  },
) {
  if (!email?.trim()) return null;
  const dossier = opts.numeroDossier?.trim() || '';
  const subject =
    opts.subject?.trim() ||
    (dossier
      ? `eXpert SARLU — Dossier ${dossier}`
      : 'eXpert SARLU — Votre dossier médical');
  const body = opts.body?.trim() || buildPatientOutreachMessage(opts);
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
