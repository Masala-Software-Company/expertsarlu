import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';

type Rdv = {
  id: string;
  type: string;
  dateHeure: string;
  lieu?: string;
  statut: string;
  dossier?: { numero: string; patient?: { nom: string; prenom: string } };
  assigneA?: { nom: string };
};

export function LogistiquePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
      toast.success('Rendez-vous créé');
    },
    onError: () => toast.error('Création impossible'),
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Protocole — Planning</h1>
          <p className="text-sm text-muted">
            Navettes et rendez-vous du jour (interface terrain)
          </p>
        </div>
        <Can module="logistique" action="create">
          <Button onClick={() => setOpen(true)}>Nouveau RDV</Button>
        </Can>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-surface shadow-soft" />
        )}
        {!isLoading && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-muted">
            Aucun rendez-vous aujourd’hui
          </div>
        )}
        {data.map((r) => (
          <button
            key={r.id}
            type="button"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-surface p-5 text-left text-ink shadow-soft transition-ui hover:border-brand/40 active:scale-[0.99]"
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-brand">{r.type}</div>
              <div className="mt-1 text-lg font-extrabold">
                {format(new Date(r.dateHeure), 'HH:mm', { locale: fr })}
                {r.lieu ? ` · ${r.lieu}` : ''}
              </div>
              <div className="mt-1 text-sm text-muted">
                {r.dossier?.numero}
                {r.dossier?.patient
                  ? ` — ${r.dossier.patient.prenom} ${r.dossier.patient.nom}`
                  : ''}
              </div>
            </div>
            <div className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted">
              {r.statut}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-6 shadow-soft"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <h3 className="text-lg font-bold">Nouveau rendez-vous</h3>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {['NAVETTE', 'AMBASSADE', 'HOPITAL'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
            <Input
              placeholder="ID dossier (optionnel)"
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={create.isPending}>
                Créer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
