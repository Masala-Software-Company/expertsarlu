import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, MessageCircle, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

type DossierOption = {
  id: string;
  numero: string;
  patient?: { prenom: string; nom: string } | null;
  destination?: string | null;
};

function canalLabel(canal: string) {
  if (canal === 'WHATSAPP') return 'WhatsApp';
  if (canal === 'EMAIL') return 'E-mail';
  return canal;
}

export function InboxPage() {
  const qc = useQueryClient();
  const [linkId, setLinkId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<DossierOption | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get<Msg[]>('/inbox')).data,
  });

  const { data: dossiers = [], isFetching: searching } = useQuery({
    queryKey: ['inbox-dossiers', q],
    queryFn: async () =>
      (await api.get<DossierOption[]>('/dossiers', { params: { q: q || undefined } })).data,
    enabled: !!linkId,
  });

  const options = useMemo(() => dossiers.slice(0, 12), [dossiers]);

  const lier = useMutation({
    mutationFn: async () => {
      if (!linkId || !selected) throw new Error('missing');
      return (await api.post(`/inbox/${linkId}/lier/${selected.id}`)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      if (selected) {
        void qc.invalidateQueries({ queryKey: ['communications', selected.id] });
      }
      setLinkId(null);
      setSelected(null);
      setQ('');
      toast.success(
        selected
          ? `Message rattaché à ${selected.numero}`
          : 'Message rattaché au dossier',
      );
    },
    onError: () => toast.error('Impossible de rattacher ce message'),
  });

  const closeLink = () => {
    setLinkId(null);
    setSelected(null);
    setQ('');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Messages</h1>
        <p className="text-sm text-muted">
          E-mails et WhatsApp reçus — rattachez-les au bon dossier patient
        </p>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="h-20 animate-pulse rounded-2xl bg-surface" />}
        {data.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand">
                  {m.canal === 'WHATSAPP' ? (
                    <MessageCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {canalLabel(m.canal)} · {m.fromAddr}
                </div>
                <div className="mt-1 font-semibold">{m.sujet || 'Sans objet'}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.corps}</p>
                <div className="mt-2 text-xs text-muted">
                  {format(new Date(m.creeLe), 'dd MMM yyyy HH:mm', { locale: fr })}
                  {m.dossierId && (
                    <>
                      {' · '}
                      <Link
                        to={`/dossiers/${m.dossierId}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        Voir le dossier
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {!m.dossierId && (
                <Button size="sm" variant="secondary" onClick={() => setLinkId(m.id)}>
                  Rattacher à un dossier
                </Button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-semibold">Aucun message pour le moment</p>
            <p className="mt-1 text-sm text-muted">
              Les e-mails et messages WhatsApp entrants s’afficheront ici automatiquement.
            </p>
          </div>
        )}
      </div>

      {linkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-soft">
            <div>
              <h3 className="text-lg font-bold">Rattacher à un dossier</h3>
              <p className="mt-1 text-sm text-muted">
                Recherchez par numéro (MED-…), nom du patient ou destination
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                autoFocus
                placeholder="Ex. MED-2026-0002 ou Yanis"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
              />
            </div>
            <ul className="max-h-56 space-y-1 overflow-auto rounded-xl border border-[var(--border)]">
              {searching && (
                <li className="px-3 py-4 text-center text-sm text-muted">Recherche…</li>
              )}
              {!searching && options.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-muted">
                  Aucun dossier trouvé
                </li>
              )}
              {options.map((d) => {
                const label = d.patient
                  ? `${d.patient.prenom} ${d.patient.nom}`
                  : 'Sans patient';
                const active = selected?.id === d.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2.5 text-left text-sm transition-ui hover:bg-brand/10 ${
                        active ? 'bg-brand/15' : ''
                      }`}
                      onClick={() => setSelected(d)}
                    >
                      <div className="font-semibold text-brand">{d.numero}</div>
                      <div className="text-muted">
                        {label}
                        {d.destination ? ` · ${d.destination}` : ''}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected && (
              <p className="text-sm">
                Sélection : <strong>{selected.numero}</strong>
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeLink}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={!selected || lier.isPending}
                onClick={() => lier.mutate()}
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
