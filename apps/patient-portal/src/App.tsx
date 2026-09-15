import { FormEvent, useEffect, useMemo, useState } from 'react';
import { fetchInstitutions, formatApiError, submitPreInscription, type Institution } from '@/lib/api';
import {
  DOC_TYPES,
  ETAT_CIVIL,
  STATUT_PATIENT_OPTIONS,
  emptyForm,
  needsAutoriteParentale,
  stepsFor,
  type FormState,
  type StepId,
} from '@/lib/form';
import { validateStep } from '@/lib/validate';
import { cn } from '@/lib/utils';
import logoLight from '@/assets/logo-light.png';

function BrandCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4.5 10.5 L8.2 14 L15.5 6"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </span>
      {children}
      {error ? <span className="err">{error}</span> : null}
    </label>
  );
}

function Progress({ steps, index }: { steps: { id: StepId; label: string }[]; index: number }) {
  const pct = ((index + 1) / steps.length) * 100;
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/50">
        <span>
          Étape {index + 1} / {steps.length}
        </span>
        <span>{steps[index]?.label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 hidden gap-1 sm:flex">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-brand' : 'bg-black/10')}
            title={s.label}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = useMemo(() => stepsFor(form.categorie), [form.categorie]);
  const step = steps[stepIndex]?.id ?? 'profil';

  useEffect(() => {
    fetchInstitutions()
      .then(setInstitutions)
      .catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Recaler l’index si la liste d’étapes change (ex. passage Particulier ↔ Institution)
  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(Math.max(0, steps.length - 1));
  }, [steps.length, stepIndex]);

  function setIdentite<K extends keyof FormState['identite']>(key: K, value: FormState['identite'][K]) {
    setForm((f) => ({ ...f, identite: { ...f.identite, [key]: value } }));
  }

  function goToStep(id: StepId) {
    const i = steps.findIndex((s) => s.id === id);
    if (i >= 0) setStepIndex(i);
  }

  function next() {
    const e = validateStep(step, form);
    if (step === 'photo') {
      if (!photo) e.photo = 'Téléchargez une photo JPG ou PNG (max. 5 Mo)';
      else if (!['image/jpeg', 'image/jpg', 'image/png'].includes(photo.type)) {
        e.photo = 'Formats acceptés : JPG, JPEG, PNG';
      } else if (photo.size > 5 * 1024 * 1024) {
        e.photo = 'Fichier trop volumineux (max. 5 Mo)';
      }
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function back() {
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e = validateStep('verification', form);
    setErrors(e);
    if (Object.keys(e).length || !photo) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        categorie: form.categorie,
        partenaireId: form.partenaireId || undefined,
        institution: undefined,
        identite: {
          ...form.identite,
          nomNaissance: form.identite.nomNaissance || undefined,
          autresNationalites: form.identite.autresNationalites || undefined,
          numeroPieceIdentite: form.identite.numeroPieceIdentite || undefined,
          numeroNational: form.identite.numeroPieceIdentite || undefined,
        },
        tuteur: needsAutoriteParentale(form.identite.statutPatient) ? form.tuteur : undefined,
        coordonnees: form.coordonnees,
        residenceEtrangere: {
          oui: !!form.residenceEtrangere.oui,
          numeroAutorisation: form.residenceEtrangere.numeroAutorisation || undefined,
          expirationAutorisation:
            form.residenceEtrangere.expirationAutorisation || undefined,
        },
        documentVoyage: form.documentVoyage,
        professionnel:
          form.categorie === 'PARTICULIER' ? form.professionnel : undefined,
        confirmationExactitude: form.confirmationExactitude,
        website: form.website,
      };
      const res = await submitPreInscription(payload, photo);
      setResult({ reference: res.reference, message: res.message });
      setStepIndex(steps.length - 1);
    } catch (err: unknown) {
      setSubmitError(
        formatApiError(err, 'La transmission a échoué. Vérifiez votre connexion et réessayez.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result && step === 'confirmation') {
    return (
      <Shell>
        <div className="mx-auto max-w-xl rounded-3xl border border-black/10 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-2xl text-brand">
            ✓
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand">Demande transmise</h1>
          <p className="mt-3 text-ink/70">{result.message}</p>
          <p className="mt-6 rounded-2xl bg-canvas px-4 py-3 font-mono text-sm font-semibold text-brand">
            Référence : {result.reference}
          </p>
          <p className="mt-4 text-sm text-ink/55">
            Conservez cette référence. Notre équipe vérifiera vos informations avant la création
            définitive de votre dossier.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">eXpert SARLU</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Pré-enregistrement patient
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink/65">
            Remplissez ce formulaire pour transmettre votre dossier à distance. Un conseiller
            vérifiera vos informations avant toute prise en charge.
          </p>
        </header>

        <form
          onSubmit={step === 'verification' ? onSubmit : (e) => e.preventDefault()}
          className="rounded-3xl border border-black/10 bg-white p-5 shadow-soft sm:p-8"
        >
          <Progress steps={steps} index={stepIndex} />

          {/* honeypot */}
          <input
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            name="website"
          />

          {step === 'profil' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Quel est votre type de dossier ?</h2>
              <p className="text-sm text-ink/60">
                Sélectionnez clairement le type qui correspond à votre situation.
              </p>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Type de dossier">
                {(
                  [
                    {
                      id: 'PARTICULIER' as const,
                      title: 'Particulier',
                      desc: 'Inscription individuelle, sans rattachement institutionnel.',
                    },
                    {
                      id: 'INSTITUTION' as const,
                      title: 'Institution / Entreprise partenaire',
                      desc: 'Patient envoyé ou pris en charge par une organisation partenaire d’eXpert SARLU.',
                    },
                  ] as const
                ).map((opt) => {
                  const selected = form.categorie === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={
                        selected
                          ? 'relative cursor-pointer rounded-2xl border-2 border-[#144EB9] bg-[#144EB9]/10 p-5 text-left shadow-soft ring-2 ring-[#144EB9]/30'
                          : 'relative cursor-pointer rounded-2xl border-2 border-black/10 bg-white p-5 text-left transition hover:border-[#144EB9]/40'
                      }
                    >
                      <input
                        type="radio"
                        name="type-dossier"
                        value={opt.id}
                        checked={selected}
                        className="sr-only"
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            categorie: opt.id,
                            partenaireId: opt.id === 'PARTICULIER' ? '' : f.partenaireId,
                          }))
                        }
                      />
                      {selected ? (
                        <span className="absolute right-3 top-3 rounded-full bg-[#144EB9] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          Sélectionné
                        </span>
                      ) : null}
                      <div className="flex items-start gap-3 pr-16">
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 9999,
                            border: selected ? '2px solid #144EB9' : '2px solid rgba(10,10,10,0.28)',
                            background: selected ? '#144EB9' : '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2,
                            boxShadow: selected ? '0 0 0 3px rgba(20,78,185,0.22)' : undefined,
                          }}
                          aria-hidden
                        >
                          {selected ? <BrandCheck /> : null}
                        </span>
                        <div>
                          <div
                            className="text-base font-bold"
                            style={{ color: selected ? '#144EB9' : '#0A0A0A' }}
                          >
                            {opt.title}
                          </div>
                          <p className="mt-1 text-sm text-ink/60">{opt.desc}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {form.categorie ? (
                <p className="rounded-xl bg-brand/[0.06] px-4 py-3 text-sm font-semibold text-brand">
                  Type choisi :{' '}
                  {form.categorie === 'PARTICULIER'
                    ? 'Particulier'
                    : 'Institution / Entreprise partenaire'}
                </p>
              ) : null}
              {errors.categorie ? <p className="err">{errors.categorie}</p> : null}
            </section>
          )}

          {step === 'identite' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Identité & état civil</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de famille" required error={errors['identite.nom']}>
                  <input className="field" value={form.identite.nom} onChange={(e) => setIdentite('nom', e.target.value)} />
                </Field>
                <Field label="Nom de naissance / anciens noms">
                  <input className="field" value={form.identite.nomNaissance} onChange={(e) => setIdentite('nomNaissance', e.target.value)} />
                </Field>
                <Field label="Prénom(s)" required error={errors['identite.prenom']}>
                  <input className="field" value={form.identite.prenom} onChange={(e) => setIdentite('prenom', e.target.value)} />
                </Field>
                <Field label="Date de naissance" required error={errors['identite.dateNaissance']}>
                  <input type="date" className="field" value={form.identite.dateNaissance} onChange={(e) => setIdentite('dateNaissance', e.target.value)} />
                </Field>
                <Field label="Lieu de naissance">
                  <input className="field" value={form.identite.lieuNaissance} onChange={(e) => setIdentite('lieuNaissance', e.target.value)} />
                </Field>
                <Field label="Pays de naissance">
                  <input className="field" value={form.identite.paysNaissance} onChange={(e) => setIdentite('paysNaissance', e.target.value)} />
                </Field>
                <Field label="Nationalité actuelle" required error={errors['identite.nationaliteActuelle']}>
                  <input className="field" value={form.identite.nationaliteActuelle} onChange={(e) => setIdentite('nationaliteActuelle', e.target.value)} />
                </Field>
                <Field label="Nationalité à la naissance (si différente)">
                  <input className="field" value={form.identite.nationaliteNaissance} onChange={(e) => setIdentite('nationaliteNaissance', e.target.value)} />
                </Field>
                <Field label="Autres nationalités">
                  <input className="field" value={form.identite.autresNationalites} onChange={(e) => setIdentite('autresNationalites', e.target.value)} />
                </Field>
                <Field label="Numéro de pièce d’identité">
                  <input className="field" value={form.identite.numeroPieceIdentite} onChange={(e) => setIdentite('numeroPieceIdentite', e.target.value)} />
                </Field>
                <Field label="Sexe" required error={errors['identite.sexe']}>
                  <select className="field" value={form.identite.sexe} onChange={(e) => setIdentite('sexe', e.target.value as FormState['identite']['sexe'])}>
                    <option value="">Sélectionner…</option>
                    <option value="MASCULIN">Masculin</option>
                    <option value="FEMININ">Féminin</option>
                  </select>
                </Field>
                <Field label="État civil" required error={errors['identite.etatCivil']}>
                  <select className="field" value={form.identite.etatCivil} onChange={(e) => setIdentite('etatCivil', e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {ETAT_CIVIL.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Statut du patient" required error={errors['identite.statutPatient']}>
                  <select
                    className="field"
                    value={form.identite.statutPatient}
                    onChange={(e) =>
                      setIdentite('statutPatient', e.target.value as FormState['identite']['statutPatient'])
                    }
                  >
                    <option value="">Sélectionner…</option>
                    {STATUT_PATIENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {needsAutoriteParentale(form.identite.statutPatient) && (
                <div className="mt-6 rounded-2xl border border-brand/25 bg-brand/[0.04] p-4">
                  <h3 className="font-bold text-brand">Autorité parentale / Tuteur légal</h3>
                  <p className="mb-3 text-sm text-ink/60">
                    Section affichée car le statut choisi implique une tutelle ou une autorité parentale.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom" required error={errors['tuteur.nom']}>
                      <input className="field" value={form.tuteur.nom} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, nom: e.target.value } })} />
                    </Field>
                    <Field label="Prénom" required error={errors['tuteur.prenom']}>
                      <input className="field" value={form.tuteur.prenom} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, prenom: e.target.value } })} />
                    </Field>
                    <Field label="Adresse">
                      <input className="field" value={form.tuteur.adresse} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, adresse: e.target.value } })} />
                    </Field>
                    <Field label="Téléphone" required error={errors['tuteur.telephone']}>
                      <input className="field" value={form.tuteur.telephone} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, telephone: e.target.value } })} />
                    </Field>
                    <Field label="E-mail">
                      <input className="field" type="email" value={form.tuteur.email} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, email: e.target.value } })} />
                    </Field>
                    <Field label="Nationalité">
                      <input className="field" value={form.tuteur.nationalite} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, nationalite: e.target.value } })} />
                    </Field>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 'coordonnees' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Coordonnées</h2>
              <Field label="Adresse complète du domicile" required error={errors['coordonnees.adresse']}>
                <textarea className="field min-h-[88px]" value={form.coordonnees.adresse} onChange={(e) => setForm({ ...form, coordonnees: { ...form.coordonnees, adresse: e.target.value } })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Adresse électronique" required error={errors['coordonnees.email']}>
                  <input type="email" className="field" value={form.coordonnees.email} onChange={(e) => setForm({ ...form, coordonnees: { ...form.coordonnees, email: e.target.value } })} />
                </Field>
                <Field label="Numéro WhatsApp" required error={errors['coordonnees.telephone']}>
                  <input
                    className="field"
                    placeholder="Ex. +243 800 000 000"
                    value={form.coordonnees.telephone}
                    onChange={(e) => setForm({ ...form, coordonnees: { ...form.coordonnees, telephone: e.target.value } })}
                  />
                </Field>
              </div>
              <div className="rounded-2xl border border-black/10 p-4">
                <p className="mb-3 font-semibold">
                  Résidez-vous actuellement dans un pays autre que celui de votre nationalité ?
                </p>
                <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Résidence hors nationalité">
                  {[
                    { value: false, label: 'Non' },
                    { value: true, label: 'Oui' },
                  ].map((opt) => {
                    const selected = form.residenceEtrangere.oui === opt.value;
                    return (
                      <label
                        key={String(opt.value)}
                        className={
                          selected
                            ? 'relative flex min-w-[120px] cursor-pointer items-center gap-2.5 rounded-xl border-2 border-[#144EB9] bg-[#144EB9]/10 px-4 py-3 text-sm font-semibold text-[#144EB9] shadow-soft ring-2 ring-[#144EB9]/25'
                            : 'relative flex min-w-[120px] cursor-pointer items-center gap-2.5 rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-[#144EB9]/40'
                        }
                      >
                        <input
                          type="radio"
                          name="residence-etrangere"
                          className="sr-only"
                          checked={selected}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              residenceEtrangere: { ...f.residenceEtrangere, oui: opt.value },
                            }))
                          }
                        />
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 9999,
                            border: selected ? '2px solid #144EB9' : '2px solid rgba(10,10,10,0.28)',
                            background: selected ? '#144EB9' : '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          aria-hidden
                        >
                          {selected ? <BrandCheck /> : null}
                        </span>
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {errors['residenceEtrangere.oui'] ? (
                  <p className="err">{errors['residenceEtrangere.oui']}</p>
                ) : null}
                {form.residenceEtrangere.oui && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="N° autorisation de séjour" required error={errors['residenceEtrangere.numeroAutorisation']}>
                      <input className="field" value={form.residenceEtrangere.numeroAutorisation} onChange={(e) => setForm({ ...form, residenceEtrangere: { ...form.residenceEtrangere, numeroAutorisation: e.target.value } })} />
                    </Field>
                    <Field label="Date d’expiration" required error={errors['residenceEtrangere.expirationAutorisation']}>
                      <input type="date" className="field" value={form.residenceEtrangere.expirationAutorisation} onChange={(e) => setForm({ ...form, residenceEtrangere: { ...form.residenceEtrangere, expirationAutorisation: e.target.value } })} />
                    </Field>
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 'voyage' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Document de voyage</h2>
              <Field label="Type de document" required>
                <select
                  className="field"
                  value={form.documentVoyage.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      documentVoyage: { ...form.documentVoyage, type: e.target.value },
                    })
                  }
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Numéro du document" required error={errors['documentVoyage.numero']}>
                  <input className="field" value={form.documentVoyage.numero} onChange={(e) => setForm({ ...form, documentVoyage: { ...form.documentVoyage, numero: e.target.value } })} />
                </Field>
                <Field label="Pays ayant délivré le document" required error={errors['documentVoyage.paysDelivrance']}>
                  <input className="field" value={form.documentVoyage.paysDelivrance} onChange={(e) => setForm({ ...form, documentVoyage: { ...form.documentVoyage, paysDelivrance: e.target.value } })} />
                </Field>
                <Field label="Date de délivrance" required error={errors['documentVoyage.dateDelivrance']}>
                  <input type="date" className="field" value={form.documentVoyage.dateDelivrance} onChange={(e) => setForm({ ...form, documentVoyage: { ...form.documentVoyage, dateDelivrance: e.target.value } })} />
                </Field>
                <Field label="Date d’expiration" required error={errors['documentVoyage.dateExpiration']}>
                  <input type="date" className="field" value={form.documentVoyage.dateExpiration} onChange={(e) => setForm({ ...form, documentVoyage: { ...form.documentVoyage, dateExpiration: e.target.value } })} />
                </Field>
              </div>
            </section>
          )}

          {step === 'pro' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Situation professionnelle</h2>
              <p className="text-sm text-ink/60">
                Employé, étudiant, indépendant, sans emploi ou autre — adaptez les champs à votre situation.
              </p>
              <Field label="Profession actuelle">
                <input className="field" value={form.professionnel.profession} onChange={(e) => setForm({ ...form, professionnel: { ...form.professionnel, profession: e.target.value } })} />
              </Field>
              <Field label="Nom de l’employeur / établissement d’enseignement">
                <input className="field" value={form.professionnel.employeurNom} onChange={(e) => setForm({ ...form, professionnel: { ...form.professionnel, employeurNom: e.target.value } })} />
              </Field>
              <Field label="Adresse">
                <input className="field" value={form.professionnel.employeurAdresse} onChange={(e) => setForm({ ...form, professionnel: { ...form.professionnel, employeurAdresse: e.target.value } })} />
              </Field>
              <Field label="Téléphone">
                <input className="field" value={form.professionnel.employeurTelephone} onChange={(e) => setForm({ ...form, professionnel: { ...form.professionnel, employeurTelephone: e.target.value } })} />
              </Field>
            </section>
          )}

          {step === 'accompagnateur' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Accompagnateur</h2>
              <p className="text-sm text-ink/60">
                Optionnel — renseignez uniquement si une personne voyage avec le patient.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom">
                  <input
                    className="field"
                    value={form.accompagnateur.nom}
                    onChange={(e) =>
                      setForm({ ...form, accompagnateur: { ...form.accompagnateur, nom: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Prénom">
                  <input
                    className="field"
                    value={form.accompagnateur.prenom}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        accompagnateur: { ...form.accompagnateur, prenom: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Lien avec le patient">
                  <input
                    className="field"
                    placeholder="Époux, parent, ami…"
                    value={form.accompagnateur.lien}
                    onChange={(e) =>
                      setForm({ ...form, accompagnateur: { ...form.accompagnateur, lien: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Téléphone">
                  <input
                    className="field"
                    value={form.accompagnateur.telephone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        accompagnateur: { ...form.accompagnateur, telephone: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          )}

          {step === 'institution' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Institution partenaire</h2>
              <p className="text-sm text-ink/60">
                Choisissez l’institution ou l’entreprise partenaire déjà enregistrée chez eXpert SARLU.
              </p>
              <Field label="Institution partenaire" required error={errors.institution}>
                <select
                  className="field"
                  value={form.partenaireId}
                  onChange={(e) => setForm({ ...form, partenaireId: e.target.value })}
                >
                  <option value="">Sélectionner une institution…</option>
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom}
                      {i.pays ? ` (${i.pays})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {institutions.length === 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Aucune institution partenaire n’est disponible pour le moment. Contactez eXpert SARLU
                  ou réessayez plus tard.
                </p>
              )}
              {form.partenaireId && (
                <p className="rounded-xl bg-brand/[0.06] px-4 py-3 text-sm font-semibold text-brand">
                  Institution sélectionnée :{' '}
                  {institutions.find((i) => i.id === form.partenaireId)?.nom ?? form.partenaireId}
                </p>
              )}
            </section>
          )}

          {step === 'photo' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Photo de profil</h2>
              <p className="text-sm text-ink/60">JPG, JPEG ou PNG — 5 Mo maximum.</p>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-brand/40 bg-brand/[0.06]">
                  {preview ? (
                    <img src={preview} alt="Aperçu" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-3 text-center text-xs text-ink/45">Aperçu</span>
                  )}
                </div>
                <div>
                  <label className="btn-primary cursor-pointer">
                    Télécharger ma photo
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setPhoto(f);
                      }}
                    />
                  </label>
                  {photo ? (
                    <button
                      type="button"
                      className="btn-ghost ml-2"
                      onClick={() => setPhoto(null)}
                    >
                      Remplacer
                    </button>
                  ) : null}
                  {errors.photo ? <p className="err mt-2">{errors.photo}</p> : null}
                </div>
              </div>
            </section>
          )}

          {step === 'verification' && (
            <section className="space-y-5">
              <h2 className="text-2xl font-extrabold tracking-tight">Vérifiez vos informations</h2>
              <SummaryBlock title="Profil" onEdit={() => goToStep('profil')}>
                {form.categorie === 'PARTICULIER' ? 'Particulier' : 'Institution / Entreprise partenaire'}
              </SummaryBlock>
              <SummaryBlock title="Identité" onEdit={() => goToStep('identite')}>
                {form.identite.prenom} {form.identite.nom} · né(e) le {form.identite.dateNaissance}
                <br />
                {form.identite.nationaliteActuelle} · {form.identite.sexe} · {form.identite.etatCivil}
                <br />
                Statut :{' '}
                {STATUT_PATIENT_OPTIONS.find((o) => o.value === form.identite.statutPatient)?.label ??
                  '—'}
              </SummaryBlock>
              <SummaryBlock title="Coordonnées" onEdit={() => goToStep('coordonnees')}>
                {form.coordonnees.adresse}
                <br />
                {form.coordonnees.email} · WhatsApp {form.coordonnees.telephone}
              </SummaryBlock>
              <SummaryBlock title="Document de voyage" onEdit={() => goToStep('voyage')}>
                {form.documentVoyage.numero} ({form.documentVoyage.type})
                <br />
                Délivré le {form.documentVoyage.dateDelivrance}, expire le{' '}
                {form.documentVoyage.dateExpiration} — {form.documentVoyage.paysDelivrance}
              </SummaryBlock>
              {form.categorie === 'PARTICULIER' && (
                <SummaryBlock title="Profession" onEdit={() => goToStep('pro')}>
                  {form.professionnel.profession || '—'}
                  {form.professionnel.employeurNom
                    ? ` · ${form.professionnel.employeurNom}`
                    : ''}
                </SummaryBlock>
              )}
              {form.categorie === 'INSTITUTION' && (
                <SummaryBlock title="Institution" onEdit={() => goToStep('institution')}>
                  {institutions.find((i) => i.id === form.partenaireId)?.nom ?? '—'}
                </SummaryBlock>
              )}
              <SummaryBlock title="Photo" onEdit={() => goToStep('photo')}>
                {photo ? photo.name : 'Aucune photo'}
              </SummaryBlock>

              <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-brand/[0.04] p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.confirmationExactitude}
                  onChange={(e) =>
                    setForm({ ...form, confirmationExactitude: e.target.checked })
                  }
                />
                <span>
                  Je confirme que les informations fournies sont exactes et complètes.
                  {errors.confirmationExactitude ? (
                    <span className="err block">{errors.confirmationExactitude}</span>
                  ) : null}
                </span>
              </label>
              {submitError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </p>
              ) : null}
            </section>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5">
            <button type="button" className="btn-ghost" onClick={back} disabled={stepIndex === 0}>
              Retour
            </button>
            {step === 'verification' ? (
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Transmission…' : 'Envoyer ma demande'}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={next}>
                Continuer
              </button>
            )}
          </div>
        </form>
      </div>
    </Shell>
  );
}

function SummaryBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-bold">{title}</h3>
        <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={onEdit}>
          Modifier
        </button>
      </div>
      <div className="text-sm text-ink/70">{children}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto mb-10 flex max-w-5xl items-center justify-between gap-4">
        <img
          src={logoLight}
          alt="eXpert SARLU"
          className="h-14 w-auto max-w-[240px] object-contain object-left sm:h-16 sm:max-w-[280px]"
        />
        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-ink/50 shadow-soft">
          Portail sécurisé
        </span>
      </div>
      {children}
      <footer className="mx-auto mt-12 max-w-3xl text-center text-xs text-ink/40">
        Vos données sont transmises de façon sécurisée à eXpert SARLU pour vérification interne.
        Ce portail n’est pas l’espace de gestion interne.
      </footer>
    </div>
  );
}
