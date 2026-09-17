import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, FileDown, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Can } from '@/hooks/usePermission';
import { useAuthStore } from '@/features/auth/auth-store';
import { InvoicePreviewModal, type InvoicePreviewData } from '@/components/InvoicePreviewModal';

type Facture = {
  id: string;
  numero: string;
  type: string;
  statut: string;
  montantTotal: number | string;
  devise: string;
  pdfChemin?: string | null;
  codeVerification?: string | null;
  signatureToken?: string | null;
  signeLe?: string | null;
  signeParNom?: string | null;
  creeLe?: string;
  dossier?: { numero: string; patient?: { nom: string; prenom: string } | null };
  paiements: { id: string; montant: number | string; methode: string }[];
};

const STATUT_FACTURE: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  ACCEPTE: 'Accepté',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
};

type Props = {
  dossierId: string;
  locked: boolean;
  dossierNumero?: string;
  patientName?: string;
};

export function FacturationPanel({
  dossierId,
  locked,
  dossierNumero,
  patientName,
}: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [payMontant, setPayMontant] = useState('');
  const [payId, setPayId] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoicePreviewData | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Facture | null>(null);
  const [deleteMotif, setDeleteMotif] = useState('');
  const [manualLignes, setManualLignes] = useState<
    { code: string; description: string; quantite: string; montant: string }[]
  >([{ code: 'TF-001', description: '', quantite: '1', montant: '' }]);

  const { data: factures = [], isLoading } = useQuery({
    queryKey: ['factures', dossierId],
    queryFn: async () =>
      (await api.get<Facture[]>(`/facturation/dossier/${dossierId}`)).data,
  });

  const { data: cotation } = useQuery({
    queryKey: ['cotation', dossierId],
    queryFn: async () => (await api.get(`/cotation/${dossierId}`)).data,
  });

  const creerDevis = useMutation({
    mutationFn: async () => (await api.post(`/facturation/devis/${dossierId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      toast.success('Devis généré (PDF inclus)');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Impossible de créer le devis'),
  });

  const creerFactureAuto = useMutation({
    mutationFn: async () =>
      (await api.post(`/facturation/facture-auto/${dossierId}`)).data as Facture,
    onSuccess: (f) => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      toast.success('Facture générée depuis la cotation');
      void openPreview(f);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Impossible de générer la facture'),
  });

  const creerManuel = useMutation({
    mutationFn: async () => {
      const lignes = manualLignes
        .filter((l) => l.description.trim() && Number(l.montant) > 0)
        .map((l) => ({
          code: l.code || 'TF-001',
          description: l.description.trim(),
          quantite: Number(l.quantite) || 1,
          montant: Number(l.montant),
        }));
      if (!lignes.length) throw new Error('Au moins une ligne valide est requise');
      return (
        await api.post(`/facturation/manuel/${dossierId}`, {
          type: 'FACTURE',
          lignes,
        })
      ).data as Facture;
    },
    onSuccess: (f) => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      setCreateOpen(false);
      setManualLignes([
        { code: 'TF-001', description: '', quantite: '1', montant: '' },
      ]);
      toast.success('Facture manuelle créée');
      void openPreview(f);
    },
    onError: (e: { response?: { data?: { message?: string } } | undefined; message?: string }) =>
      toast.error(
        e.response?.data?.message ?? e.message ?? 'Création impossible',
      ),
  });

  const payer = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/facturation/paiements/${payId}`, {
          montant: Number(payMontant),
          methode: 'VIREMENT',
        })
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      void qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      setPayId(null);
      setPayMontant('');
      toast.success('Paiement enregistré');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Paiement refusé'),
  });

  const officielle = useMutation({
    mutationFn: async (factureId: string) =>
      (await api.post(`/facturation/factures/${factureId}/officielle`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      toast.success('Facture officielle générée');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Génération bloquée'),
  });

  const supprimer = useMutation({
    mutationFn: async (factureId: string) =>
      (await api.delete(`/facturation/factures/${factureId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
      setDeleteTarget(null);
      toast.success('Document supprimé');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Suppression impossible'),
  });

  const demanderSuppression = useMutation({
    mutationFn: async ({ factureId, motif }: { factureId: string; motif: string }) =>
      (
        await api.post(`/facturation/factures/${factureId}/demande-suppression`, {
          motif,
        })
      ).data,
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteMotif('');
      toast.success('Demande envoyée au Super Admin');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Demande impossible'),
  });

  const resolveMeta = (f: Facture) => {
    const fromApi = f.dossier?.patient
      ? `${f.dossier.patient.prenom} ${f.dossier.patient.nom}`.trim()
      : '';
    return {
      patient: fromApi || patientName || undefined,
      dossierNumero: f.dossier?.numero || dossierNumero || undefined,
    };
  };

  const buildLignes = (f: Facture) => {
    const lines = (cotation?.lignes ?? []) as {
      description: string;
      montant: number;
    }[];
    if (lines.length > 0) {
      return lines.map((l, i) => ({
        code: `LN-${String(i + 1).padStart(3, '0')}`,
        description: l.description,
        quantite: 1,
        montant: Number(l.montant),
      }));
    }
    return [
      {
        code: 'TOT',
        description:
          f.type === 'FACTURE' ? 'Facturation dossier' : 'Devis de prise en charge',
        quantite: 1,
        montant: Number(f.montantTotal),
      },
    ];
  };

  const downloadPdf = async (factureId: string, numero: string) => {
    try {
      // Le GET régénère le PDF côté API pour coller au modèle d’aperçu.
      const { data } = await api.get(`/facturation/factures/${factureId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
    } catch {
      toast.error('PDF indisponible');
    }
  };

  const openPreview = async (f: Facture) => {
    let code = f.codeVerification;
    let refreshed = f;
    try {
      refreshed = (await api.post(`/facturation/factures/${f.id}/regenerer-pdf`)).data as Facture;
      code = refreshed.codeVerification ?? code;
      void qc.invalidateQueries({ queryKey: ['factures', dossierId] });
    } catch {
      /* aperçu avec données locales si régénération indisponible */
    }

    const paye = (refreshed.paiements ?? f.paiements ?? []).reduce(
      (s, p) => s + Number(p.montant),
      0,
    );
    const meta = resolveMeta(refreshed);
    const titre =
      refreshed.type === 'FACTURE'
        ? 'FACTURE'
        : refreshed.signeLe
          ? 'DEVIS SIGNÉ'
          : 'DEVIS';

    setPreviewId(refreshed.id);
    setPreview({
      titre,
      numero: refreshed.numero,
      patient: meta.patient,
      dossierNumero: meta.dossierNumero,
      codeVerification: code,
      emisLe: refreshed.creeLe ?? f.creeLe,
      lignes: buildLignes(refreshed),
      total: Number(refreshed.montantTotal),
      paye: refreshed.type === 'FACTURE' ? Number(refreshed.montantTotal) : paye,
      devise: refreshed.devise,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Facturation</h3>
          <p className="text-sm text-muted">Devis, paiements et PDF officiels authentifiés</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can module="facturation" action="create">
            <Button variant="secondary" disabled={locked} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Facture manuelle
            </Button>
            <Button
              variant="secondary"
              disabled={locked || creerFactureAuto.isPending}
              onClick={() => creerFactureAuto.mutate()}
            >
              <Plus className="h-4 w-4" /> Générer une facture
            </Button>
            <Button disabled={locked || creerDevis.isPending} onClick={() => creerDevis.mutate()}>
              <Plus className="h-4 w-4" /> Générer un devis
            </Button>
          </Can>
        </div>
      </div>

      {isLoading && (
        <div className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-surface" />
      )}

      <div className="space-y-3">
        {factures.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-brand">
                  {f.type === 'FACTURE' ? 'Facture' : 'Devis'}
                </div>
                <div className="mt-1 text-lg font-extrabold">{f.numero}</div>
                <div className="text-sm text-muted">
                  {STATUT_FACTURE[f.statut] ?? f.statut}
                  {f.codeVerification ? ` · code ${f.codeVerification}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-brand">
                  {formatMoney(Number(f.montantTotal), f.devise)}
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openPreview(f)}>
                    <Eye className="h-3.5 w-3.5" /> Aperçu
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void downloadPdf(f.id, f.numero)}
                  >
                    <FileDown className="h-3.5 w-3.5" /> PDF
                  </Button>
                  <Can module="facturation" action="create">
                    {f.type === 'DEVIS' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={locked}
                          onClick={() => {
                            setPayId(f.id);
                            setPayMontant(String(f.montantTotal));
                          }}
                        >
                          Encaisser
                        </Button>
                        <Button
                          size="sm"
                          disabled={locked || officielle.isPending}
                          onClick={() => officielle.mutate(f.id)}
                        >
                          Facture officielle
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={locked}
                      onClick={() => {
                        setDeleteTarget(f);
                        setDeleteMotif(
                          isSuperAdmin
                            ? ''
                            : `Demande de suppression de ${f.numero}`,
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isSuperAdmin ? 'Supprimer' : 'Demander suppression'}
                    </Button>
                  </Can>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && factures.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-8 text-center text-sm text-muted">
            Aucun devis / facture pour ce dossier
          </div>
        )}
      </div>

      {payId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-6 shadow-soft">
            <h4 className="font-bold">Enregistrer un paiement</h4>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={payMontant}
              onChange={(e) => setPayMontant(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPayId(null)}>
                Annuler
              </Button>
              <Button className="flex-1" disabled={payer.isPending} onClick={() => payer.mutate()}>
                Valider
              </Button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div>
              <h4 className="text-lg font-extrabold">Créer une facture manuelle</h4>
              <p className="mt-1 text-sm text-muted">
                Remplissez les lignes ci-dessous. Le PDF utilisera le modèle officiel eXpert
                (code de vérification + QR).
              </p>
              {(patientName || dossierNumero) && (
                <div className="mt-3 grid gap-2 rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      Patient
                    </div>
                    <div className="font-semibold">{patientName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      Dossier
                    </div>
                    <div className="font-semibold">{dossierNumero || '—'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {manualLignes.map((ligne, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border)] bg-canvas/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">
                      Ligne {idx + 1}
                    </span>
                    {manualLignes.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-danger hover:underline"
                        onClick={() =>
                          setManualLignes((rows) => rows.filter((_, i) => i !== idx))
                        }
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <Input
                      placeholder="Code"
                      value={ligne.code}
                      onChange={(e) =>
                        setManualLignes((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, code: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      required
                      placeholder="Libellé / description"
                      value={ligne.description}
                      onChange={(e) =>
                        setManualLignes((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, description: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Quantité"
                      value={ligne.quantite}
                      onChange={(e) =>
                        setManualLignes((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, quantite: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder="Montant USD"
                      value={ligne.montant}
                      onChange={(e) =>
                        setManualLignes((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, montant: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setManualLignes((rows) => [
                  ...rows,
                  {
                    code: `TF-${String(rows.length + 1).padStart(3, '0')}`,
                    description: '',
                    quantite: '1',
                    montant: '',
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Ajouter une ligne
            </Button>

            <div className="rounded-xl bg-brand/5 px-3 py-2 text-sm font-semibold text-brand">
              Total :{' '}
              {formatMoney(
                manualLignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={
                  creerManuel.isPending ||
                  !manualLignes.some(
                    (l) => l.description.trim() && Number(l.montant) > 0,
                  )
                }
                onClick={() => creerManuel.mutate()}
              >
                Générer la facture
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-6 shadow-soft">
            <h4 className="font-bold">
              {isSuperAdmin
                ? `Supprimer ${deleteTarget.numero} ?`
                : `Demander la suppression de ${deleteTarget.numero}`}
            </h4>
            <p className="text-sm text-muted">
              {isSuperAdmin
                ? 'Action définitive — le document et son PDF seront effacés.'
                : 'Un Super Admin devra approuver cette demande avant suppression.'}
            </p>
            {!isSuperAdmin && (
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
                placeholder="Motif de la demande…"
                value={deleteMotif}
                onChange={(e) => setDeleteMotif(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteMotif('');
                }}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={
                  supprimer.isPending ||
                  demanderSuppression.isPending ||
                  (!isSuperAdmin && deleteMotif.trim().length < 3)
                }
                onClick={() => {
                  if (isSuperAdmin) {
                    supprimer.mutate(deleteTarget.id);
                  } else {
                    demanderSuppression.mutate({
                      factureId: deleteTarget.id,
                      motif: deleteMotif.trim(),
                    });
                  }
                }}
              >
                {isSuperAdmin ? 'Supprimer' : 'Envoyer la demande'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <InvoicePreviewModal
          data={preview}
          onClose={() => {
            setPreview(null);
            setPreviewId(null);
          }}
          onDownload={
            previewId ? () => void downloadPdf(previewId, preview.numero) : undefined
          }
        />
      )}
    </div>
  );
}
