import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import {
  buildPatientOutreachMessage,
  mailtoPatientUrl,
  whatsappChatUrl,
} from '@/lib/patient-contact';

type Identite = {
  nom?: string;
  nomNaissance?: string;
  prenom?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  paysNaissance?: string;
  nationaliteActuelle?: string;
  nationaliteNaissance?: string;
  autresNationalites?: string;
  sexe?: string;
  etatCivil?: string;
  numeroNational?: string;
  numeroPieceIdentite?: string;
  statutPatient?: string;
};

type Coordonnees = {
  adresse?: string;
  email?: string;
  telephone?: string;
};

type DocumentVoyage = {
  type?: string;
  numero?: string;
  dateDelivrance?: string;
  dateExpiration?: string;
  paysDelivrance?: string;
};

type Professionnel = {
  profession?: string;
  employeurNom?: string;
  employeurAdresse?: string;
  employeurTelephone?: string;
};

type Institution = {
  nom?: string;
  adresse?: string;
  telephone?: string;
  contactNom?: string;
  contactPrenom?: string;
  contactTelephone?: string;
  contactEmail?: string;
};

type Tuteur = {
  nom?: string;
  prenom?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  nationalite?: string;
};

type Donnees = {
  categorie?: string;
  identite?: Identite;
  coordonnees?: Coordonnees;
  documentVoyage?: DocumentVoyage;
  professionnel?: Professionnel;
  institution?: Institution;
  tuteur?: Tuteur;
  residenceEtrangere?: {
    oui?: boolean;
    numeroAutorisation?: string;
    expirationAutorisation?: string;
  };
};

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
  donnees?: Donnees;
  institutionSaisie?: Institution | null;
};

const STATUT_LABELS: Record<string, string> = {
  NOUVEAU: 'Nouveau',
  A_VERIFIER: 'À vérifier',
  INFORMATIONS_INCOMPLETES: 'Informations incomplètes',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
  DOSSIER_CREE: 'Dossier créé',
};

const SEXE_LABELS: Record<string, string> = {
  MASCULIN: 'Masculin',
  FEMININ: 'Féminin',
};

const STATUT_PATIENT_LABELS: Record<string, string> = {
  ADULTE: 'Adulte',
  ENFANT_SOUS_TUTELLE: 'Enfant sous tutelle',
  ADULTE_SOUS_TUTELLE: 'Adulte sous tutelle',
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-ink">{value?.trim() || '—'}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-[var(--border)] pb-1.5 text-xs font-bold uppercase tracking-wide text-brand">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PreInscriptionsPage() {
  const qc = useQueryClient();
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

  const { data: detail, isLoading: detailLoading } = useQuery({
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
      setSelectedId(null);
    },
    onError: (err: unknown) => {
      const data = (
        err as { response?: { data?: { message?: unknown; code?: string } } }
      )?.response?.data;
      if (
        data?.code === 'POSSIBLE_DUPLICATE' ||
        String(data?.message).includes('correspondant')
      ) {
        toast.error(
          'Un patient correspondant existe peut-être déjà. Vérifiez avant de forcer la création.',
        );
        return;
      }
      const msg = data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Création impossible');
    },
  });

  useEffect(() => {
    if (!selectedId) setMotif('');
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const d = detail?.donnees;
  const identite = d?.identite;
  const coords = d?.coordonnees;
  const doc = d?.documentVoyage;
  const pro = d?.professionnel;
  const inst = d?.institution || detail?.institutionSaisie || undefined;
  const tuteur = d?.tuteur;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Nouveaux patients</h1>
        <p className="mt-1 text-muted">
          Demandes de pré-enregistrement à vérifier avant création du dossier.
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

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[var(--border)] hover:bg-brand/[0.04]"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-semibold text-brand hover:underline"
                    onClick={() => setSelectedId(row.id)}
                  >
                    {row.prenom} {row.nom}
                  </button>
                  <div className="text-xs text-muted">{row.reference}</div>
                </td>
                <td className="px-4 py-3">
                  {row.categorie === 'PARTICULIER' ? 'Particulier' : 'Institution'}
                  {row.categorie === 'INSTITUTION' && row.partenaire?.nom ? (
                    <div className="text-xs text-muted">{row.partenaire.nom}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div>{row.telephone ?? '—'}</div>
                  <div className="text-xs text-muted">{row.email ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  {new Date(row.creeLe).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                    {STATUT_LABELS[row.statut] ?? row.statut}
                  </span>
                </td>
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

      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setSelectedId(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Pré-enregistrement
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  {detail ? `${detail.prenom} ${detail.nom}` : 'Chargement…'}
                </h2>
                {detail && (
                  <p className="mt-1 text-sm text-muted">
                    {detail.reference} · {STATUT_LABELS[detail.statut] ?? detail.statut}
                    {detail.dossier ? (
                      <>
                        {' '}
                        ·{' '}
                        <Link
                          className="font-semibold text-brand"
                          to={`/dossiers/${detail.dossier.id}`}
                        >
                          {detail.dossier.numero}
                        </Link>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                onClick={() => setSelectedId(null)}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {detailLoading || !detail ? (
                <p className="text-sm text-muted">Chargement du dossier…</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start gap-4">
                    <AuthPhoto id={detail.id} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const msg = buildPatientOutreachMessage({
                            prenom: detail.prenom,
                            nom: detail.nom,
                            numeroDossier:
                              detail.dossier?.numero ?? detail.reference,
                            statut: detail.statut,
                          });
                          const wa = whatsappChatUrl(detail.telephone, msg);
                          const mail = mailtoPatientUrl(detail.email, {
                            prenom: detail.prenom,
                            nom: detail.nom,
                            numeroDossier:
                              detail.dossier?.numero ?? detail.reference,
                            statut: detail.statut,
                          });
                          return (
                            <>
                              {wa ? (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Ouvrir WhatsApp avec message prérempli"
                                  className="inline-flex h-9 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition-ui hover:brightness-110"
                                >
                                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
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
                      {detail.motifRejet ? (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Motif : {detail.motifRejet}
                        </p>
                      ) : null}
                    </div>
                  </div>

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

                  <Section title="Identité">
                    <Field label="Nom" value={identite?.nom ?? detail.nom} />
                    <Field label="Prénom" value={identite?.prenom ?? detail.prenom} />
                    <Field label="Nom de naissance" value={identite?.nomNaissance} />
                    <Field
                      label="Sexe"
                      value={
                        identite?.sexe
                          ? SEXE_LABELS[identite.sexe] ?? identite.sexe
                          : null
                      }
                    />
                    <Field label="Date de naissance" value={fmtDate(identite?.dateNaissance)} />
                    <Field label="Lieu de naissance" value={identite?.lieuNaissance} />
                    <Field label="Pays de naissance" value={identite?.paysNaissance} />
                    <Field label="État civil" value={identite?.etatCivil} />
                    <Field
                      label="Nationalité"
                      value={identite?.nationaliteActuelle}
                    />
                    <Field
                      label="Nationalité de naissance"
                      value={identite?.nationaliteNaissance}
                    />
                    <Field
                      label="Autres nationalités"
                      value={identite?.autresNationalites}
                    />
                    <Field
                      label="Statut patient"
                      value={
                        identite?.statutPatient
                          ? STATUT_PATIENT_LABELS[identite.statutPatient] ??
                            identite.statutPatient
                          : null
                      }
                    />
                    <Field label="N° national" value={identite?.numeroNational} />
                    <Field
                      label="N° pièce d’identité"
                      value={identite?.numeroPieceIdentite}
                    />
                  </Section>

                  <Section title="Coordonnées">
                    <Field label="E-mail" value={coords?.email ?? detail.email} />
                    <Field
                      label="Téléphone / WhatsApp"
                      value={coords?.telephone ?? detail.telephone}
                    />
                    <div className="sm:col-span-2">
                      <Field label="Adresse" value={coords?.adresse} />
                    </div>
                  </Section>

                  <Section title="Document de voyage">
                    <Field label="Type" value={doc?.type} />
                    <Field
                      label="Numéro"
                      value={doc?.numero ?? detail.numeroPasseport}
                    />
                    <Field label="Délivrance" value={fmtDate(doc?.dateDelivrance)} />
                    <Field label="Expiration" value={fmtDate(doc?.dateExpiration)} />
                    <Field label="Pays de délivrance" value={doc?.paysDelivrance} />
                  </Section>

                  {(pro?.profession ||
                    pro?.employeurNom ||
                    pro?.employeurAdresse ||
                    pro?.employeurTelephone) && (
                    <Section title="Profession">
                      <Field label="Profession" value={pro?.profession} />
                      <Field label="Employeur" value={pro?.employeurNom} />
                      <Field label="Adresse employeur" value={pro?.employeurAdresse} />
                      <Field
                        label="Téléphone employeur"
                        value={pro?.employeurTelephone}
                      />
                    </Section>
                  )}

                  {(inst?.nom || detail.partenaire) && (
                    <Section title="Institution">
                      <Field
                        label="Nom"
                        value={detail.partenaire?.nom ?? inst?.nom}
                      />
                      <Field label="Adresse" value={inst?.adresse} />
                      <Field label="Téléphone" value={inst?.telephone} />
                      <Field
                        label="Contact"
                        value={
                          [inst?.contactPrenom, inst?.contactNom]
                            .filter(Boolean)
                            .join(' ') || null
                        }
                      />
                      <Field label="E-mail contact" value={inst?.contactEmail} />
                      <Field
                        label="Téléphone contact"
                        value={inst?.contactTelephone}
                      />
                    </Section>
                  )}

                  {tuteur && (tuteur.nom || tuteur.prenom) && (
                    <Section title="Tuteur">
                      <Field label="Nom" value={tuteur.nom} />
                      <Field label="Prénom" value={tuteur.prenom} />
                      <Field label="Nationalité" value={tuteur.nationalite} />
                      <Field label="Téléphone" value={tuteur.telephone} />
                      <Field label="E-mail" value={tuteur.email} />
                      <Field label="Adresse" value={tuteur.adresse} />
                    </Section>
                  )}

                  {d?.residenceEtrangere?.oui && (
                    <Section title="Résidence à l’étranger">
                      <Field
                        label="N° autorisation"
                        value={d.residenceEtrangere.numeroAutorisation}
                      />
                      <Field
                        label="Expiration"
                        value={fmtDate(d.residenceEtrangere.expirationAutorisation)}
                      />
                    </Section>
                  )}
                </>
              )}
            </div>

            {detail && (
              <div className="space-y-3 border-t border-[var(--border)] bg-canvas/60 px-5 py-4">
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
                  {detail.statut !== 'DOSSIER_CREE' && (
                    <Button type="button" onClick={() => creer.mutate(false)}>
                      Créer le dossier patient
                    </Button>
                  )}
                  {detail.statut !== 'DOSSIER_CREE' && doublons?.risque && (
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthPhoto({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/pre-inscriptions/${id}/photo`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        revoke = url;
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);

  if (!src) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-canvas text-xs text-muted">
        Pas de photo
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Photo patient"
      className="h-28 w-28 rounded-2xl object-cover"
    />
  );
}
