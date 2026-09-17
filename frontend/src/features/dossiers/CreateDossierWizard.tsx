import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Step = 'profil' | 'identite' | 'coordonnees' | 'voyage' | 'accompagnateur' | 'recap';

const STEPS: { id: Step; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'identite', label: 'Identité' },
  { id: 'coordonnees', label: 'Coordonnées' },
  { id: 'voyage', label: 'Voyage' },
  { id: 'accompagnateur', label: 'Accompagnateur' },
  { id: 'recap', label: 'Récapitulatif' },
];

type FormState = {
  typeClient: 'PARTICULIER' | 'INSTITUTION';
  destination: string;
  pathologie: string;
  priorite: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  email: string;
  telephone: string;
  adresse: string;
  numeroPasseport: string;
  accompagnateurNom: string;
  accompagnateurPrenom: string;
  accompagnateurLien: string;
  accompagnateurTelephone: string;
};

const empty: FormState = {
  typeClient: 'PARTICULIER',
  destination: '',
  pathologie: '',
  priorite: 'NORMALE',
  nom: '',
  prenom: '',
  dateNaissance: '',
  nationalite: '',
  email: '',
  telephone: '',
  adresse: '',
  numeroPasseport: '',
  accompagnateurNom: '',
  accompagnateurPrenom: '',
  accompagnateurLien: '',
  accompagnateurTelephone: '',
};

export function CreateDossierWizard({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (p: {
    data: Record<string, unknown>;
    photo?: File | null;
    passeport?: File | null;
    documentMedical?: File | null;
  }) => void;
  loading: boolean;
}) {
  const [step, setStep] = useState<Step>('profil');
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [passeport, setPasseport] = useState<File | null>(null);
  const [documentMedical, setDocumentMedical] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [partenaires, setPartenaires] = useState<{ id: string; nom: string }[]>([]);
  const [partenaireId, setPartenaireId] = useState('');

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    void api
      .get<{ id: string; nom: string }[]>('/partenaires')
      .then((r) => setPartenaires(r.data))
      .catch(() => undefined);
  }, []);

  const idx = STEPS.findIndex((s) => s.id === step);

  const canNext = useMemo(() => {
    if (step === 'profil') return !!form.typeClient;
    if (step === 'identite') return !!form.nom.trim() && !!form.prenom.trim();
    if (step === 'coordonnees') return !!form.email.trim() && !!form.telephone.trim();
    if (step === 'voyage') return !!passeport;
    return true;
  }, [form, step, passeport]);

  const buildPayload = () => {
    const accompagnateurs =
      form.accompagnateurNom.trim() && form.accompagnateurPrenom.trim()
        ? [
            {
              nom: form.accompagnateurNom.trim(),
              prenom: form.accompagnateurPrenom.trim(),
              lien: form.accompagnateurLien.trim() || undefined,
              telephone: form.accompagnateurTelephone.trim() || undefined,
            },
          ]
        : [];
    return {
      typeClient: form.typeClient,
      destination: form.destination || undefined,
      pathologie: form.pathologie || undefined,
      priorite: form.priorite,
      partenaireId: partenaireId || undefined,
      patient: {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        dateNaissance: form.dateNaissance || undefined,
        nationalite: form.nationalite || undefined,
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        adresse: form.adresse || undefined,
        numeroPasseport: form.numeroPasseport || undefined,
      },
      accompagnateurs,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-soft">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-xl font-extrabold">Nouveau dossier patient</h2>
          <p className="text-sm text-muted">
            Même parcours que le pré-enregistrement — création manuelle dans eXpert.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  i <= idx ? 'bg-brand text-white' : 'bg-canvas text-muted'
                }`}
              >
                {i + 1}. {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-5 py-5">
          {step === 'profil' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Type de dossier</p>
              {(['PARTICULIER', 'INSTITUTION'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, typeClient: t })}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                    form.typeClient === t
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {t === 'PARTICULIER' ? 'Particulier' : 'Institution / Entreprise partenaire'}
                </button>
              ))}
              {form.typeClient === 'INSTITUTION' && (
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
                  value={partenaireId}
                  onChange={(e) => setPartenaireId(e.target.value)}
                >
                  <option value="">Institution partenaire…</option>
                  {partenaires.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              )}
              <Input
                placeholder="Destination"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
              <Input
                placeholder="Pathologie / motif"
                value={form.pathologie}
                onChange={(e) => setForm({ ...form, pathologie: e.target.value })}
              />
            </div>
          )}

          {step === 'identite' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Nom *" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              <Input placeholder="Prénom *" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              <Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
              <Input placeholder="Nationalité" value={form.nationalite} onChange={(e) => setForm({ ...form, nationalite: e.target.value })} />
              <label className="col-span-full flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-canvas px-4 py-5">
                {preview ? (
                  <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <span className="text-sm text-muted">Photo patient (optionnel)</span>
                )}
                <span className="text-xs font-semibold text-brand">Choisir une photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}

          {step === 'coordonnees' && (
            <div className="space-y-3">
              <Input required type="email" placeholder="E-mail *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input required placeholder="WhatsApp * (ex. +243…)" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              <textarea
                className="min-h-20 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-sm"
                placeholder="Adresse"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />
            </div>
          )}

          {step === 'voyage' && (
            <div className="space-y-3">
              <Input
                placeholder="N° passeport / document de voyage"
                value={form.numeroPasseport}
                onChange={(e) => setForm({ ...form, numeroPasseport: e.target.value })}
              />
              <label className="flex cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-[var(--border)] bg-canvas px-4 py-3">
                <span className="text-sm font-semibold">Passeport (scan / photo) *</span>
                <span className="text-xs text-muted">
                  {passeport ? passeport.name : 'PDF, JPG ou PNG — max. 10 Mo'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setPasseport(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="flex cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-[var(--border)] bg-canvas px-4 py-3">
                <span className="text-sm font-semibold">Document médical (optionnel)</span>
                <span className="text-xs text-muted">
                  {documentMedical ? documentMedical.name : 'Ordonnance, rapport… — max. 10 Mo'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setDocumentMedical(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {step === 'accompagnateur' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">Optionnel — laissez vide s’il n’y a pas d’accompagnateur.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Nom" value={form.accompagnateurNom} onChange={(e) => setForm({ ...form, accompagnateurNom: e.target.value })} />
                <Input placeholder="Prénom" value={form.accompagnateurPrenom} onChange={(e) => setForm({ ...form, accompagnateurPrenom: e.target.value })} />
                <Input placeholder="Lien (époux, parent…)" value={form.accompagnateurLien} onChange={(e) => setForm({ ...form, accompagnateurLien: e.target.value })} />
                <Input placeholder="Téléphone" value={form.accompagnateurTelephone} onChange={(e) => setForm({ ...form, accompagnateurTelephone: e.target.value })} />
              </div>
            </div>
          )}

          {step === 'recap' && (
            <div className="space-y-2 rounded-xl bg-canvas p-4 text-sm">
              <p>
                <strong>
                  {form.prenom} {form.nom}
                </strong>{' '}
                · {form.typeClient === 'PARTICULIER' ? 'Particulier' : 'Institution'}
              </p>
              <p>
                {form.email} · WhatsApp {form.telephone}
              </p>
              {form.destination && <p>Destination : {form.destination}</p>}
              <p>Passeport fichier : {passeport ? passeport.name : '—'}</p>
              <p>Document médical : {documentMedical ? documentMedical.name : 'Aucun'}</p>
              {(form.accompagnateurNom || form.accompagnateurPrenom) && (
                <p>
                  Accompagnateur : {form.accompagnateurPrenom} {form.accompagnateurNom}
                  {form.accompagnateurLien ? ` (${form.accompagnateurLien})` : ''}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] px-5 py-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          {idx > 0 && (
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setStep(STEPS[idx - 1].id)}
            >
              Retour
            </Button>
          )}
          {step !== 'recap' ? (
            <Button
              type="button"
              className="flex-1"
              disabled={!canNext}
              onClick={() => {
                if (!canNext) {
                  toast.error('Complétez les champs obligatoires');
                  return;
                }
                setStep(STEPS[idx + 1].id);
              }}
            >
              Continuer
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={loading}
              onClick={() => {
                if (!passeport) {
                  toast.error('Le scan du passeport est obligatoire');
                  setStep('voyage');
                  return;
                }
                onSubmit({ data: buildPayload(), photo, passeport, documentMedical });
              }}
            >
              Créer le dossier
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
