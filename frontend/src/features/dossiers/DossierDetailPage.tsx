import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Trash2, Unlock, Copy, ExternalLink, Mail, Share2, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUT_LABELS, formatMoney, cn } from '@/lib/utils';
import {
  buildPatientOutreachMessage,
  mailtoPatientUrl,
  whatsappChatUrl,
} from '@/lib/patient-contact';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import {
  labelOf,
  TACHE_TYPE_LABELS,
  RDV_TYPE_LABELS,
  POST_RETOUR_LABELS,
} from '@/lib/status-labels';
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
  const [missionOpen, setMissionOpen] = useState(false);
  const [mission, setMission] = useState({
    type: 'NAVETTE',
    titre: '',
    notes: '',
    echeance: '',
  });
  const qc = useQueryClient();
  const canFinance = usePermission('cotation', 'read');
  const canFactu = usePermission('facturation', 'read');
  const canLogistique = usePermission('logistique', 'read');
  const canComms =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ASSISTANT_MANAGER' ||
    user?.role === 'SUPPORT_CLIENT';
  const canPostRetour =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ASSISTANT_MANAGER' ||
    user?.role === 'SUPPORT_CLIENT';

  const { data: dossier, isLoading } = useQuery({
    queryKey: ['dossier', id],
    queryFn: async () => (await api.get(`/dossiers/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (dossier?.postRetourStatut) setPostStatut(dossier.postRetourStatut);
    if (dossier?.postRetourNotes) setPostNotes(dossier.postRetourNotes);
  }, [dossier?.postRetourStatut, dossier?.postRetourNotes]);

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
    mutationFn: async (payload: {
      type: string;
      titre: string;
      notes?: string;
      echeance?: string;
    }) => (await api.post(`/logistique/taches/${id}`, payload)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      setMissionOpen(false);
      setMission({ type: 'NAVETTE', titre: '', notes: '', echeance: '' });
      toast.success('Mission ajoutée au protocole');
    },
    onError: () => toast.error('Création de mission impossible'),
  });

  const patchTacheStatut = useMutation({
    mutationFn: async ({ tacheId, statut }: { tacheId: string; statut: string }) =>
      (await api.patch(`/logistique/taches/${tacheId}/statut`, { statut })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossier', id] });
      toast.success('Statut mis à jour');
    },
    onError: () => toast.error('Mise à jour impossible'),
  });

  const downloadCarte = async () => {
    try {
      const { data } = await api.get(`/dossiers/${id}/carte-assistance`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carte-assistance-${dossier?.numero ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Carte d’assistance téléchargée');
    } catch {
      toast.error('Impression carte impossible');
    }
  };

  const tabs = useMemo(() => {
    const all: { id: Tab; label: string; hide?: boolean }[] = [
      { id: 'infos', label: 'Informations' },
      { id: 'cotation', label: 'Cotation', hide: !canFinance },
      { id: 'facturation', label: 'Facturation', hide: !canFactu },
      { id: 'documents', label: 'Documents' },
      { id: 'logistique', label: 'Logistique', hide: !canLogistique },
      { id: 'communications', label: 'Communications', hide: !canComms },
      { id: 'postretour', label: 'Post-retour', hide: !canPostRetour },
    ];
    return all.filter((t) => !t.hide);
  }, [canFinance, canFactu, canLogistique, canComms, canPostRetour]);

  if (isLoading || !dossier) {
    return <div className="animate-pulse h-40 rounded-2xl bg-surface shadow-soft" />;
  }

  const locked =
    dossier.verrouille || ['VALIDE', 'FACTURE_PAYE', 'VERROUILLE'].includes(dossier.statut);

  const outreachMessage = buildPatientOutreachMessage({
    prenom: dossier.patient?.prenom,
    nom: dossier.patient?.nom,
    numeroDossier: dossier.numero,
    statut: dossier.statut,
  });
  const waUrl = whatsappChatUrl(dossier.patient?.telephone, outreachMessage);
  const mailUrl = mailtoPatientUrl(dossier.patient?.email, {
    prenom: dossier.patient?.prenom,
    nom: dossier.patient?.nom,
    numeroDossier: dossier.numero,
    statut: dossier.statut,
  });

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
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap justify-end gap-2">
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                title="Ouvrir WhatsApp avec message prérempli (dossier + statut)"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition-ui hover:brightness-110"
              >
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </a>
            ) : null}
            {mailUrl ? (
              <a
                href={mailUrl}
                title="Écrire un e-mail prérempli au patient"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-surface px-4 text-sm font-semibold transition-ui hover:border-brand/40 hover:text-brand"
              >
                <Mail className="h-4 w-4" /> E-mail
              </a>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              disabled={suiviLink.isPending}
              title="Génère un lien public pour que le patient suive l’avancement de son dossier"
              onClick={() => suiviLink.mutate()}
            >
              <Share2 className="h-4 w-4" /> Partager le suivi
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              title="Télécharger la carte d’assistance médicale PDF"
              onClick={() => void downloadCarte()}
            >
              <Printer className="h-4 w-4" /> Carte PDF
            </Button>
          </div>          <div className="flex flex-wrap justify-end gap-2">
            <Can module="dossiers" action="validate">
              <Button variant="secondary" size="sm" className="rounded-full" disabled={locked} onClick={() => validate.mutate()}>
                Valider le dossier
              </Button>
            </Can>
            <Can module="dossiers" action="delete">
              <Button variant="danger" size="sm" className="rounded-full" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            </Can>
          </div>
          <p className="max-w-sm text-right text-[11px] text-muted">
            <strong>Partager le suivi</strong> : envoie au patient un lien sécurisé pour consulter
            l’état de son dossier (sans accès à l’espace équipe).
          </p>
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
            <Row
              label="WhatsApp"
              value={
                dossier.patient?.telephone ? (
                  waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#25D366] hover:underline"
                    >
                      {dossier.patient.telephone}
                    </a>
                  ) : (
                    dossier.patient.telephone
                  )
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="E-mail"
              value={
                dossier.patient?.email ? (
                  mailUrl ? (
                    <a href={mailUrl} className="font-semibold text-brand hover:underline">
                      {dossier.patient.email}
                    </a>
                  ) : (
                    dossier.patient.email
                  )
                ) : (
                  '—'
                )
              }
            />
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Total cotation</div>
              <div className="mt-1 text-2xl font-extrabold text-brand">
                {formatMoney(Number(cotation?.total ?? 0))}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Lignes</div>
              <div className="mt-1 text-2xl font-extrabold">
                {(cotation?.lignes ?? []).length}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Assurance</div>
              <div className="mt-1 text-2xl font-extrabold">{jours} j</div>
              <p className="text-[11px] text-muted">J≤30 → 7$/j · J≥31 → 6,50$/j</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
            <div>
              <label className="text-sm font-medium">Recalculer l’assurance (jours)</label>
              <Input
                type="number"
                min={1}
                value={jours}
                onChange={(e) => setJours(Number(e.target.value))}
                className="mt-1 w-32"
                disabled={locked}
              />
            </div>
            <Button onClick={() => recalcul.mutate()} disabled={locked || recalcul.isPending}>
              Recalculer
            </Button>
            <Button
              variant="secondary"
              onClick={() => addNavette.mutate()}
              disabled={locked || addNavette.isPending}
            >
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
                      <td className="px-4 py-3 font-medium">{l.description}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                          {labelOf(TACHE_TYPE_LABELS, l.type) !== l.type
                            ? labelOf(TACHE_TYPE_LABELS, l.type)
                            : l.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(Number(l.montant))}
                      </td>
                    </tr>
                  ),
                )}
                {(cotation?.lignes ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted">
                      Aucune ligne — recalculez l’assurance ou ajoutez une navette.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)] bg-canvas">
                  <td className="px-4 py-3 font-bold" colSpan={2}>
                    Total devis / facturation
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
        <FacturationPanel
          dossierId={id}
          locked={locked}
          dossierNumero={dossier.numero}
          patientName={
            dossier.patient
              ? `${dossier.patient.prenom} ${dossier.patient.nom}`
              : undefined
          }
        />
      )}

      {tab === 'documents' && <GedDocumentsPanel dossierId={id} locked={locked} />}

      {tab === 'logistique' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Protocole logistique</h3>
              <p className="text-sm text-muted">
                Tableau de missions (visa, navette, vol…) — avancez le statut comme un board
                opérationnel.
              </p>
            </div>
            <Can module="logistique" action="create">
              <Button size="sm" disabled={locked} onClick={() => setMissionOpen(true)}>
                + Nouvelle mission
              </Button>
            </Can>
          </div>

          {(() => {
            const tasks = (dossier.tachesLogistique ?? []) as {
              id: string;
              titre: string;
              type: string;
              statut: string;
              notes?: string;
            }[];
            const columns = [
              { key: 'A_FAIRE', label: 'À planifier' },
              { key: 'EN_COURS', label: 'En cours' },
              { key: 'TERMINE', label: 'Terminé' },
              { key: 'BLOQUE', label: 'Bloqué' },
            ] as const;
            if (tasks.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
                  Aucune mission. Créez visa, navette ou vol pour structurer le parcours patient.
                </div>
              );
            }
            return (
              <div className="grid gap-3 lg:grid-cols-4">
                {columns.map((col) => {
                  const items = tasks.filter((t) => t.statut === col.key);
                  return (
                    <div
                      key={col.key}
                      className="rounded-2xl border border-[var(--border)] bg-canvas/60 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between px-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">
                          {col.label}
                        </span>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">
                          {items.length}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {items.map((t) => (
                          <li
                            key={t.id}
                            className="rounded-xl border border-[var(--border)] bg-surface p-3 shadow-soft"
                          >
                            <div className="text-[10px] font-bold uppercase tracking-wide text-brand">
                              {labelOf(TACHE_TYPE_LABELS, t.type)}
                            </div>
                            <div className="mt-1 text-sm font-bold">{t.titre}</div>
                            {!locked && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {col.key !== 'A_FAIRE' && (
                                  <button
                                    type="button"
                                    className="rounded-md bg-canvas px-2 py-1 text-[10px] font-semibold"
                                    onClick={() =>
                                      patchTacheStatut.mutate({
                                        tacheId: t.id,
                                        statut: 'A_FAIRE',
                                      })
                                    }
                                  >
                                    À faire
                                  </button>
                                )}
                                {col.key !== 'EN_COURS' && (
                                  <button
                                    type="button"
                                    className="rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand"
                                    onClick={() =>
                                      patchTacheStatut.mutate({
                                        tacheId: t.id,
                                        statut: 'EN_COURS',
                                      })
                                    }
                                  >
                                    En cours
                                  </button>
                                )}
                                {col.key !== 'TERMINE' && (
                                  <button
                                    type="button"
                                    className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                                    onClick={() =>
                                      patchTacheStatut.mutate({
                                        tacheId: t.id,
                                        statut: 'TERMINE',
                                      })
                                    }
                                  >
                                    Terminer
                                  </button>
                                )}
                                {col.key !== 'BLOQUE' && (
                                  <button
                                    type="button"
                                    className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-800"
                                    onClick={() =>
                                      patchTacheStatut.mutate({
                                        tacheId: t.id,
                                        statut: 'BLOQUE',
                                      })
                                    }
                                  >
                                    Bloquer
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                        {items.length === 0 && (
                          <li className="px-1 py-6 text-center text-xs text-muted">Vide</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {(dossier.rendezVous ?? []).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold">Rendez-vous liés</h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(dossier.rendezVous as { id: string; type: string; dateHeure: string; lieu?: string; statut: string }[]).map(
                  (r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-[var(--border)] bg-surface px-3 py-2 text-sm"
                    >
                      <div className="font-semibold">
                        {labelOf(RDV_TYPE_LABELS, r.type)} ·{' '}
                        {new Date(r.dateHeure).toLocaleString('fr-FR')}
                      </div>
                      <div className="text-muted">
                        {r.lieu ?? 'Lieu à confirmer'} · {r.statut}
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'communications' && (
        <CommunicationsPanel
          dossierId={id}
          locked={locked}
          patient={dossier.patient}
          numeroDossier={dossier.numero}
          statut={dossier.statut}
        />
      )}

      {tab === 'postretour' && (
        <div className="space-y-5">
          <div>
            <h3 className="font-bold">Suivi post-retour</h3>
            <p className="text-sm text-muted">
              Pipeline d’accompagnement après le retour du patient (assistance médicale).
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {(['EN_ATTENTE', 'RENTRE', 'SUIVI', 'CLOS'] as const).map((s, idx) => {
              const active = (postStatut || dossier.postRetourStatut || 'EN_ATTENTE') === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={locked}
                  onClick={() => setPostStatut(s)}
                  className={cn(
                    'rounded-2xl border px-3 py-4 text-left transition-ui',
                    active
                      ? 'border-brand bg-brand text-white shadow-soft'
                      : 'border-[var(--border)] bg-surface hover:border-brand/40',
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                    Étape {idx + 1}
                  </div>
                  <div className="mt-1 text-sm font-bold">{POST_RETOUR_LABELS[s]}</div>
                </button>
              );
            })}
          </div>

          <div className="max-w-xl space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
            {dossier.postRetourLe && (
              <p className="text-xs text-muted">
                Dernière mise à jour :{' '}
                {new Date(dossier.postRetourLe).toLocaleString('fr-FR')}
                {dossier.postRetourStatut
                  ? ` · ${POST_RETOUR_LABELS[dossier.postRetourStatut] ?? dossier.postRetourStatut}`
                  : ''}
              </p>
            )}
            <label className="block text-sm font-medium">Notes cliniques / opérationnelles</label>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
              placeholder="Ex. patient rentré le…, suivi téléphonique prévu, documents manquants…"
              value={postNotes || dossier.postRetourNotes || ''}
              disabled={locked}
              onChange={(e) => setPostNotes(e.target.value)}
            />
            <Button
              disabled={locked || savePostRetour.isPending}
              onClick={() => savePostRetour.mutate()}
            >
              Enregistrer le post-retour
            </Button>
          </div>
        </div>
      )}

      {missionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-6 shadow-soft">
            <h4 className="font-bold">Nouvelle mission logistique</h4>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
              value={mission.type}
              onChange={(e) => setMission({ ...mission, type: e.target.value })}
            >
              {Object.entries(TACHE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Input
              placeholder="Titre (ex. Navette CDG T2 → hôpital)"
              value={mission.titre}
              onChange={(e) => setMission({ ...mission, titre: e.target.value })}
            />
            <Input
              type="datetime-local"
              value={mission.echeance}
              onChange={(e) => setMission({ ...mission, echeance: e.target.value })}
            />
            <textarea
              className="min-h-[80px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
              placeholder="Notes (vol, contact chauffeur…)"
              value={mission.notes}
              onChange={(e) => setMission({ ...mission, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMissionOpen(false)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={!mission.titre.trim() || createTache.isPending}
                onClick={() =>
                  createTache.mutate({
                    type: mission.type,
                    titre: mission.titre.trim(),
                    notes: mission.notes || undefined,
                    echeance: mission.echeance
                      ? new Date(mission.echeance).toISOString()
                      : undefined,
                  })
                }
              >
                Créer
              </Button>
            </div>
          </div>
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

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value ?? '—'}</span>
    </div>
  );
}
