import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Item = {
  id: string;
  numero: string;
  supprimeLe?: string;
  supprimePar?: { nom: string };
  patient?: { nom: string; prenom: string };
};

export function CorbeillePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const [hardId, setHardId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');

  const { data = [] } = useQuery({
    queryKey: ['corbeille'],
    queryFn: async () => (await api.get<Item[]>('/dossiers/corbeille')).data,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/dossiers/${id}/restaurer`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['corbeille'] });
      toast.success('Dossier restauré');
    },
  });

  const hardDelete = useMutation({
    mutationFn: async ({ id, confirmationNumero }: { id: string; confirmationNumero: string }) =>
      (await api.delete(`/dossiers/${id}/definitif`, { data: { confirmationNumero } })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['corbeille'] });
      setHardId(null);
      setConfirm('');
      toast.success('Suppression définitive effectuée');
    },
    onError: () => toast.error('Confirmation incorrecte'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Corbeille</h1>
        <p className="text-sm text-black/50">
          Dossiers en ARCHIVE_SUPPRIME — rétention 90 jours. Suppression définitive réservée au
          Super Admin.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-black/40">
            <tr>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Supprimé le</th>
              <th className="px-4 py-3">Par</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-semibold text-brand">{d.numero}</td>
                <td className="px-4 py-3">
                  {d.patient ? `${d.patient.prenom} ${d.patient.nom}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {d.supprimeLe
                    ? format(new Date(d.supprimeLe), 'dd MMM yyyy HH:mm', { locale: fr })
                    : '—'}
                </td>
                <td className="px-4 py-3">{d.supprimePar?.nom ?? '—'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => restore.mutate(d.id)}>
                        Restaurer
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setHardId(d.id)}>
                        Supprimer définitivement
                      </Button>
                    </>
                  )}
                  {!isAdmin && (
                    <span className="text-xs text-black/40">Lecture seule</span>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-black/40">
                  Corbeille vide
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
            <h3 className="text-lg font-bold">Suppression irréversible</h3>
            <p className="mt-2 text-sm text-black/60">
              Tapez le numéro exact du dossier pour confirmer.
            </p>
            <Input
              className="mt-4"
              placeholder="MED-YYYY-XXXX"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setHardId(null);
                  setConfirm('');
                }}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={!confirm}
                onClick={() =>
                  hardDelete.mutate({ id: hardId, confirmationNumero: confirm })
                }
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
