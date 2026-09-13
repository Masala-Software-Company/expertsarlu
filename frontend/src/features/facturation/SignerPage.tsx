import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignerPage() {
  const { token = '' } = useParams();
  const [nom, setNom] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['signer', token],
    queryFn: async () => (await api.get(`/facturation/signer/${token}`)).data,
    enabled: !!token,
  });

  const signer = useMutation({
    mutationFn: async () =>
      (await api.post(`/facturation/signer/${token}`, { nom: nom.trim() })).data,
    onSuccess: () => {
      toast.success('Devis signé');
      void refetch();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Signature impossible'),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-md p-8"><div className="h-40 animate-pulse rounded-2xl bg-surface" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-extrabold">Lien invalide</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <p className="text-sm font-semibold text-brand">Signature électronique</p>
        <h1 className="mt-1 text-3xl font-extrabold">{data.numero}</h1>
        <p className="mt-1 text-muted">
          Dossier {data.dossier?.numero}
          {data.dossier?.patient
            ? ` — ${data.dossier.patient.prenom} ${data.dossier.patient.nom}`
            : ''}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
        <div className="text-sm text-muted">Montant</div>
        <div className="text-2xl font-extrabold text-brand">
          {formatMoney(Number(data.montantTotal), data.devise)}
        </div>
      </div>

      {data.signeLe ? (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">
          Déjà signé le {new Date(data.signeLe).toLocaleString('fr-FR')}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            signer.mutate();
          }}
        >
          <Input
            placeholder="Nom du signataire"
            required
            minLength={2}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={signer.isPending}>
            Signer le devis
          </Button>
        </form>
      )}
    </div>
  );
}
