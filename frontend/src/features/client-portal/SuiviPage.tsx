import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { STATUT_LABELS } from '@/lib/utils';

export function SuiviPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['suivi', token],
    queryFn: async () => (await api.get(`/client/suivi/${token}`)).data,
    enabled: !!token,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto max-w-lg p-8">
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const msg =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      'Ce suivi patient n’existe pas ou a expiré.';
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-brand">eXpert SARLU</p>
          <h1 className="mt-2 text-2xl font-extrabold">Lien invalide</h1>
          <p className="mt-2 text-muted">{msg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <p className="text-sm font-semibold text-brand">eXpert SARLU — Suivi patient</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{data.numero}</h1>
          <p className="mt-1 text-muted">
            {data.patient ? `${data.patient.prenom} ${data.patient.nom}` : 'Patient'}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <Row label="Statut" value={STATUT_LABELS[data.statut] ?? data.statut} />
          <Row label="Destination" value={data.destination} />
          <Row label="Pathologie" value={data.pathologie} />
          {data.postRetourStatut && (
            <Row label="Post-retour" value={data.postRetourStatut} />
          )}
        </div>

        <section>
          <h2 className="mb-2 font-bold">Logistique</h2>
          <ul className="space-y-2">
            {(data.tachesLogistique ?? []).map(
              (t: { titre: string; type: string; statut: string }, i: number) => (
                <li
                  key={i}
                  className="flex justify-between rounded-xl border border-[var(--border)] bg-surface px-3 py-2 text-sm"
                >
                  <span>
                    {t.titre} · {t.type}
                  </span>
                  <span className="text-muted">{t.statut}</span>
                </li>
              ),
            )}
            {(data.tachesLogistique ?? []).length === 0 && (
              <li className="text-sm text-muted">Aucune tâche pour le moment</li>
            )}
          </ul>
        </section>

        {(data.rendezVous ?? []).length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Rendez-vous</h2>
            <ul className="space-y-2">
              {data.rendezVous.map(
                (
                  r: { type: string; dateHeure: string; lieu?: string; statut: string },
                  i: number,
                ) => (
                  <li
                    key={i}
                    className="rounded-xl border border-[var(--border)] bg-surface px-3 py-2 text-sm"
                  >
                    <div className="font-semibold">
                      {r.type} · {new Date(r.dateHeure).toLocaleString('fr-FR')}
                    </div>
                    <div className="text-muted">
                      {r.lieu ?? 'Lieu à confirmer'} · {r.statut}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  );
}
