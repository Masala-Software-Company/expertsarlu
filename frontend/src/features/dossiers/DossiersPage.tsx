import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUT_LABELS, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';
import { PatientAvatar } from '@/components/PatientAvatar';
import { CreateDossierWizard } from './CreateDossierWizard';

export type DossierRow = {
  id: string;
  numero: string;
  statut: string;
  destination?: string;
  priorite: string;
  typeClient: string;
  patient?: {
    id: string;
    nom: string;
    prenom: string;
    photoProfil?: string | null;
  };
  verrouille: boolean;
};

const columnHelper = createColumnHelper<DossierRow>();

export function DossiersPage() {
  const [q, setQ] = useState('');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['dossiers', q],
    queryFn: async () =>
      (await api.get<DossierRow[]>('/dossiers', { params: { q: q || undefined } })).data,
  });

  const create = useMutation({
    mutationFn: async (payload: {
      data: Record<string, unknown>;
      photo?: File | null;
      passeport?: File | null;
      documentMedical?: File | null;
    }) => {
      const dossier = (
        await api.post<DossierRow>('/dossiers', payload.data)
      ).data;
      if (payload.photo && dossier.patient?.id) {
        const fd = new FormData();
        fd.append('file', payload.photo);
        await api.post(`/patients/${dossier.patient.id}/photo`, fd);
      }
      if (payload.passeport) {
        const fd = new FormData();
        fd.append('file', payload.passeport);
        await api.post(`/ged/${dossier.id}?categorie=IDENTITE`, fd);
      }
      if (payload.documentMedical) {
        const fd = new FormData();
        fd.append('file', payload.documentMedical);
        await api.post(`/ged/${dossier.id}?categorie=MEDICAL`, fd);
      }
      return dossier;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      setOpen(false);
      toast.success('Dossier créé');
    },
    onError: () => toast.error('Création impossible'),
  });

  const moveKanban = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) =>
      (await api.patch(`/dossiers/${id}/statut`, { statut })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      toast.success('Statut mis à jour');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Déplacement impossible'),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('numero', {
        header: 'N°',
        cell: (info) => (
          <Link className="font-semibold text-brand" to={`/dossiers/${info.row.original.id}`}>
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.display({
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) => {
          const p = row.original.patient;
          if (!p) return '—';
          return (
            <div className="flex items-center gap-2.5">
              <PatientAvatar
                patientId={p.id}
                photoProfil={p.photoProfil}
                prenom={p.prenom}
                nom={p.nom}
                size="sm"
              />
              <span>
                {p.prenom} {p.nom}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('destination', { header: 'Destination', cell: (i) => i.getValue() ?? '—' }),
      columnHelper.accessor('priorite', { header: 'Priorité' }),
      columnHelper.accessor('statut', {
        header: 'Statut',
        cell: (i) => (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              i.row.original.verrouille ? 'bg-warning/15 text-amber-700' : 'bg-brand/10 text-brand',
            )}
          >
            {STATUT_LABELS[i.getValue()] ?? i.getValue()}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const columnsKanban = ['EN_COURS', 'VALIDE', 'FACTURE_PAYE', 'VERROUILLE'] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dossiers</h1>
          <p className="text-sm text-muted">Pipeline MED-YYYY-XXXX</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[var(--border)] bg-surface p-1">
            <button
              type="button"
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', view === 'table' && 'bg-brand text-white')}
              onClick={() => setView('table')}
            >
              Tableau
            </button>
            <button
              type="button"
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', view === 'kanban' && 'bg-brand text-white')}
              onClick={() => setView('kanban')}
            >
              Kanban
            </button>
          </div>
          <Can module="dossiers" action="create">
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nouveau dossier
            </Button>
          </Can>
        </div>
      </div>

      <Input
        placeholder="Filtrer par n°, patient, destination…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {view === 'table' ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)] hover:bg-brand/[0.03]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    Aucun dossier
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {columnsKanban.map((col) => (
            <div
              key={col}
              className="rounded-2xl bg-surface p-3 shadow-soft border border-[var(--border)] min-h-[200px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/dossier-id');
                const from = e.dataTransfer.getData('text/statut');
                if (id && from !== col) {
                  moveKanban.mutate({ id, statut: col });
                }
              }}
            >
              <div className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-muted">
                {STATUT_LABELS[col]}
              </div>
              <div className="space-y-2">
                {data
                  .filter((d) => d.statut === col)
                  .map((d) => (
                    <div
                      key={d.id}
                      draggable={!d.verrouille}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/dossier-id', d.id);
                        e.dataTransfer.setData('text/statut', d.statut);
                      }}
                      className="rounded-xl border border-[var(--border)] bg-canvas p-3 transition-ui hover:border-brand/30 cursor-grab active:cursor-grabbing"
                    >
                      <Link to={`/dossiers/${d.id}`} className="font-semibold text-brand">
                        {d.numero}
                      </Link>
                      <div className="mt-1 text-sm">
                        {d.patient ? `${d.patient.prenom} ${d.patient.nom}` : 'Sans patient'}
                      </div>
                      <div className="mt-1 text-xs text-muted">{d.destination}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <CreateDossierWizard
          onClose={() => setOpen(false)}
          onSubmit={(payload) => create.mutate(payload)}
          loading={create.isPending}
        />
      )}
    </div>
  );
}
