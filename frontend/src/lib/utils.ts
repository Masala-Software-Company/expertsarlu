import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ASSISTANT_MANAGER: 'Assistant Manager',
  SUPPORT_CLIENT: 'Support Client',
  CAISSE_ADMIN: 'Caisse & Admin',
  PROTOCOLE: 'Protocole',
};

/** Prénom d’affichage pour les salutations (pas le titre de poste). */
export function firstName(fullName?: string | null) {
  if (!fullName?.trim()) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export const STATUT_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_COURS: 'En cours',
  VALIDE: 'Validé',
  FACTURE_PAYE: 'Facturé & Payé',
  VERROUILLE: 'Verrouillé',
  ARCHIVE_SUPPRIME: 'Corbeille',
};
