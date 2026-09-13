import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';

type Rdv = {
  id: string;
  type: string;
  dateHeure: string;
  lieu?: string;
  statut: string;
  dossier?: { numero: string; patient?: { nom: string; prenom: string } };
  assigneA?: { nom: string };
};

export function LogistiquePage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['planning'],
    queryFn: async () => (await api.get<Rdv[]>('/logistique/planning')).data,
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Protocole — Planning</h1>
        <p className="text-sm text-black/50">
          Interface terrain : navettes et rendez-vous du jour (grandes zones tactiles)
        </p>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-white shadow-soft" />}
        {!isLoading && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-black/40">
            Aucun rendez-vous aujourd’hui
          </div>
        )}
        {data.map((r) => (
          <button
            key={r.id}
            type="button"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/5 bg-white p-5 text-left shadow-soft transition-ui hover:border-brand/40 active:scale-[0.99]"
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-brand">{r.type}</div>
              <div className="mt-1 text-lg font-extrabold">
                {format(new Date(r.dateHeure), 'HH:mm', { locale: fr })}
                {r.lieu ? ` · ${r.lieu}` : ''}
              </div>
              <div className="mt-1 text-sm text-black/55">
                {r.dossier?.numero}
                {r.dossier?.patient
                  ? ` — ${r.dossier.patient.prenom} ${r.dossier.patient.nom}`
                  : ''}
              </div>
            </div>
            <div className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-black/50">
              {r.statut}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
