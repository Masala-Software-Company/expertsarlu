import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Trash2, Link2, Unlock, Copy, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUT_LABELS, formatMoney, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can, usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/features/auth/auth-store';
import { PatientAvatar } from '@/components/PatientAvatar';
import { GedDocumentsPanel } from './GedDocumentsPanel';
import { FacturationPanel } from './FacturationPanel';
import { CommunicationsPanel } from './CommunicationsPanel';

type Tab =
  | 'infos'
  | 'cotation'
  | 'facturation'
  | 'documents'
  | 'logistique'
  | 'communications'
  | 'postretour';

export function DossierDetailPage() {
  const { id = '' } = useParams();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('infos');
  const [jours, setJours] = useState(30);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [postStatut, setPostStatut] = useState('EN_ATTENTE');
  const [postNotes, setPostNotes] = useState('');
  const [suiviUrl, setSuiviUrl] = useState<string | null>(null);
  const qc = useQueryClient();
  const canFinance = usePermission('cotation', 'read');
  const canFactu = usePermission('facturation', 'read');

  const { data: dossier, isLoading } = useQuery({
    queryKey: ['dossier', id],
    queryFn: async () => (await api.get(`/dossiers/${id}`)).data,
    enabled: !!id,
  });

  const { data: cotation } = useQuery({
    queryKey: ['cotation', id],
    queryFn: async () => (await api.get(`/cotation/${id}`)).data,
    enabled: !!id && canFinance,
  });

  const validate = useMutation({
    mutationFn: async () => (await api.post(`/dossiers/${id}/valider`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success('Dossier validé et verrouillé');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Validation impossible'),
  });

  const softDelete = useMutation({
    mutationFn: async () => (await api.delete(`/dossiers/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res.message ?? 'Déplacé vers la corbeille');
      setConfirmDelete(false);
    },
  });

  const unlockReq = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/dossiers/${id}/demande-deverrouillage`, {
          motif: 'Correction nécessaire sur la cotation / informations patient',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success(
        isSuperAdmin ? 'Dossier déverrouillé' : 'Demande envoyée au Super Admin',
      );
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Action impossible'),
  });

  const unlockDirect = useMutation({
    mutationFn: async () => (await api.post(`/dossiers/${id}/deverrouiller`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success('Dossier déverrouillé');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Déverrouillage impossible'),
  });

  const recalcul = useMutation({
    mutationFn: async () =>
      (await api.post(`/cotation/${id}/recalculer`, { joursAssurance: jours })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cotation', id] });
      toast.success('Cotation recalculée');
    },
  });

  const addNavette = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/cotation/${id}/lignes`, {
          type: 'NAVETTE',
          description: 'Navette aéroport',
          montant: 70,
          quantite: 1,
        })
      ).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cotation', id] }),
  });

  const suiviLink = useMutation({
    mutationFn: async () =>
      (await api.post(`/dossiers/${id}/suivi-token`)).data as { token: string; url: string },
    onSuccess: (res) => {
      const full = `${window.location.origin}/suivi/${res.token}`;
      setSuiviUrl(full);
      void navigator.clipboard?.writeText(full).catch(() => undefined);
      toast.success('Lien de suivi prêt');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(
        e.response?.data?.message ??
          'Impossible de créer le lien — redéployez le backend si l’API est ancienne.',
      ),
  });

  const savePostRetour = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/dossiers/${id}/post-retour`, {
          postRetourStatut: postStatut,
          postRetourNotes: postNotes || undefined,
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success('Post-retour mis à jour');
    },
  });

  const createTache = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/logistique/taches/${id}`, {
          type: 'NAVETTE',
          titre: 'Navette aéroport',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success('Tâche créée');
    },
  });

  const tabs = useMemo(() => {
    const all: { id: Tab; label: string; hide?: boolean }[] = [
      { id: 'infos', label: 'Informations' },
      { id: 'cotation', label: 'Cotation', hide: !canFinance },
      { id: 'facturation', label: 'Facturation', hide: !canFactu },
      { id: 'documents', label: 'Documents' },
      { id: 'logistique', label: 'Logistique' },
      { id: 'communications', label: 'Communications' },
      { id: 'postretour', label: 'Post-retour' },
    ];
    return all.filter((t) => !t.hide);
  }, [canFinance, canFactu]);

  if (isLoading || !dossier) {
    return <div className="animate-pulse h-40 rounded-2xl bg-surface shadow-soft" />;
  }

  const locked =
    dossier.verrouille || ['VALIDE', 'FACTURE_PAYE', 'VERROUILLE'].includes(dossier.statut);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/dossiers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
            <ArrowLeft className="h-4 w-4" /> Dossiers
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{dossier.numero}</h1>
          <div className="mt-2 flex items-center gap-3">
            {dossier.patient && (
              <PatientAvatar
                patientId={dossier.patient.id}
                photoProfil={dossier.patient.photoProfil}
                prenom={dossier.patient.prenom}
                nom={dossier.patient.nom}
                size="lg"
              />
            )}
            <p className="text-muted">
              {dossier.patient
                ? `${dossier.patient.prenom} ${dossier.patient.nom}`
                : 'Patient non renseigné'}{' '}
              · {STATUT_LABELS[dossier.statut]}
              {dossier.patient?.numeroPasseport && (
                <span className="ml-2 text-xs">· Passeport {dossier.patient.numeroPasseport}</span>
              )}
            </p>
          </div>
          {dossier.patient?.id && !locked && (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand">
              Changer la photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    await api.post(`/patients/${dossier.patient.id}/photo`, fd);
                    void qc.invalidateQueries({ queryKey: ['dossier', id] });
                    void qc.invalidateQueries({ queryKey: ['dossiers'] });
                    toast.success('Photo mise à jour');
                  } catch {
                    toast.error('Upload photo impossible');
                  }
                }}
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={suiviLink.isPending}
            onClick={() => suiviLink.mutate()}
          >
            <Link2 className="h-4 w-4" /> Lien suivi
          </Button>
          <Can module="dossiers" action="validate">
            <Button variant="secondary" disabled={locked} onClick={() => validate.mutate()}>
              Valider
            </Button>
          </Can>
          <Can module="dossiers" action="delete">
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          </Can>
        </div>
      </div>

      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              Dossier en lecture seule (verrouillé).
            </span>
          </div>
          {isSuperAdmin ? (
            <Button
              size="sm"
              onClick={() => unlockDirect.mutate()}
              disabled={unlockDirect.isPending}
            >
              <Unlock className="h-4 w-4" /> Déverrouiller
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => unlockReq.mutate()}
              disabled={unlockReq.isPending}
            >
              Demander une modification
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-surface p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-ui',
              tab === t.id ? 'bg-brand text-white' : 'text-muted hover:bg-canvas',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'infos' && (
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Dossier">
            <Row label="Type" value={dossier.typeClient} />
            <Row label="Destination" value={dossier.destination} />
            <Row label="Pathologie" value={dossier.pathologie} />
            <Row label="Priorité" value={dossier.priorite} />
            {dossier.budget != null && canFinance && (
              <Row label="Budget" value={formatMoney(Number(dossier.budget))} />
            )}
          </InfoCard>
          <InfoCard title="Patient">
            <Row
              label="Nom"
              value={
                dossier.patient
                  ? `${dossier.patient.prenom} ${dossier.patient.nom}`
                  : '—'
              }
            />
            <Row label="Téléphone" value={dossier.patient?.telephone} />
            <Row label="Email" value={dossier.patient?.email} />
            <Row label="Nationalité" value={dossier.patient?.nationalite} />
          </InfoCard>
          <InfoCard title="Accompagnateurs">
            {(dossier.accompagnateurs ?? []).length === 0 && (
              <p className="text-sm text-muted">Aucun accompagnateur</p>
            )}
            {(dossier.accompagnateurs ?? []).map(
              (a: { id: string; prenom: string; nom: string; lien?: string }) => (
                <Row key={a.id} label={a.lien ?? 'Accompagnant'} value={`${a.prenom} ${a.nom}`} />
              ),
            )}
          </InfoCard>
        </div>
      )}

      {tab === 'cotation' && canFinance && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 shadow-soft border border-[var(--border)]">
            <div>
              <label className="text-sm font-medium">Jours d’assurance</label>
              <Input
                type="number"
                min={1}
                value={jours}
                onChange={(e) => setJours(Number(e.target.value))}
                className="mt-1 w-32"
              />
              <p className="mt-1 text-xs text-muted">J≤30 → 7$/j · J≥31 → 6,50$/j</p>
            </div>
            <Button onClick={() => recalcul.mutate()} disabled={locked}>
              Recalculer
            </Button>
            <Button variant="secondary" onClick={() => addNavette.mutate()} disabled={locked}>
              + Navette 70$
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {(cotation?.lignes ?? []).map(
                  (l: { id: string; description: string; type: string; montant: number }) => (
                    <tr key={l.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">{l.description}</td>
                      <td className="px-4 py-3 text-muted">{l.type}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(Number(l.montant))}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)] bg-canvas">
                  <td className="px-4 py-3 font-bold" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-extrabold text-brand">
                    {formatMoney(Number(cotation?.total ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'facturation' && canFactu && (
        <FacturationPanel dossierId={id} locked={locked} />
      )}

      {tab === 'documents' && <GedDocumentsPanel dossierId={id} locked={locked} />}

      {tab === 'logistique' && (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted">Tâches liées à ce dossier</p>
            <Can module="logistique" action="create">
              <Button size="sm" disabled={locked} onClick={() => createTache.mutate()}>
                + Navette
              </Button>
            </Can>
          </div>
          {(dossier.tachesLogistique ?? []).length === 0 ? (
            <p className="text-sm text-muted">Aucune tâche — créez-en ici ou depuis Protocole.</p>
          ) : (
            <ul className="space-y-2">
              {dossier.tachesLogistique.map(
                (t: { id: string; titre: string; type: string; statut: string }) => (
                  <li
                    key={t.id}
                    className="flex justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>{t.titre}</strong> · {t.type}
                    </span>
                    <span className="text-muted">{t.statut}</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}

      {tab === 'communications' && (
        <CommunicationsPanel dossierId={id} locked={locked} />
      )}

      {tab === 'postretour' && (
        <div className="max-w-lg space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-soft">
          <h3 className="font-bold">Suivi post-retour</h3>
          <p className="text-sm text-muted">
            Le patient est-il rentré ? Besoin d’un accompagnement après le vol retour ?
          </p>
          {dossier.postRetourStatut && (
            <p className="text-sm">
              Actuel : <strong>{dossier.postRetourStatut}</strong>
              {dossier.postRetourLe
                ? ` · ${new Date(dossier.postRetourLe).toLocaleString('fr-FR')}`
                : ''}
            </p>
          )}
          <select
            className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
            value={postStatut}
            disabled={locked}
            onChange={(e) => setPostStatut(e.target.value)}
          >
            {['EN_ATTENTE', 'RENTRE', 'SUIVI', 'CLOS'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
            placeholder="Notes"
            value={postNotes || dossier.postRetourNotes || ''}
            disabled={locked}
            onChange={(e) => setPostNotes(e.target.value)}
          />
          <Button disabled={locked || savePostRetour.isPending} onClick={() => savePostRetour.mutate()}>
            Enregistrer
          </Button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <h3 className="text-lg font-bold">Déplacer vers la corbeille ?</h3>
            <p className="mt-2 text-sm text-muted">
              Ce dossier sera déplacé vers la corbeille et récupérable pendant 90 jours. Aucune
              suppression définitive immédiate.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => softDelete.mutate()}
                disabled={softDelete.isPending}
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {suiviUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-soft">
            <h3 className="text-lg font-bold">Lien de suivi patient</h3>
            <p className="text-sm text-muted">
              Partagez ce lien avec le patient — aucune connexion requise.
            </p>
            <code className="block break-all rounded-xl bg-canvas px-3 py-2 text-xs">{suiviUrl}</code>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard.writeText(suiviUrl);
                  toast.success('Copié');
                }}
              >
                <Copy className="h-4 w-4" /> Copier
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.open(suiviUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" /> Ouvrir
              </Button>
              <Button variant="ghost" onClick={() => setSuiviUrl(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  );
}
