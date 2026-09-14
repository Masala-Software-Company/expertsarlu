import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';

type Partenaire = {
  id: string;
  nom: string;
  pays?: string | null;
  type?: string | null;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  notes?: string | null;
};

export function PartenairesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    pays: '',
    type: '',
    contact: '',
    email: '',
    telephone: '',
    notes: '',
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ['partenaires'],
    queryFn: async () => (await api.get<Partenaire[]>('/partenaires')).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post('/partenaires', {
          nom: form.nom.trim(),
          pays: form.pays.trim() || undefined,
          type: form.type.trim() || undefined,
          contact: form.contact.trim() || undefined,
          email: form.email.trim() || undefined,
          telephone: form.telephone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partenaires'] });
      setOpen(false);
      setForm({
        nom: '',
        pays: '',
        type: '',
        contact: '',
        email: '',
        telephone: '',
        notes: '',
      });
      toast.success('Partenaire ajouté');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      const text = Array.isArray(msg) ? msg.join(', ') : msg;
      toast.error(text || 'Création impossible');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/partenaires/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partenaires'] });
      toast.success('Partenaire désactivé');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      const text = Array.isArray(msg) ? msg.join(', ') : msg;
      toast.error(text || 'Suppression impossible');
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Partenaires</h1>
          <p className="text-sm text-muted">Hôpitaux, assureurs, ambassades, transporteurs</p>
        </div>
        <Can module="partenaires" action="create">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau partenaire
          </Button>
        </Can>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface shadow-soft" />
          ))}
        {data.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand" />
                <h2 className="font-bold">{p.nom}</h2>
              </div>
              <Can module="partenaires" action="update">
                <button
                  type="button"
                  className="text-muted hover:text-danger"
                  onClick={() => remove.mutate(p.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Can>
            </div>
            <p className="mt-2 text-sm text-muted">
              {[p.type, p.pays].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="mt-2 text-sm">
              {p.contact || p.email || p.telephone || 'Pas de contact'}
            </p>
            {p.notes && <p className="mt-2 text-xs text-muted">{p.notes}</p>}
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-muted">
            Aucun partenaire enregistré
          </div>
        )}
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
            <h3 className="text-lg font-bold">Nouveau partenaire</h3>
            <Input
              placeholder="Nom *"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <Input
              placeholder="Type (hôpital, assureur…)"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
            <Input
              placeholder="Pays"
              value={form.pays}
              onChange={(e) => setForm({ ...form, pays: e.target.value })}
            />
            <Input
              placeholder="Contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <Input
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              placeholder="Téléphone"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={create.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
