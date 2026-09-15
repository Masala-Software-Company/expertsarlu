import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, X } from 'lucide-react';
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
  adresse?: string | null;
  logoChemin?: string | null;
  _count?: { patients?: number; preInscriptions?: number };
};

const emptyForm = {
  nom: '',
  pays: '',
  type: '',
  contact: '',
  email: '',
  telephone: '',
  notes: '',
  adresse: '',
  logoDataUrl: '',
};

export function PartenairesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Partenaire | null>(null);
  const [form, setForm] = useState(emptyForm);

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
          adresse: form.adresse.trim() || undefined,
          logoChemin: form.logoDataUrl || undefined,
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partenaires'] });
      setOpen(false);
      setForm(emptyForm);
      toast.success('Partenaire ajouté');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Création impossible');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/partenaires/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partenaires'] });
      setSelected(null);
      toast.success('Partenaire désactivé');
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
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className="rounded-2xl border border-[var(--border)] bg-surface p-5 text-left shadow-soft transition-ui hover:border-brand/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {p.logoChemin ? (
                  <img
                    src={p.logoChemin.startsWith('http') || p.logoChemin.startsWith('data:') ? p.logoChemin : p.logoChemin}
                    alt=""
                    className="h-10 w-10 rounded-lg object-contain bg-canvas"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h2 className="font-bold">{p.nom}</h2>
                  <p className="text-xs text-muted">{[p.type, p.pays].filter(Boolean).join(' · ') || '—'}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              {p.contact ? `Contact : ${p.contact}` : 'Pas de personne à contacter'}
            </p>
          </button>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-muted">
            Aucun partenaire enregistré
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {selected.logoChemin ? (
                  <img src={selected.logoChemin} alt="" className="h-14 w-14 rounded-xl object-contain bg-canvas" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-extrabold">{selected.nom}</h3>
                  <p className="text-sm text-muted">{selected.type || 'Partenaire'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-muted hover:bg-canvas">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Pays" value={selected.pays} />
              <Detail label="Adresse" value={selected.adresse} />
              <Detail label="Personne à contacter" value={selected.contact} />
              <Detail label="E-mail" value={selected.email} />
              <Detail label="Téléphone" value={selected.telephone} />
              <Detail
                label="Patients liés"
                value={
                  selected._count?.patients != null ? String(selected._count.patients) : '—'
                }
              />
            </dl>
            {selected.notes && (
              <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-muted">{selected.notes}</p>
            )}
            <div className="flex justify-end gap-2">
              <Can module="partenaires" action="update">
                <Button
                  variant="danger"
                  onClick={() => remove.mutate(selected.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" /> Désactiver
                </Button>
              </Can>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-2xl bg-surface p-6 shadow-soft"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <h3 className="text-lg font-bold">Nouveau partenaire</h3>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-canvas px-4 py-5">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="" className="h-16 w-16 object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-brand" />
              )}
              <span className="text-xs font-semibold text-brand">Ajouter le logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setForm((f) => ({ ...f, logoDataUrl: String(reader.result || '') }));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
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
              placeholder="Adresse"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />
            <Input
              placeholder="Personne à contacter"
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

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  );
}
