import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';

type Facture = {
  id: string;
  numero: string;
  type: string;
  statut: string;
  montantTotal: number | string;
  devise: string;
  pdfChemin?: string | null;
  signatureToken?: string | null;
  signeLe?: string | null;
  signeParNom?: string | null;
  paiements: { id: string; montant: number | string; methode: string }[];
};

export function FacturationPanel({ dossierId, locked }: { dossierId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [payMontant, setPayMontant] = useState('');
  const [payId, setPayId] = useState<string | null>(null);

  const { data: factures = [], isLoading } = useQuery({
    queryKey: ['factures', dossierId],
    queryFn: async () =>
      (await api.get<Facture[]>(`/facturation/dossier/${dossierId}`)).data,
  });

  const creerDevis = useMutation({
    mutationFn: async () => (await api.post(`/facturation/devis/${dossierId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      toast.success('Devis généré (PDF inclus)');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Impossible de créer le devis'),
  });

  const payer = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/facturation/paiements/${payId}`, {
          montant: Number(payMontant),
          methode: 'VIREMENT',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      void qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      setPayId(null);
      setPayMontant('');
      toast.success('Paiement enregistré');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Paiement refusé'),
  });

  const officielle = useMutation({
    mutationFn: async (factureId: string) =>
      (await api.post(`/facturation/factures/${factureId}/officielle`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      toast.success('Facture officielle générée');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Génération bloquée'),
  });

  const downloadPdf = async (factureId: string, numero: string) => {
    try {
      const { data } = await api.get(`/facturation/factures/${factureId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF indisponible');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Facturation</h3>
          <p className="text-sm text-muted">Devis, paiements et PDF officiels</p>
        </div>
        <Can module="facturation" action="create">
          <Button disabled={locked || creerDevis.isPending} onClick={() => creerDevis.mutate()}>
            <Plus className="h-4 w-4" /> Générer un devis
          </Button>
        </Can>
      </div>

      {isLoading && (
        <div className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-surface" />
      )}

      <div className="space-y-3">
        {factures.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-brand">{f.type}</div>
                <div className="mt-1 text-lg font-extrabold">{f.numero}</div>
                <div className="text-sm text-muted">
                  {f.statut}
                  {f.signeParNom ? ` · signé par ${f.signeParNom}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-brand">
                  {formatMoney(Number(f.montantTotal), f.devise)}
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {f.pdfChemin && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void downloadPdf(f.id, f.numero)}
                    >
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </Button>
                  )}
                  <Can module="facturation" action="create">
                    {f.type === 'DEVIS' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={locked}
                          onClick={() => {
                            setPayId(f.id);
                            setPayMontant(String(f.montantTotal));
                          }}
                        >
                          Encaisser
                        </Button>
                        <Button
                          size="sm"
                          disabled={locked || officielle.isPending}
                          onClick={() => officielle.mutate(f.id)}
                        >
                          Facture officielle
                        </Button>
                      </>
                    )}
                  </Can>
                </div>
              </div>
            </div>
            {f.signatureToken && !f.signeLe && (
              <p className="mt-2 text-xs text-muted">
                Lien signature :{' '}
                <code className="rounded bg-canvas px-1">/signer/{f.signatureToken}</code>
              </p>
            )}
            {f.paiements?.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
                {f.paiements.map((p) => (
                  <li key={p.id} className="flex justify-between text-muted">
                    <span>{p.methode}</span>
                    <span>{formatMoney(Number(p.montant))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {!isLoading && factures.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-8 text-center text-sm text-muted">
            Aucun devis / facture pour ce dossier
          </div>
        )}
      </div>

      {payId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-6 shadow-soft">
            <h4 className="font-bold">Enregistrer un paiement</h4>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={payMontant}
              onChange={(e) => setPayMontant(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPayId(null)}>
                Annuler
              </Button>
              <Button className="flex-1" disabled={payer.isPending} onClick={() => payer.mutate()}>
                Valider
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
