import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { isLikelyPortraitUrl } from '@/lib/patient-photo';
import { STATUT_LABELS } from '@/lib/utils';
import { labelOf, TACHE_STATUT_LABELS, RDV_TYPE_LABELS, POST_RETOUR_LABELS } from '@/lib/status-labels';
import logoBlue from '@/assets/logos/logo-blue.png';

export function SuiviPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['suivi', token],
    queryFn: async () => (await api.get(`/client/suivi/${token}`)).data,
    enabled: !!token,
    retry: 1,
  });

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!token || !data?.patient?.hasPhoto) {
      setPhotoUrl(null);
      return;
    }
    void (async () => {
      try {
        const { res } = await fetchPhoto(token);
        if (cancelled || !res) return;
        objectUrl = URL.createObjectURL(res);
        const ok = await isLikelyPortraitUrl(objectUrl);
        if (cancelled) return;
        if (ok) setPhotoUrl(objectUrl);
        else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          setPhotoUrl(null);
        }
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, data?.patient?.hasPhoto]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#071428] p-6">
        <div className="mx-auto max-w-md">
          <div className="h-[520px] animate-pulse rounded-[28px] bg-white/10" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const msg =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      'Ce suivi patient n’existe pas ou a expiré.';
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071428] p-6 text-white">
        <div className="max-w-md text-center">
          <img src={logoBlue} alt="" className="mx-auto h-10 brightness-0 invert" />
          <h1 className="mt-4 text-2xl font-extrabold">Lien invalide</h1>
          <p className="mt-2 text-white/70">{msg}</p>
        </div>
      </div>
    );
  }

  const name = data.patient
    ? `${data.patient.prenom} ${data.patient.nom}`
    : 'Patient';
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
              <img src={logoBlue} alt="eXpert" className="h-8 w-auto brightness-0 invert" />
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
              <Meta
                label="Statut"
                value={STATUT_LABELS[data.statut] ?? data.statut}
                accent
              />
              <Meta label="Destination" value={data.destination} />
              <Meta label="Pathologie" value={data.pathologie} />
              <Meta
                label="Post-retour"
                value={
                  data.postRetourStatut
                    ? POST_RETOUR_LABELS[data.postRetourStatut] ?? data.postRetourStatut
                    : '—'
                }
              />
            </div>

            <section>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Missions logistiques
              </h2>
              <ul className="space-y-2">
                {(data.tachesLogistique ?? []).map(
                  (t: { titre: string; type: string; statut: string }, i: number) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-semibold text-[#144EB9]">
                          {labelOf(RDV_TYPE_LABELS, t.type)}
                        </span>
                        <span className="text-slate-600"> · {t.titre}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {labelOf(TACHE_STATUT_LABELS, t.statut)}
                      </span>
                    </li>
                  ),
                )}
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
                  {data.rendezVous.map(
                    (
                      r: { type: string; dateHeure: string; lieu?: string; statut: string },
                      i: number,
                    ) => (
                      <li key={i} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                        <div className="font-semibold">
                          {labelOf(RDV_TYPE_LABELS, r.type)} ·{' '}
                          {new Date(r.dateHeure).toLocaleString('fr-FR')}
                        </div>
                        <div className="text-slate-500">
                          {r.lieu ?? 'Lieu à confirmer'} · {r.statut}
                        </div>
                      </li>
                    ),
                  )}
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
      <div
        className={`mt-1 text-sm font-bold ${accent ? 'text-[#144EB9]' : 'text-slate-900'}`}
      >
        {value || '—'}
      </div>
    </div>
  );
}

async function fetchPhoto(token: string): Promise<{ res: Blob | null }> {
  const base = api.defaults.baseURL || '/api';
  const r = await fetch(`${base}/client/suivi/${token}/photo`);
  if (!r.ok) return { res: null };
  return { res: await r.blob() };
}
