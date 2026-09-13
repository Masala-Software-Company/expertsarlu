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
  recordId?: string;
  user?: { nom: string; email: string };
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  VALIDATE: 'Validation',
  UNLOCK: 'Déverrouillage',
  UNLOCK_REQUEST: 'Demande de déverrouillage',
  UNLOCK_APPROVE: 'Déverrouillage approuvé',
  UNLOCK_REFUSE: 'Déverrouillage refusé',
  UPDATE_TARIF: 'Mise à jour tarif',
  UPLOAD_DOCUMENT: 'Ajout document',
  DELETE_DOCUMENT: 'Suppression document',
  LOGIN: 'Connexion',
  RESTORE: 'Restauration',
};

const TABLE_LABELS: Record<string, string> = {
  dossiers: 'Dossier',
  tarifs_base: 'Tarification',
  documents_ged: 'Document GED',
  users: 'Utilisateur',
  patients: 'Patient',
  factures: 'Facture',
  lignes_cotation: 'Cotation',
};

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
      const action = (ACTION_LABELS[l.action] ?? l.action).toLowerCase();
      const table = (TABLE_LABELS[l.tableCible] ?? l.tableCible).toLowerCase();
      return (
        action.includes(needle) ||
        table.includes(needle) ||
        l.action.toLowerCase().includes(needle) ||
        l.tableCible.toLowerCase().includes(needle) ||
        (l.user?.nom ?? '').toLowerCase().includes(needle) ||
        (l.user?.email ?? '').toLowerCase().includes(needle) ||
        (l.recordId ?? '').toLowerCase().includes(needle)
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
          placeholder="Filtrer (utilisateur, action…)"
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
                    {ACTION_LABELS[l.action] ?? l.action.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {TABLE_LABELS[l.tableCible] ?? l.tableCible}
                  {l.recordId ? (
                    <span className="ml-1 font-mono text-[11px] opacity-70">
                      · {l.recordId.slice(0, 8)}
                    </span>
                  ) : null}
                </td>
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
