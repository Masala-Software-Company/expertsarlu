import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

type Log = {
  id: string;
  timestamp: string;
  action: string;
  tableCible: string;
  recordId?: string | null;
  nouvelleValeur?: {
    path?: string;
    numero?: string;
    resultId?: string;
  } | null;
  user?: { nom: string; email: string };
};

/** Libellés métier — jamais de jargon HTTP / code. */
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  VALIDATE: 'Validation du dossier',
  UNLOCK: 'Déverrouillage',
  UNLOCK_REQUEST: 'Demande de déverrouillage',
  UNLOCK_APPROVE: 'Déverrouillage approuvé',
  UNLOCK_REFUSE: 'Déverrouillage refusé',
  UPDATE_TARIF: 'Mise à jour d’un tarif',
  UPLOAD_DOCUMENT: 'Ajout d’un document',
  DELETE_DOCUMENT: 'Suppression d’un document',
  LOGIN: 'Connexion',
  RESTORE: 'Restauration depuis la corbeille',
  HARD_DELETE: 'Suppression définitive',
  STATUT_CHANGE: 'Changement de statut',
  SUIVI_TOKEN: 'Lien de suivi patient généré',
  POST_AUTO: 'Enregistrement',
  PATCH_AUTO: 'Mise à jour',
  PUT_AUTO: 'Mise à jour',
  DELETE_AUTO: 'Suppression',
};

const TABLE_LABELS: Record<string, string> = {
  dossiers: 'Dossier',
  dossier: 'Dossier',
  tarifs_base: 'Tarification',
  tarification: 'Tarification',
  documents_ged: 'Document',
  ged: 'Documents',
  users: 'Compte utilisateur',
  patients: 'Patient',
  factures: 'Facture / devis',
  facturation: 'Facturation',
  lignes_cotation: 'Ligne de cotation',
  cotation: 'Cotation',
  demandes_deverrouillage: 'Demande de déverrouillage',
  communications: 'Communication',
  partenaires: 'Partenaire',
  prospects: 'Prospect',
  logistique: 'Protocole / logistique',
  rendez_vous: 'Rendez-vous',
  taches_logistique: 'Tâche protocole',
  inbox: 'Message reçu',
  inbox_messages: 'Message reçu',
  notifications: 'Notification',
  paiements: 'Paiement',
  api: 'Activité système',
  systeme: 'Système',
  unknown: 'Élément',
};

function humanizeToken(raw: string) {
  return raw
    .replace(/^\/+|\/+$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (ACTION_LABELS[action.toUpperCase()]) return ACTION_LABELS[action.toUpperCase()];
  // Ex. "POST_AUTO" déjà couvert ; fallback soft
  const soft = action
    .replace(/_AUTO$/i, '')
    .replaceAll('_', ' ')
    .toLowerCase();
  if (soft === 'post') return 'Enregistrement';
  if (soft === 'patch' || soft === 'put') return 'Mise à jour';
  if (soft === 'delete') return 'Suppression';
  return humanizeToken(action);
}

function moduleFromPath(path?: string | null) {
  if (!path) return null;
  const clean = path.split('?')[0].replace(/^\/api\/?/, '').replace(/^\//, '');
  return clean.split('/').filter(Boolean)[0] ?? null;
}

function elementLabel(log: Log) {
  let key = log.tableCible;
  if (!TABLE_LABELS[key] || key === 'api' || key === 'unknown') {
    const fromPath = moduleFromPath(log.nouvelleValeur?.path);
    if (fromPath && TABLE_LABELS[fromPath]) key = fromPath;
  }
  const base = TABLE_LABELS[key] ?? humanizeToken(key || 'élément');
  const numero = log.nouvelleValeur?.numero;
  if (numero && /^MED-/i.test(numero)) {
    return `${base} ${numero}`;
  }
  return base;
}

export function AuditPage() {
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => (await api.get<Log[]>('/audit', { params: { limit: 150 } })).data,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((l) => {
      const action = actionLabel(l.action).toLowerCase();
      const element = elementLabel(l).toLowerCase();
      return (
        action.includes(needle) ||
        element.includes(needle) ||
        (l.user?.nom ?? '').toLowerCase().includes(needle) ||
        (l.user?.email ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Journal d’activité</h1>
          <p className="mt-1 text-sm text-muted">
            Historique des actions réalisées dans eXpert — {data.length} événement
            {data.length > 1 ? 's' : ''} récents.
          </p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Filtrer (collaborateur, action…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Date & heure</th>
              <th className="px-4 py-3">Collaborateur</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Élément</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-[var(--border)] hover:bg-brand/[0.03]">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {format(new Date(l.timestamp), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{l.user?.nom ?? 'Système'}</div>
                  {l.user?.email && (
                    <div className="text-xs text-muted">{l.user.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      'bg-brand/10 text-brand',
                    )}
                  >
                    {actionLabel(l.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{elementLabel(l)}</td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted">
                  Aucune activité enregistrée pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
