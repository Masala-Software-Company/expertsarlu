import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';

type Prospect = {
  id: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  sourceContact?: string;
  statut: string;
};

const STATUT_LABEL: Record<string, string> = {
  NOUVEAU: 'Nouveau',
  EN_DISCUSSION: 'En discussion',
  CONVERTI: 'Converti',
  PERDU: 'Perdu',
};

export function ProspectsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', sourceContact: 'WhatsApp' });

  const { data = [], isLoading } = useQuery({
    queryKey: ['prospects'],
    queryFn: async () => (await api.get<Prospect[]>('/prospects')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/prospects', form)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prospects'] });
      setForm({ nom: '', prenom: '', telephone: '', sourceContact: 'WhatsApp' });
      toast.success('Prospect enregistré');
    },
    onError: () => toast.error('Création impossible'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Prospects</h1>
        <p className="text-sm text-muted">Onboarding — premiers contacts avant dossier MED</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft md:grid-cols-4">
        <Input
          placeholder="Nom"
          value={form.nom}
          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
        />
        <Input
          placeholder="Prénom"
          value={form.prenom}
          onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
        />
        <Input
          placeholder="Téléphone"
          value={form.telephone}
          onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
        />
        <Button disabled={!form.nom || create.isPending} onClick={() => create.mutate()}>
          Ajouter
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm text-ink">
          <thead className="bg-canvas text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium">
                  {p.prenom} {p.nom}
                </td>
                <td className="px-4 py-3 text-muted">{p.telephone ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{p.sourceContact ?? '—'}</td>
                <td className="px-4 py-3">{STATUT_LABEL[p.statut] ?? p.statut}</td>
              </tr>
            ))}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted">
                  Aucun prospect — ajoutez le premier contact.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
