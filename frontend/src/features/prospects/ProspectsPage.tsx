import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, MessageCircle, Search, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Prospect = {
  id: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  sourceContact?: string;
  statut: string;
};

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

const STATUT_LABEL: Record<string, string> = {
  NOUVEAU: 'Nouveau',
  EN_DISCUSSION: 'En discussion',
  CONVERTI: 'Converti',
  PERDU: 'Perdu',
};

function canalLabel(canal: string) {
  if (canal === 'WHATSAPP') return 'WhatsApp';
  if (canal === 'EMAIL') return 'E-mail';
  return canal;
}

export function ProspectsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'messages' ? 'messages' : 'prospects';
  const setTab = (t: 'prospects' | 'messages') => {
    const next = new URLSearchParams(params);
    if (t === 'prospects') next.delete('tab');
    else next.set('tab', 'messages');
    setParams(next, { replace: true });
  };

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    sourceContact: 'WhatsApp',
  });
  const [linkId, setLinkId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<DossierOption | null>(null);

  const { data: prospects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['prospects'],
    queryFn: async () => (await api.get<Prospect[]>('/prospects')).data,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get<Msg[]>('/inbox')).data,
    enabled: tab === 'messages' || !!linkId,
  });

  const unreadMessages = messages.filter((m) => !m.dossierId).length;

  const { data: dossiers = [], isFetching: searching } = useQuery({
    queryKey: ['inbox-dossiers', q],
    queryFn: async () =>
      (await api.get<DossierOption[]>('/dossiers', { params: { q: q || undefined } })).data,
    enabled: !!linkId,
  });

  const options = useMemo(() => dossiers.slice(0, 12), [dossiers]);

  const create = useMutation({
    mutationFn: async () => (await api.post('/prospects', form)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prospects'] });
      setForm({
        nom: '',
        prenom: '',
        telephone: '',
        email: '',
        sourceContact: 'WhatsApp',
      });
      toast.success('Prospect enregistré');
    },
    onError: () => toast.error('Création impossible'),
  });

  const lier = useMutation({
    mutationFn: async () => {
      if (!linkId || !selected) throw new Error('missing');
      return (await api.post(`/inbox/${linkId}/lier/${selected.id}`)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      toast.success(
        selected ? `Message rattaché à ${selected.numero}` : 'Message rattaché',
      );
      setLinkId(null);
      setSelected(null);
      setQ('');
    },
    onError: () => toast.error('Impossible de rattacher ce message'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted">
          Premiers contacts, prospects et messages à rattacher aux dossiers
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-[var(--border)] bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab('prospects')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-ui',
            tab === 'prospects' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas',
          )}
        >
          Prospects
        </button>
        <button
          type="button"
          onClick={() => setTab('messages')}
          className={cn(
            'relative rounded-lg px-4 py-2 text-sm font-semibold transition-ui',
            tab === 'messages' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas',
          )}
        >
          Messages
          {unreadMessages > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] text-white">
              {unreadMessages}
            </span>
          )}
        </button>
      </div>

      {tab === 'prospects' && (
        <>
          <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft md:grid-cols-5">
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
            <Input
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Button disabled={!form.nom || create.isPending} onClick={() => create.mutate()}>
              <UserPlus className="h-4 w-4" /> Ajouter
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
                {prospects.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">
                      {p.prenom} {p.nom}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {[p.telephone, p.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.sourceContact ?? '—'}</td>
                    <td className="px-4 py-3">{STATUT_LABEL[p.statut] ?? p.statut}</td>
                  </tr>
                ))}
                {!loadingProspects && prospects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted">
                      Aucun prospect — ajoutez le premier contact.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'messages' && (
        <div className="space-y-2">
          {loadingMessages && <div className="h-20 animate-pulse rounded-2xl bg-surface" />}
          {messages.map((m) => (
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
          {!loadingMessages && messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center">
              <Mail className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 font-semibold">Aucun message pour le moment</p>
              <p className="mt-1 text-sm text-muted">
                Les e-mails et WhatsApp entrants s’afficheront ici pour être rattachés à un
                dossier.
              </p>
            </div>
          )}
        </div>
      )}

      {linkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-soft">
            <div>
              <h3 className="text-lg font-bold">Rattacher à un dossier</h3>
              <p className="mt-1 text-sm text-muted">
                Recherchez par numéro MED, nom du patient ou destination
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
                <li className="px-3 py-4 text-center text-sm text-muted">Aucun dossier trouvé</li>
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
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setLinkId(null);
                  setSelected(null);
                  setQ('');
                }}
              >
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
