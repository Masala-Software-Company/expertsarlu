import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUT_LABELS, formatMoney, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can, usePermission } from '@/hooks/usePermission';

type Tab = 'infos' | 'cotation' | 'documents' | 'logistique' | 'audit';

export function DossierDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<Tab>('infos');
  const [jours, setJours] = useState(30);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const canFinance = usePermission('cotation', 'read');

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
    onSuccess: () => toast.success('Demande envoyée au Super Admin'),
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

  const tabs = useMemo(() => {
    const all: { id: Tab; label: string; hide?: boolean }[] = [
      { id: 'infos', label: 'Informations' },
      { id: 'cotation', label: 'Cotation', hide: !canFinance },
      { id: 'documents', label: 'Documents' },
      { id: 'logistique', label: 'Logistique' },
    ];
    return all.filter((t) => !t.hide);
  }, [canFinance]);

  if (isLoading || !dossier) {
    return <div className="animate-pulse h-40 rounded-2xl bg-white shadow-soft" />;
  }

  const locked = dossier.verrouille || ['VALIDE', 'FACTURE_PAYE', 'VERROUILLE'].includes(dossier.statut);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/dossiers" className="inline-flex items-center gap-1 text-sm text-black/50 hover:text-brand">
            <ArrowLeft className="h-4 w-4" /> Dossiers
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{dossier.numero}</h1>
          <p className="text-black/50">
            {dossier.patient
              ? `${dossier.patient.prenom} ${dossier.patient.nom}`
              : 'Patient non renseigné'}{' '}
            · {STATUT_LABELS[dossier.statut]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can module="dossiers" action="validate">
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => validate.mutate()}
            >
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
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">
              Dossier en lecture seule (verrouillé). Les modifications sont bloquées.
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => unlockReq.mutate()}>
            Demander une modification
          </Button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-black/5 bg-white p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-ui',
              tab === t.id ? 'bg-brand text-white' : 'text-black/60 hover:bg-canvas',
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
              <p className="text-sm text-black/40">Aucun accompagnateur</p>
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
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-soft border border-black/5">
            <div>
              <label className="text-sm font-medium">Jours d’assurance</label>
              <Input
                type="number"
                min={1}
                value={jours}
                onChange={(e) => setJours(Number(e.target.value))}
                className="mt-1 w-32"
              />
              <p className="mt-1 text-xs text-black/40">J≤30 → 7$/j · J≥31 → 6,50$/j</p>
            </div>
            <Button onClick={() => recalcul.mutate()} disabled={locked}>
              Recalculer
            </Button>
            <Button variant="secondary" onClick={() => addNavette.mutate()} disabled={locked}>
              + Navette 70$
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase text-black/40">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {(cotation?.lignes ?? []).map(
                  (l: { id: string; description: string; type: string; montant: number }) => (
                    <tr key={l.id} className="border-t border-black/5">
                      <td className="px-4 py-3">{l.description}</td>
                      <td className="px-4 py-3 text-black/50">{l.type}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(Number(l.montant))}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10 bg-canvas">
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

      {tab === 'documents' && (
        <div className="rounded-2xl bg-white p-6 shadow-soft border border-black/5 text-sm text-black/50">
          GED — uploadez les pièces identité / médical / logistique / facturation via l’API{' '}
          <code className="text-brand">POST /ged/:dossierId</code>.
        </div>
      )}

      {tab === 'logistique' && (
        <div className="rounded-2xl bg-white p-6 shadow-soft border border-black/5">
          <p className="text-sm text-black/50 mb-3">Tâches liées à ce dossier</p>
          {(dossier.tachesLogistique ?? []).length === 0 ? (
            <p className="text-sm text-black/40">Aucune tâche — créez-en depuis Protocole.</p>
          ) : (
            <ul className="space-y-2">
              {dossier.tachesLogistique.map(
                (t: { id: string; titre: string; type: string; statut: string }) => (
                  <li key={t.id} className="flex justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
                    <span>
                      <strong>{t.titre}</strong> · {t.type}
                    </span>
                    <span className="text-black/45">{t.statut}</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
            <h3 className="text-lg font-bold">Déplacer vers la corbeille ?</h3>
            <p className="mt-2 text-sm text-black/60">
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
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-black/40">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-black/45">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  );
}
