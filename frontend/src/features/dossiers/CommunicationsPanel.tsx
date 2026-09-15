import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import {
  buildPatientOutreachMessage,
  mailtoPatientUrl,
  whatsappChatUrl,
} from '@/lib/patient-contact';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
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

type Props = {
  dossierId: string;
  locked: boolean;
  patient?: {
    prenom?: string;
    nom?: string;
    telephone?: string | null;
    email?: string | null;
  } | null;
  numeroDossier?: string;
  statut?: string;
};

export function CommunicationsPanel({
  dossierId,
  locked,
  patient,
  numeroDossier,
  statut,
}: Props) {
  const qc = useQueryClient();
  const defaultMsg = useMemo(
    () =>
      buildPatientOutreachMessage({
        prenom: patient?.prenom,
        nom: patient?.nom,
        numeroDossier,
        statut,
      }),
    [patient?.prenom, patient?.nom, numeroDossier, statut],
  );
  const [message, setMessage] = useState(defaultMsg);
  const [sujet, setSujet] = useState(
    numeroDossier ? `eXpert SARLU — Dossier ${numeroDossier}` : 'eXpert SARLU — Votre dossier',
  );
  const [note, setNote] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['communications', dossierId],
    queryFn: async () =>
      (await api.get<Comm[]>(`/communications/dossier/${dossierId}`)).data,
  });

  const logComm = useMutation({
    mutationFn: async (payload: { canal: string; sujet?: string; corps: string }) =>
      (
        await api.post(`/communications/dossier/${dossierId}`, {
          ...payload,
          sens: 'SORTANT',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['communications', dossierId] });
    },
  });

  const waUrl = whatsappChatUrl(patient?.telephone, message);
  const mailUrl = mailtoPatientUrl(patient?.email, {
    prenom: patient?.prenom,
    nom: patient?.nom,
    numeroDossier,
    statut,
    body: message,
    subject: sujet,
  });

  const openExternal = async (canal: 'WHATSAPP' | 'EMAIL', url: string | null) => {
    if (!url) {
      toast.error(
        canal === 'WHATSAPP'
          ? 'Aucun numéro WhatsApp sur le dossier'
          : 'Aucun e-mail patient sur le dossier',
      );
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    try {
      await logComm.mutateAsync({
        canal,
        sujet: canal === 'EMAIL' ? sujet : undefined,
        corps: message,
      });
      toast.success(
        canal === 'WHATSAPP'
          ? 'WhatsApp ouvert — message prérempli'
          : 'Client e-mail ouvert — message prérempli',
      );
    } catch {
      toast.message('Application ouverte (journal non enregistré)');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold">Communications</h3>
        <p className="text-sm text-muted">
          Pas d’envoi intégré : WhatsApp et e-mail s’ouvrent dans l’application du patient, avec un
          message modifiable.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <MessageSquare className="h-4 w-4" />
            Message au patient
          </div>
          <Input
            value={sujet}
            disabled={locked}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Objet e-mail"
          />
          <textarea
            className="min-h-[160px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm leading-relaxed"
            value={message}
            disabled={locked}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={locked}
              onClick={() => void openExternal('WHATSAPP', waUrl)}
              className="gap-2"
            >
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </Button>
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => void openExternal('EMAIL', mailUrl)}
              className="gap-2"
            >
              <Mail className="h-4 w-4" /> E-mail
            </Button>
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => setMessage(defaultMsg)}
            >
              Réinitialiser le texte
            </Button>
          </div>
          <p className="text-xs text-muted">
            Contact : {patient?.telephone || '—'} · {patient?.email || '—'}
          </p>
        </div>

        <Can module="dossiers" action="update">
          <form
            className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!note.trim()) return;
              logComm.mutate(
                { canal: 'INTERNE', corps: note },
                {
                  onSuccess: () => {
                    setNote('');
                    toast.success('Note interne enregistrée');
                  },
                  onError: () => toast.error('Enregistrement impossible'),
                },
              );
            }}
          >
            <div className="text-sm font-semibold">Note interne</div>
            <p className="text-xs text-muted">
              Journal d’équipe uniquement — n’ouvre pas WhatsApp ni la messagerie.
            </p>
            <textarea
              className="min-h-[100px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
              placeholder="Compte-rendu d’appel, rappel…"
              value={note}
              disabled={locked}
              onChange={(e) => setNote(e.target.value)}
              required
            />
            <Button type="submit" disabled={locked || logComm.isPending || !note.trim()}>
              Enregistrer la note
            </Button>
          </form>
        </Can>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-bold uppercase tracking-wide text-muted">Historique</h4>
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
