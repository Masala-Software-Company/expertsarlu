import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUiStore } from '@/lib/ui-store';

type Dossier = { id: string; numero: string; patient?: { nom: string; prenom: string } };

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers', 'cmdk', q],
    queryFn: async () => {
      const { data } = await api.get<Dossier[]>('/dossiers', { params: { q: q || undefined } });
      return data;
    },
    enabled: open,
  });

  const actions = useMemo(
    () => [
      { id: 'dash', label: 'Tableau de bord', to: '/' },
      { id: 'dos', label: 'Tous les dossiers', to: '/dossiers' },
      { id: 'pros', label: 'Prospects', to: '/prospects' },
      { id: 'log', label: 'Logistique / Planning', to: '/logistique' },
    ],
    [],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Recherche globale" shouldFilter={false}>
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Rechercher un dossier, patient, action…"
            className="h-14 w-full border-b border-black/5 px-4 text-base outline-none"
          />
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-sm text-black/50">
              Aucun résultat
            </Command.Empty>
            <Command.Group heading="Actions" className="px-2 py-1 text-xs font-semibold text-black/40">
              {actions.map((a) => (
                <Command.Item
                  key={a.id}
                  value={a.label}
                  onSelect={() => {
                    navigate(a.to);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-brand/10"
                >
                  {a.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Dossiers" className="px-2 py-1 text-xs font-semibold text-black/40">
              {dossiers.slice(0, 8).map((d) => (
                <Command.Item
                  key={d.id}
                  value={`${d.numero} ${d.patient?.nom ?? ''}`}
                  onSelect={() => {
                    navigate(`/dossiers/${d.id}`);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-brand/10"
                >
                  <span className="font-semibold text-brand">{d.numero}</span>
                  {d.patient && (
                    <span className="ml-2 text-black/60">
                      {d.patient.prenom} {d.patient.nom}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
