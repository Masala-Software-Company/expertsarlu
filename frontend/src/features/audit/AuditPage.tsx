import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Log = {
  id: string;
  timestamp: string;
  action: string;
  tableCible: string;
  recordId?: string | null;
  ancienneValeur?: unknown;
  nouvelleValeur?: {
    path?: string;
    numero?: string;
    resultId?: string;
    [key: string]: unknown;
  } | null;
  ip?: string | null;
  userAgent?: string | null;
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
  if (numero && /^MED-/i.test(String(numero))) {
    return `${base} ${numero}`;
  }
  return base;
}

function detailRows(value: unknown): { label: string; text: string }[] {
  if (value == null) return [];
  if (typeof value !== 'object' || Array.isArray(value)) {
    return [{ label: 'Information', text: String(value) }];
  }

  const obj = value as Record<string, unknown>;
  const rows: { label: string; text: string }[] = [];

  const LABEL: Record<string, string> = {
    numero: 'Numéro',
    path: 'Opération',
    durationMs: 'Durée',
    resultId: 'Identifiant',
    motif: 'Motif',
    statut: 'Statut',
    nom: 'Nom',
    prenom: 'Prénom',
    email: 'E-mail',
    telephone: 'Téléphone',
    categorie: 'Catégorie',
    nomFichier: 'Fichier',
    message: 'Message',
    reference: 'Référence',
  };

  const skip = new Set(['resultId']); // déjà couvert par Réf. interne du modal

  for (const [key, raw] of Object.entries(obj)) {
    if (raw == null || raw === '' || skip.has(key)) continue;
    if (typeof raw === 'object') continue; // pas de JSON imbriqué

    let text = String(raw);
    if (key === 'durationMs' && typeof raw === 'number') {
      text = raw < 1000 ? `${raw} ms` : `${(raw / 1000).toFixed(1)} s`;
    }
    if (key === 'path' && typeof raw === 'string') {
      const clean = raw.split('?')[0].replace(/^\/api\/?/, '').replace(/^\//, '');
      const parts = clean.split('/').filter(Boolean);
      const module = parts[0] ?? '';
      const action = parts.slice(1).find((p) => !/^[a-z0-9]{20,}$/i.test(p) && !/^\d+$/.test(p));
      const moduleLabel = TABLE_LABELS[module] ?? humanizeToken(module || 'système');
      const ACTION_PATH: Record<string, string> = {
        'suivi-token': 'Lien de suivi patient',
        photo: 'Photo',
        statut: 'Changement de statut',
        valider: 'Validation',
        deverrouiller: 'Déverrouillage',
        paiements: 'Paiement',
        officielle: 'Facture officielle',
        'demande-suppression': 'Demande de suppression',
      };
      const actionLabelText = action
        ? ACTION_PATH[action] ?? humanizeToken(action)
        : null;
      text = actionLabelText ? `${moduleLabel} — ${actionLabelText}` : moduleLabel;
    }

    rows.push({
      label: LABEL[key] ?? humanizeToken(key),
      text,
    });
  }

  return rows;
}

export function AuditPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Log | null>(null);
  const pageSize = 10;
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => (await api.get<Log[]>('/audit', { params: { limit: 500 } })).data,
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pages = useMemo(() => {
    const window = 2;
    const out: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= window) {
        out.push(i);
      } else if (out[out.length - 1] !== '…') {
        out.push('…');
      }
    }
    return out;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Journal d’activité</h1>
          <p className="mt-1 text-sm text-muted">
            Historique des actions — {filtered.length} événement
            {filtered.length > 1 ? 's' : ''} · page {currentPage}/{totalPages}
          </p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Filtrer (collaborateur, action…)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
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
            {pageItems.map((l) => (
              <tr
                key={l.id}
                className="border-t border-[var(--border)] hover:bg-brand/[0.03] cursor-pointer"
                onClick={() => setSelected(l)}
              >
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
                  <button
                    type="button"
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      'bg-brand/10 text-brand hover:bg-brand/20',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(l);
                    }}
                  >
                    {actionLabel(l.action)}
                  </button>
                </td>
                <td className="px-4 py-3 text-muted">{elementLabel(l)}</td>
              </tr>
            ))}
            {!isLoading && pageItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted">
                  Aucune activité enregistrée pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2" aria-label="Pagination">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-40"
          >
            Précédent
          </button>
          {pages.map((p, idx) =>
            p === '…' ? (
              <span key={`e-${idx}`} className="px-2 text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  'min-w-9 rounded-lg px-3 py-1.5 text-sm font-semibold',
                  p === currentPage
                    ? 'bg-brand text-white'
                    : 'text-brand hover:bg-brand/10',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-40"
          >
            Suivant
          </button>
        </nav>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">{actionLabel(selected.action)}</h2>
                <p className="text-sm text-muted">{elementLabel(selected)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 hover:bg-canvas"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted">Date</dt>
                <dd className="font-medium">
                  {format(new Date(selected.timestamp), "dd MMMM yyyy 'à' HH:mm:ss", {
                    locale: fr,
                  })}
                </dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted">Collaborateur</dt>
                <dd className="font-medium">
                  {selected.user?.nom ?? 'Système'}
                  {selected.user?.email ? (
                    <span className="block text-xs text-muted">{selected.user.email}</span>
                  ) : null}
                </dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted">Élément</dt>
                <dd className="font-medium">{elementLabel(selected)}</dd>
              </div>
              {selected.recordId ? (
                <div className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="text-muted">Réf. interne</dt>
                  <dd className="break-all font-mono text-xs">{selected.recordId}</dd>
                </div>
              ) : null}
              {selected.ip ? (
                <div className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="text-muted">IP</dt>
                  <dd className="font-mono text-xs">{selected.ip}</dd>
                </div>
              ) : null}
            </dl>

            {(() => {
              const after = detailRows(selected.nouvelleValeur);
              const before = detailRows(selected.ancienneValeur);
              if (!after.length && !before.length) return null;
              return (
                <div className="mt-4 space-y-4">
                  {after.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Détails
                      </p>
                      <dl className="space-y-2 rounded-xl bg-canvas p-3 text-sm">
                        {after.map((row) => (
                          <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2">
                            <dt className="text-muted">{row.label}</dt>
                            <dd className="font-medium">{row.text}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {before.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Avant modification
                      </p>
                      <dl className="space-y-2 rounded-xl bg-canvas p-3 text-sm">
                        {before.map((row) => (
                          <div key={`b-${row.label}`} className="grid grid-cols-[7rem_1fr] gap-2">
                            <dt className="text-muted">{row.label}</dt>
                            <dd className="font-medium">{row.text}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
