import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { ROLE_LABELS, STATUT_LABELS, formatMoney, firstName } from '@/lib/utils';
import { PatientAvatar } from '@/components/PatientAvatar';

type Dossier = {
  id: string;
  numero: string;
  statut: string;
  destination?: string;
  priorite: string;
  patient?: {
    id: string;
    nom: string;
    prenom: string;
    photoProfil?: string | null;
  };
  lignesCotation?: { montant: string | number }[];
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers'],
    queryFn: async () => (await api.get<Dossier[]>('/dossiers')).data,
  });

  const enCours = dossiers.filter((d) => d.statut === 'EN_COURS').length;
  const valides = dossiers.filter((d) => d.statut === 'VALIDE' || d.statut === 'VERROUILLE').length;
  const urgents = dossiers.filter((d) => d.priorite !== 'NORMALE').length;
  const totalCotation = dossiers.reduce(
    (s, d) =>
      s + (d.lignesCotation?.reduce((a, l) => a + Number(l.montant), 0) ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Bonjour{user?.nom ? `, ${firstName(user.nom)}` : ''}
        </h1>
        <p className="mt-1 text-muted">
          {user ? ROLE_LABELS[user.role] : ''} — vue d’ensemble du pipeline médical
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Dossiers actifs', value: dossiers.length },
          { label: 'En cours', value: enCours },
          { label: 'Validés / verrouillés', value: valides },
          { label: 'Priorité haute', value: urgents },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
          >
            <div className="text-sm text-muted">{c.label}</div>
            <div className="mt-2 text-3xl font-extrabold text-brand">
              {isLoading ? '—' : c.value}
            </div>
          </div>
        ))}
      </div>

      {user?.role === 'SUPER_ADMIN' && (
        <div className="rounded-2xl border border-brand/25 bg-brand p-6 text-white shadow-soft">
          <div className="text-sm text-white/70">Pipeline financier (cotations en cours)</div>
          <div className="mt-2 text-3xl font-extrabold">{formatMoney(totalCotation)}</div>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Dossiers récents</h2>
          <Link to="/dossiers" className="text-sm font-semibold text-brand hover:underline">
            Voir tout
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.slice(0, 6).map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)] hover:bg-brand/[0.03]">
                  <td className="px-4 py-3">
                    <Link to={`/dossiers/${d.id}`} className="font-semibold text-brand">
                      {d.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {d.patient ? (
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar
                          patientId={d.patient.id}
                          photoProfil={d.patient.photoProfil}
                          prenom={d.patient.prenom}
                          nom={d.patient.nom}
                          size="sm"
                        />
                        <span>
                          {d.patient.prenom} {d.patient.nom}
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{d.destination ?? '—'}</td>
                  <td className="px-4 py-3">{STATUT_LABELS[d.statut] ?? d.statut}</td>
                </tr>
              ))}
              {!isLoading && dossiers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    Aucun dossier pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
