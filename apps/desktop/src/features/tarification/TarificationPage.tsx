import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';

type Tarif = { id: string; cle: string; libelle: string; montant: string | number; unite?: string };

export function TarificationPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ['tarifs'],
    queryFn: async () => (await api.get<Tarif[]>('/tarification')).data,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: async ({ cle, montant }: { cle: string; montant: number }) =>
      (await api.patch(`/tarification/${cle}`, { montant })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tarifs'] });
      toast.success('Tarif mis à jour');
    },
    onError: () => toast.error('Modification refusée'),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Tarification</h1>
        <p className="text-sm text-black/50">
          Grille de prix de base — réservée au Super Admin. Les autres rôles voient uniquement
          le résultat des calculs dans les devis.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-black/40">
            <tr>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Clé</th>
              <th className="px-4 py-3">Montant (USD)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">
                  {t.libelle}
                  {t.unite && <span className="ml-1 text-black/40">/ {t.unite}</span>}
                </td>
                <td className="px-4 py-3 text-black/45 font-mono text-xs">{t.cle}</td>
                <td className="px-4 py-3">
                  <Input
                    className="w-28"
                    value={drafts[t.cle] ?? String(t.montant)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [t.cle]: e.target.value }))
                    }
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        cle: t.cle,
                        montant: Number(drafts[t.cle] ?? t.montant),
                      })
                    }
                  >
                    Enregistrer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-black/40">
        Exemple affiché : accompagnateur {formatMoney(350)} · navette {formatMoney(70)}
      </p>
    </div>
  );
}
