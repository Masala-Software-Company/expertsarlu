import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';
import { labelOf, RDV_STATUT_LABELS, RDV_TYPE_LABELS } from '@/lib/status-labels';

type Rdv = {
  id: string;
  type: string;
  dateHeure: string;
  lieu?: string;
  statut: string;
  dossier?: { id: string; numero: string; patient?: { nom: string; prenom: string } };
  assigneA?: { nom: string };
};

type DossierOpt = {
  id: string;
  numero: string;
  patient?: { nom: string; prenom: string };
};

export function LogistiquePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [patientQ, setPatientQ] = useState('');
  const [form, setForm] = useState({
    type: 'NAVETTE',
    dateHeure: '',
    lieu: '',
    dossierId: '',
    notes: '',
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ['planning'],
    queryFn: async () => (await api.get<Rdv[]>('/logistique/planning')).data,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers-rdv'],
    queryFn: async () => (await api.get<DossierOpt[]>('/dossiers')).data,
    enabled: open,
  });

  const filteredDossiers = useMemo(() => {
    const n = patientQ.trim().toLowerCase();
    if (!n) return dossiers.slice(0, 40);
    return dossiers
      .filter((d) => {
        const name = `${d.patient?.prenom ?? ''} ${d.patient?.nom ?? ''} ${d.numero}`.toLowerCase();
        return name.includes(n);
      })
      .slice(0, 40);
  }, [dossiers, patientQ]);

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post('/logistique/rendez-vous', {
          type: form.type,
          dateHeure: new Date(form.dateHeure).toISOString(),
          lieu: form.lieu || undefined,
          dossierId: form.dossierId || undefined,
          notes: form.notes || undefined,
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning'] });
      setOpen(false);
      setForm({ type: 'NAVETTE', dateHeure: '', lieu: '', dossierId: '', notes: '' });
      setPatientQ('');
      toast.success('Rendez-vous créé');
    },
    onError: () => toast.error('Création impossible'),
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Protocole</h1>
          <p className="text-sm text-muted">
            Planning terrain — navettes, ambassade et hôpital
          </p>
        </div>
        <Can module="logistique" action="create">
          <Button onClick={() => setOpen(true)}>Nouveau rendez-vous</Button>
        </Can>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-surface" />
          ))}
        {!isLoading && data.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-surface p-12 text-center text-muted">
            Aucun rendez-vous aujourd’hui
          </div>
        )}
        {data.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft transition-ui hover:border-brand/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wide text-brand">
                {labelOf(RDV_TYPE_LABELS, r.type)}
              </div>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">
                {labelOf(RDV_STATUT_LABELS, r.statut)}
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">
              {format(new Date(r.dateHeure), 'HH:mm', { locale: fr })}
            </div>
            <div className="mt-1 text-sm text-muted">{r.lieu || 'Lieu non précisé'}</div>
            <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
              <div className="font-semibold">
                {r.dossier?.patient
                  ? `${r.dossier.patient.prenom} ${r.dossier.patient.nom}`
                  : 'Patient non lié'}
              </div>
              <div className="text-xs text-muted">{r.dossier?.numero ?? '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-lg space-y-3 rounded-2xl bg-surface p-6 shadow-soft"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <h3 className="text-lg font-bold">Nouveau rendez-vous</h3>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Type</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(RDV_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              type="datetime-local"
              required
              value={form.dateHeure}
              onChange={(e) => setForm({ ...form, dateHeure: e.target.value })}
            />
            <Input
              placeholder="Lieu"
              value={form.lieu}
              onChange={(e) => setForm({ ...form, lieu: e.target.value })}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Patient / dossier</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un patient ou un n° MED…"
                  value={patientQ}
                  onChange={(e) => setPatientQ(e.target.value)}
                />
              </div>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
                value={form.dossierId}
                onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
                required
              >
                <option value="">Choisir un patient…</option>
                {filteredDossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.patient
                      ? `${d.patient.prenom} ${d.patient.nom} — ${d.numero}`
                      : d.numero}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={create.isPending || !form.dossierId}>
                Créer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
