import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import logoLight from '@/assets/logo-light.png';

const STATUT_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_COURS: 'En cours',
  VALIDE: 'Validé',
  FACTURE_PAYE: 'Facturé & Payé',
  VERROUILLE: 'Verrouillé',
};

const TACHE_STATUT: Record<string, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  BLOQUE: 'Bloqué',
};

const TACHE_TYPE: Record<string, string> = {
  VISA: 'Visa',
  NAVETTE: 'Navette',
  VOL: 'Vol',
  AUTRE: 'Autre',
  AMBASSADE: 'Ambassade',
  HOPITAL: 'Hôpital',
};

const POST_RETOUR: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  RENTRE: 'Rentré',
  SUIVI: 'Suivi actif',
  CLOS: 'Clos',
};

type SuiviData = {
  numero: string;
  statut: string;
  destination?: string | null;
  pathologie?: string | null;
  postRetourStatut?: string | null;
  patient?: {
    prenom: string;
    nom: string;
    hasPhoto?: boolean;
  } | null;
  tachesLogistique?: { titre: string; type: string; statut: string }[];
  rendezVous?: { type: string; dateHeure: string; lieu?: string; statut: string }[];
};

export function SuiviPage({ token }: { token: string }) {
  const [data, setData] = useState<SuiviData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { data: payload } = await api.get<SuiviData>(`/client/suivi/${token}`);
        if (!cancelled) setData(payload);
      } catch (e) {
        if (!cancelled) {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Ce suivi patient n’existe pas ou a expiré.';
          setError(msg);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!token || !data?.patient?.hasPhoto) {
      setPhotoUrl(null);
      return;
    }
    void (async () => {
      try {
        const base = api.defaults.baseURL || '/api';
        const r = await fetch(`${base}/client/suivi/${token}/photo`);
        if (!r.ok || cancelled) return;
        const blob = await r.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, data?.patient?.hasPhoto]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071428] p-6">
        <div className="mx-auto max-w-md">
          <div className="h-[520px] animate-pulse rounded-[28px] bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071428] p-6 text-white">
        <div className="max-w-md text-center">
          <img src={logoLight} alt="" className="mx-auto h-10" />
          <h1 className="mt-4 text-2xl font-extrabold">Lien invalide</h1>
          <p className="mt-2 text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  const name = data.patient ? `${data.patient.prenom} ${data.patient.nom}` : 'Patient';
  const initials =
    `${data.patient?.prenom?.[0] ?? ''}${data.patient?.nom?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071428] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 0%, #144EB9 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 90% 80%, #0ea5e9 0%, transparent 50%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center p-5 sm:p-8">
        <article className="overflow-hidden rounded-[28px] bg-white text-slate-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]">
          <div className="relative bg-gradient-to-br from-[#0B1F44] via-[#144EB9] to-[#1d4ed8] px-6 pb-16 pt-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <img src={logoLight} alt="eXpert" className="h-8 w-auto" />
              <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                Carte d’assistance
              </span>
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Prise en charge médicale
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{name}</h1>
            <p className="mt-1 font-mono text-sm text-sky-100">{data.numero}</p>

            <div className="absolute -bottom-12 left-6">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-200 shadow-lg">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 text-2xl font-extrabold text-slate-500">
                    {initials}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 pb-7 pt-16">
            <div className="grid grid-cols-2 gap-3">
              <Meta label="Statut" value={STATUT_LABELS[data.statut] ?? data.statut} accent />
              <Meta label="Destination" value={data.destination} />
              <Meta label="Pathologie" value={data.pathologie} />
              <Meta
                label="Post-retour"
                value={
                  data.postRetourStatut
                    ? POST_RETOUR[data.postRetourStatut] ?? data.postRetourStatut
                    : '—'
                }
              />
            </div>

            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Missions logistiques
              </h2>
              <ul className="space-y-2">
                {(data.tachesLogistique ?? []).map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-[#144EB9]">
                        {TACHE_TYPE[t.type] ?? t.type}
                      </span>
                      <span className="text-slate-600"> · {t.titre}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {TACHE_STATUT[t.statut] ?? t.statut}
                    </span>
                  </li>
                ))}
                {(data.tachesLogistique ?? []).length === 0 && (
                  <li className="text-sm text-slate-400">Aucune mission planifiée</li>
                )}
              </ul>
            </section>

            {(data.rendezVous ?? []).length > 0 && (
              <section>
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Rendez-vous
                </h2>
                <ul className="space-y-2">
                  {data.rendezVous!.map((r, i) => (
                    <li key={i} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                      <div className="font-semibold">
                        {TACHE_TYPE[r.type] ?? r.type} ·{' '}
                        {new Date(r.dateHeure).toLocaleString('fr-FR')}
                      </div>
                      <div className="text-slate-500">
                        {r.lieu ?? 'Lieu à confirmer'} · {r.statut}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
              L&apos;EXPERT SARLU — Évacuation & Mobilité Médicale Internationale
            </footer>
          </div>
        </article>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string | null;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-bold ${accent ? 'text-[#144EB9]' : 'text-slate-900'}`}>
        {value || '—'}
      </div>
    </div>
  );
}
