export const TACHE_STATUT_LABELS: Record<string, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  BLOQUE: 'Bloqué',
  ANNULE: 'Annulé',
};

export const TACHE_TYPE_LABELS: Record<string, string> = {
  VISA: 'Visa / ambassade',
  NAVETTE: 'Navette aéroport',
  VOL: 'Vol / billetterie',
  AUTRE: 'Autre mission',
};

export const POST_RETOUR_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  RENTRE: 'Rentré',
  SUIVI: 'Suivi actif',
  CLOS: 'Clos',
};

export const RDV_TYPE_LABELS: Record<string, string> = {
  NAVETTE: 'Navette',
  AMBASSADE: 'Ambassade',
  HOPITAL: 'Hôpital',
};

export const RDV_STATUT_LABELS: Record<string, string> = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

export function labelOf(map: Record<string, string>, key?: string | null) {
  if (!key) return '—';
  return map[key] ?? key.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
