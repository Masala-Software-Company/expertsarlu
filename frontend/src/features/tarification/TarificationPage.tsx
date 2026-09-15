import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FormEvent, useMemo, useState } from 'react';
import { Plus, Pencil, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Tarif = {
  id: string;
  cle: string;
  libelle: string;
  montant: string | number;
  unite?: string | null;
  reference?: string | null;
};

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

export function TarificationPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['tarifs'],
    queryFn: async () => (await api.get<Tarif[]>('/tarification')).data,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    libelle: '',
    reference: '',
    montant: '',
    unite: 'forfait',
  });

  const update = useMutation({
    mutationFn: async ({ cle, montant }: { cle: string; montant: number }) =>
      (await api.patch(`/tarification/${cle}`, { montant })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tarifs'] });
      setEditing(null);
      toast.success('Tarif mis à jour');
    },
    onError: () => toast.error('Modification refusée'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const libelle = form.libelle.trim();
      const reference = (form.reference.trim() || slugify(libelle)).toUpperCase();
      return (
        await api.post('/tarification', {
          libelle,
          reference,
          cle: slugify(libelle) || `tarif_${Date.now()}`,
          montant: Number(form.montant),
          unite: form.unite || undefined,
        })
      ).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tarifs'] });
      setOpen(false);
      setForm({ libelle: '', reference: '', montant: '', unite: 'forfait' });
      toast.success('Tarif créé');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Création impossible'),
  });

  const cards = useMemo(() => data, [data]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tarification</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Grille commerciale eXpert — chaque tarif a un libellé clair et une référence
            utilisable dans les dossiers patients.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nouveau tarif
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Unité</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((t) => {
              const isEdit = editing === t.cle;
              const value = drafts[t.cle] ?? String(t.montant);
              return (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold">{t.libelle}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-brand/10 px-2 py-1 text-xs font-bold text-brand">
                      {t.reference || t.cle.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {t.unite ? `Par ${t.unite}` : 'Forfait'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isEdit ? (
                      <span className="text-base font-extrabold text-brand">
                        {formatMoney(Number(t.montant))}
                      </span>
                    ) : (
                      <Input
                        className="ml-auto max-w-[120px] text-right"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setDrafts((d) => ({ ...d, [t.cle]: e.target.value }))}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!isEdit ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-brand"
                          onClick={() => {
                            setEditing(t.cle);
                            setDrafts((d) => ({ ...d, [t.cle]: String(t.montant) }));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ cle: t.cle, montant: Number(value) })}
                        >
                          <Check className="h-3.5 w-3.5" /> Sauver
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && cards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Aucun tarif — créez le premier via le bouton ci-dessus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            <h3 className="text-lg font-bold">Nouveau tarif</h3>
            <Input
              required
              placeholder="Libellé (ex. Assurance / jour ≤ 30 j)"
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            />
            <Input
              placeholder="Référence (ex. ASS-J30) — optionnel"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
            <Input
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="Montant USD"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
            />
            <Input
              placeholder="Unité (jour, forfait, trajet…)"
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
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
