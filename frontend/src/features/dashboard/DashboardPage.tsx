import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

type Pipeline = {
  facture: number;
  encaisse: number;
  enAttente: number;
  parAgent: { nom: string; facture: number; encaisse: number }[];
  parDestination: { destination: string; facture: number; encaisse: number }[];
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers'],
    queryFn: async () => (await api.get<Dossier[]>('/dossiers')).data,
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => (await api.get<Pipeline>('/facturation/pipeline')).data,
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: planning = [] } = useQuery({
    queryKey: ['planning-dash'],
    queryFn: async () => (await api.get('/logistique/planning')).data,
    enabled: user?.role === 'PROTOCOLE',
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ['prospects-dash'],
    queryFn: async () => (await api.get('/prospects')).data,
    enabled: user?.role === 'SUPPORT_CLIENT',
  });

  const enCours = dossiers.filter((d) => d.statut === 'EN_COURS').length;
  const valides = dossiers.filter((d) => d.statut === 'VALIDE' || d.statut === 'VERROUILLE').length;
  const urgents = dossiers.filter((d) => d.priorite !== 'NORMALE').length;
  const aValider = dossiers.filter((d) => d.statut === 'EN_COURS').length;
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
          {user ? ROLE_LABELS[user.role] : ''} — tableau de bord personnalisé
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Dossiers actifs', value: dossiers.length },
          { label: 'En cours', value: enCours },
          {
            label:
              user?.role === 'ASSISTANT_MANAGER' ? 'À valider' : 'Validés / verrouillés',
            value: user?.role === 'ASSISTANT_MANAGER' ? aValider : valides,
          },
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
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Facturé', value: pipeline?.facture ?? totalCotation },
              { label: 'Encaissé', value: pipeline?.encaisse ?? 0 },
              { label: 'En attente', value: pipeline?.enAttente ?? 0 },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-brand/25 bg-brand p-5 text-white shadow-soft"
              >
                <div className="text-sm text-white/70">{c.label}</div>
                <div className="mt-2 text-2xl font-extrabold">{formatMoney(c.value)}</div>
              </div>
            ))}
          </div>

          {(pipeline?.parDestination?.length ?? 0) > 0 && (
            <div className="h-72 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
              <h2 className="mb-3 font-bold">Pipeline par destination</h2>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={pipeline!.parDestination}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="destination" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Bar dataKey="facture" fill="#144EB9" name="Facturé" radius={4} />
                  <Bar dataKey="encaisse" fill="#0A0A0A" name="Encaissé" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {user?.role === 'CAISSE_ADMIN' && (
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Caisse</h2>
          <p className="mt-1 text-sm text-muted">
            Cotations en pipeline : {formatMoney(totalCotation)} — ouvrez un dossier pour encaisser
            un devis.
          </p>
        </div>
      )}

      {user?.role === 'SUPPORT_CLIENT' && (
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Prospects / leads</h2>
          <p className="mt-1 text-sm text-muted">{prospects.length} prospect(s) dans le pipeline</p>
          <Link to="/prospects" className="mt-2 inline-block text-sm font-semibold text-brand">
            Voir les prospects →
          </Link>
        </div>
      )}

      {user?.role === 'PROTOCOLE' && (
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Planning du jour</h2>
          <p className="mt-1 text-sm text-muted">{planning.length} rendez-vous</p>
          <Link to="/logistique" className="mt-2 inline-block text-sm font-semibold text-brand">
            Ouvrir le protocole →
          </Link>
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
