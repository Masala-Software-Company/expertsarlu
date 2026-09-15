import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  buildPatientOutreachMessage,
  mailtoPatientUrl,
  whatsappChatUrl,
} from '@/lib/patient-contact';

type PreInscription = {
  id: string;
  reference: string;
  statut: string;
  categorie: string;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  numeroPasseport?: string | null;
  creeLe: string;
  motifRejet?: string | null;
  partenaire?: { id: string; nom: string } | null;
  dossier?: { id: string; numero: string } | null;
  donnees?: Record<string, unknown>;
  institutionSaisie?: Record<string, unknown> | null;
  historique?: { at: string; action: string; detail?: string }[];
};

const STATUT_LABELS: Record<string, string> = {
  NOUVEAU: 'Nouveau',
  A_VERIFIER: 'À vérifier',
  INFORMATIONS_INCOMPLETES: 'Informations incomplètes',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
  DOSSIER_CREE: 'Dossier créé',
};

export function PreInscriptionsPage() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');
  const [categorie, setCategorie] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [motif, setMotif] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['pre-inscriptions', q, statut, categorie],
    queryFn: async () =>
      (
        await api.get<PreInscription[]>('/pre-inscriptions', {
          params: {
            q: q || undefined,
            statut: statut || undefined,
            categorie: categorie || undefined,
          },
        })
      ).data,
  });

  const { data: detail } = useQuery({
    queryKey: ['pre-inscription', selectedId],
    queryFn: async () =>
      (await api.get<PreInscription>(`/pre-inscriptions/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const { data: doublons } = useQuery({
    queryKey: ['pre-inscription-doublons', selectedId],
    queryFn: async () =>
      (
        await api.get<{
          risque: boolean;
          message: string | null;
          correspondances: {
            id: string;
            nom: string;
            prenom: string;
            dossier?: { numero: string; id: string };
          }[];
        }>(`/pre-inscriptions/${selectedId}/doublons`)
      ).data,
    enabled: !!selectedId,
  });

  const updateStatut = useMutation({
    mutationFn: async (next: string) =>
      api.patch(`/pre-inscriptions/${selectedId}/statut`, {
        statut: next,
        motif: motif || undefined,
      }),
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['pre-inscriptions'] });
      qc.invalidateQueries({ queryKey: ['pre-inscription', selectedId] });
    },
    onError: () => toast.error('Impossible de mettre à jour le statut'),
  });

  const creer = useMutation({
    mutationFn: async (forcerMalgreDoublon?: boolean) =>
      (
        await api.post<{ dossier: { id: string; numero: string } }>(
          `/pre-inscriptions/${selectedId}/creer-dossier`,
          { forcerMalgreDoublon },
        )
      ).data,
    onSuccess: (res) => {
      toast.success(`Dossier ${res.dossier.numero} créé`);
      qc.invalidateQueries({ queryKey: ['pre-inscriptions'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: unknown; code?: string } } })
        ?.response?.data;
      if (data?.code === 'POSSIBLE_DUPLICATE' || String(data?.message).includes('correspondant')) {
        toast.error(
          'Un patient correspondant existe peut-être déjà. Vérifiez avant de forcer la création.',
        );
        return;
      }
      const msg = data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Création impossible');
    },
  });

  const photoUrl = useMemo(() => {
    if (!selectedId || !token) return null;
    const base = api.defaults.baseURL?.replace(/\/$/, '') ?? '';
    return `${base}/pre-inscriptions/${selectedId}/photo`;
  }, [selectedId, token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Nouveaux patients</h1>
        <p className="mt-1 text-muted">
          Demandes de pré-enregistrement reçues via le portail public — à vérifier avant création
          du dossier.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (nom, référence, e-mail…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded-xl border border-[var(--border)] bg-surface px-3 py-2 text-sm"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--border)] bg-surface px-3 py-2 text-sm"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          <option value="PARTICULIER">Particulier</option>
          <option value="INSTITUTION">Institution</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`cursor-pointer border-t border-[var(--border)] hover:bg-brand/[0.04] ${
                    selectedId === row.id ? 'bg-brand/[0.06]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {row.prenom} {row.nom}
                    </div>
                    <div className="text-xs text-muted">{row.reference}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.categorie === 'PARTICULIER' ? 'Particulier' : 'Institution'}
                  </td>
                  <td className="px-4 py-3">{row.partenaire?.nom ?? '—'}</td>
                  <td className="px-4 py-3">
                    {new Date(row.creeLe).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">{STATUT_LABELS[row.statut] ?? row.statut}</td>
                </tr>
              ))}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    Aucune demande pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          {!detail ? (
            <p className="text-sm text-muted">Sélectionnez une demande pour la consulter.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-24 w-24 rounded-2xl object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    // Auth via cookie not available — use fetch blob with header instead
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold">
                    {detail.prenom} {detail.nom}
                  </h2>
                  <p className="text-sm text-muted">{detail.reference}</p>
                  <p className="mt-1 text-sm">
                    {STATUT_LABELS[detail.statut] ?? detail.statut}
                    {detail.dossier ? (
                      <>
                        {' '}
                        ·{' '}
                        <Link className="font-semibold text-brand" to={`/dossiers/${detail.dossier.id}`}>
                          {detail.dossier.numero}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              <AuthPhoto id={detail.id} />

              {doublons?.risque && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <strong>Attention doublon possible.</strong> {doublons.message}
                  <ul className="mt-2 list-disc pl-4">
                    {doublons.correspondances.map((c) => (
                      <li key={c.id}>
                        {c.prenom} {c.nom}
                        {c.dossier ? ` — ${c.dossier.numero}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <DetailBlock title="Coordonnées">
                <div className="space-y-2">
                  <p>
                    {detail.email ?? '—'} · WhatsApp {detail.telephone ?? '—'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const msg = buildPatientOutreachMessage({
                        prenom: detail.prenom,
                        nom: detail.nom,
                        numeroDossier: detail.dossier?.numero ?? detail.reference,
                        statut: detail.statut,
                      });
                      const wa = whatsappChatUrl(detail.telephone, msg);
                      const mail = mailtoPatientUrl(detail.email, {
                        prenom: detail.prenom,
                        nom: detail.nom,
                        numeroDossier: detail.dossier?.numero ?? detail.reference,
                        statut: detail.statut,
                      });
                      return (
                        <>
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          ) : null}
                          {mail ? (
                            <a
                              href={mail}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-brand"
                            >
                              <Mail className="h-3.5 w-3.5" /> E-mail
                            </a>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </DetailBlock>
              <DetailBlock title="Passeport">{detail.numeroPasseport ?? '—'}</DetailBlock>
              {detail.partenaire && (
                <DetailBlock title="Institution">{detail.partenaire.nom}</DetailBlock>
              )}
              {detail.institutionSaisie && (
                <DetailBlock title="Institution saisie">
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(detail.institutionSaisie, null, 2)}
                  </pre>
                </DetailBlock>
              )}
              <DetailBlock title="Données complètes">
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(detail.donnees, null, 2)}
                </pre>
              </DetailBlock>

              <div className="space-y-2 border-t border-[var(--border)] pt-4">
                <Input
                  placeholder="Motif (rejet / infos incomplètes)"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateStatut.mutate('A_VERIFIER')}
                  >
                    À vérifier
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateStatut.mutate('INFORMATIONS_INCOMPLETES')}
                  >
                    Infos incomplètes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateStatut.mutate('VALIDE')}
                  >
                    Valider
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateStatut.mutate('REJETE')}
                  >
                    Rejeter
                  </Button>
                </div>
                {detail.statut !== 'DOSSIER_CREE' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" onClick={() => creer.mutate(false)}>
                      Créer le dossier patient
                    </Button>
                    {doublons?.risque && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (
                            confirm(
                              'Forcer la création malgré un risque de doublon ?',
                            )
                          ) {
                            creer.mutate(true);
                          }
                        }}
                      >
                        Forcer malgré doublon
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function AuthPhoto({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useMemo(() => {
    let revoke: string | null = null;
    (async () => {
      try {
        const res = await api.get(`/pre-inscriptions/${id}/photo`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        revoke = url;
        setSrc(url);
      } catch {
        setSrc(null);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);

  if (!src) return null;
  return <img src={src} alt="Photo patient" className="h-40 w-40 rounded-2xl object-cover" />;
}
