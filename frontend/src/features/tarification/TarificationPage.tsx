import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Tarif = {
  id: string;
  cle: string;
  libelle: string;
  montant: string | number;
  unite?: string;
};

export function TarificationPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['tarifs'],
    queryFn: async () => (await api.get<Tarif[]>('/tarification')).data,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async ({ cle, montant }: { cle: string; montant: number }) =>
      (await api.patch(`/tarification/${cle}`, { montant })).data,
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['tarifs'] });
      setEditing(null);
      toast.success(`${vars.cle} mis à jour`);
    },
    onError: () => toast.error('Modification refusée'),
  });

  const cards = useMemo(() => data, [data]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Tarification</h1>
        <p className="mt-1 text-sm text-muted">
          Grille de base utilisée pour calculer les devis. Réservée au Super Admin — les autres
          rôles voient uniquement le résultat dans les dossiers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((t) => {
          const isEdit = editing === t.cle;
          const value = drafts[t.cle] ?? String(t.montant);
          return (
            <div
              key={t.id}
              className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{t.libelle}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t.unite ? `Par ${t.unite}` : 'Forfait'}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-brand"
                  onClick={() => {
                    setEditing(isEdit ? null : t.cle);
                    setDrafts((d) => ({ ...d, [t.cle]: String(t.montant) }));
                  }}
                  aria-label="Modifier"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              {!isEdit ? (
                <div className="mt-4 text-3xl font-extrabold tracking-tight text-brand">
                  {formatMoney(Number(t.montant))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2">
                  <Input
                    className="max-w-[140px]"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [t.cle]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ cle: t.cle, montant: Number(value) })
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    Sauver
                  </Button>
                </div>
              )}

              <div
                className={cn(
                  'mt-3 inline-flex rounded-full bg-canvas px-2.5 py-1 font-mono text-[10px] text-muted',
                )}
              >
                {t.cle}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && cards.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-10 text-center text-muted">
          Aucun tarif en base — lancez le seed Prisma.
        </div>
      )}
    </div>
  );
}
