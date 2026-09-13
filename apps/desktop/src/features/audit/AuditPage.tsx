import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';

type Log = {
  id: string;
  timestamp: string;
  action: string;
  tableCible: string;
  recordId?: string;
  user?: { nom: string; email: string };
};

export function AuditPage() {
  const { data = [] } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => (await api.get<Log[]>('/audit', { params: { limit: 80 } })).data,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Journal d’audit</h1>
        <p className="text-sm text-black/50">Piste immuable — INSERT only</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-black/40">
            <tr>
              <th className="px-4 py-3">Horodatage</th>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Cible</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id} className="border-t border-black/5">
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(new Date(l.timestamp), 'dd MMM yyyy HH:mm:ss', { locale: fr })}
                </td>
                <td className="px-4 py-3">{l.user?.nom ?? '—'}</td>
                <td className="px-4 py-3 font-medium">{l.action}</td>
                <td className="px-4 py-3 text-black/50">
                  {l.tableCible}
                  {l.recordId ? ` #${l.recordId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
