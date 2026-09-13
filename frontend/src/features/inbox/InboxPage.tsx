import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';

type Msg = {
  id: string;
  canal: string;
  fromAddr: string;
  sujet?: string | null;
  corps: string;
  dossierId?: string | null;
  lu: boolean;
  creeLe: string;
};

export function InboxPage() {
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useState('');
  const [linkId, setLinkId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get<Msg[]>('/inbox')).data,
  });

  const stub = useMutation({
    mutationFn: async () =>
      (
        await api.post('/inbox/stub', {
          canal: 'EMAIL',
          from: 'patient@example.com',
          sujet: 'Demande de suivi',
          corps: 'Bonjour, pouvez-vous me confirmer mon rendez-vous ?',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      toast.success('Message stub reçu');
    },
  });

  const lier = useMutation({
    mutationFn: async () =>
      (await api.post(`/inbox/${linkId}/lier/${dossierId.trim()}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      setLinkId(null);
      setDossierId('');
      toast.success('Rattaché au dossier');
    },
    onError: () => toast.error('Rattachement impossible'),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted">
            Boîte unifiée e-mail / WhatsApp (réception stub — providers à brancher)
          </p>
        </div>
        <Can module="dossiers" action="read">
          <Button variant="secondary" onClick={() => stub.mutate()} disabled={stub.isPending}>
            Simuler un e-mail
          </Button>
        </Can>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="h-20 animate-pulse rounded-2xl bg-surface" />}
        {data.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase text-brand">
                  {m.canal} · {m.fromAddr}
                </div>
                <div className="mt-1 font-semibold">{m.sujet || '(sans sujet)'}</div>
                <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{m.corps}</p>
                <div className="mt-2 text-xs text-muted">
                  {format(new Date(m.creeLe), 'dd MMM yyyy HH:mm', { locale: fr })}
                  {m.dossierId ? ` · dossier ${m.dossierId}` : ''}
                </div>
              </div>
              {!m.dossierId && (
                <Button size="sm" variant="secondary" onClick={() => setLinkId(m.id)}>
                  Lier à un dossier
                </Button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-muted">
            Inbox vide
          </div>
        )}
      </div>

      {linkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-6">
            <h3 className="font-bold">ID du dossier</h3>
            <Input
              value={dossierId}
              onChange={(e) => setDossierId(e.target.value)}
              placeholder="cuid du dossier"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setLinkId(null)}>
                Annuler
              </Button>
              <Button className="flex-1" disabled={!dossierId.trim() || lier.isPending} onClick={() => lier.mutate()}>
                Lier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
