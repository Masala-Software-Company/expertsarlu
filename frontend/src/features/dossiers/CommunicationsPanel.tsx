import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';

type Comm = {
  id: string;
  canal: string;
  sens: string;
  sujet?: string | null;
  corps: string;
  auteurNom?: string | null;
  creeLe: string;
};

export function CommunicationsPanel({
  dossierId,
  locked,
}: {
  dossierId: string;
  locked: boolean;
}) {
  const qc = useQueryClient();
  const [canal, setCanal] = useState('INTERNE');
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['communications', dossierId],
    queryFn: async () =>
      (await api.get<Comm[]>(`/communications/dossier/${dossierId}`)).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/communications/dossier/${dossierId}`, {
          canal,
          sujet: sujet || undefined,
          corps,
          sens: 'SORTANT',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['communications', dossierId] });
      setSujet('');
      setCorps('');
      toast.success(
        canal === 'EMAIL' || canal === 'WHATSAPP'
          ? 'Message journalisé (envoi stub)'
          : 'Note enregistrée',
      );
    },
    onError: () => toast.error('Envoi impossible'),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold">Communications</h3>
        <p className="text-sm text-muted">Journal email / WhatsApp / notes internes</p>
      </div>

      <Can module="dossiers" action="update">
        <form
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!corps.trim()) return;
            create.mutate();
          }}
        >
          <div className="flex flex-wrap gap-2">
            {['INTERNE', 'EMAIL', 'WHATSAPP', 'APPEL'].map((c) => (
              <button
                key={c}
                type="button"
                disabled={locked}
                onClick={() => setCanal(c)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  canal === c ? 'bg-brand text-white' : 'bg-canvas text-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <Input
            placeholder="Sujet (optionnel)"
            value={sujet}
            disabled={locked}
            onChange={(e) => setSujet(e.target.value)}
          />
          <textarea
            className="min-h-[90px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
            placeholder="Message…"
            value={corps}
            disabled={locked}
            onChange={(e) => setCorps(e.target.value)}
            required
          />
          <Button type="submit" disabled={locked || create.isPending || !corps.trim()}>
            Enregistrer
          </Button>
        </form>
      </Can>

      <div className="space-y-2">
        {isLoading && <div className="h-16 animate-pulse rounded-xl bg-surface" />}
        {data.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[var(--border)] bg-surface px-4 py-3 shadow-soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="font-bold text-brand">
                {c.canal} · {c.sens}
              </span>
              <span>
                {format(new Date(c.creeLe), 'dd MMM yyyy HH:mm', { locale: fr })}
                {c.auteurNom ? ` · ${c.auteurNom}` : ''}
              </span>
            </div>
            {c.sujet && <div className="mt-1 text-sm font-semibold">{c.sujet}</div>}
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.corps}</p>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <p className="text-sm text-muted">Aucune communication pour l’instant</p>
        )}
      </div>
    </div>
  );
}
