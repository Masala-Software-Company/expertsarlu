import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Can } from '@/hooks/usePermission';

const CATEGORIES = [
  { value: 'IDENTITE', label: 'Identité' },
  { value: 'MEDICAL', label: 'Médical' },
  { value: 'LOGISTIQUE', label: 'Logistique' },
  { value: 'FACTURATION', label: 'Facturation' },
  { value: 'AUTRE', label: 'Autre' },
] as const;

type Doc = {
  id: string;
  categorie: string;
  nomFichier: string;
  mimeType?: string;
  tailleOctets?: number;
  creeLe: string;
  uploadePar?: { nom: string };
};

function formatSize(n?: number) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function GedDocumentsPanel({
  dossierId,
  locked,
}: {
  dossierId: string;
  locked?: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [categorie, setCategorie] = useState<(typeof CATEGORIES)[number]['value']>('IDENTITE');
  const [filter, setFilter] = useState<string>('ALL');

  const { data = [], isLoading } = useQuery({
    queryKey: ['ged', dossierId],
    queryFn: async () => (await api.get<Doc[]>(`/ged/${dossierId}`)).data,
    enabled: !!dossierId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return (
        await api.post(`/ged/${dossierId}?categorie=${categorie}`, fd)
      ).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ged', dossierId] });
      toast.success('Document ajouté au dossier');
    },
    onError: () => toast.error('Échec de l’upload'),
  });

  const remove = useMutation({
    mutationFn: async (docId: string) => (await api.delete(`/ged/file/${docId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ged', dossierId] });
      toast.success('Document supprimé');
    },
    onError: () => toast.error('Suppression impossible'),
  });

  const download = async (doc: Doc) => {
    try {
      const { data } = await api.get(`/ged/file/${doc.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nomFichier;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Téléchargement impossible');
    }
  };

  const filtered = useMemo(
    () => (filter === 'ALL' ? data : data.filter((d) => d.categorie === filter)),
    [data, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of CATEGORIES) map[c.value] = 0;
    for (const d of data) map[d.categorie] = (map[d.categorie] ?? 0) + 1;
    return map;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft">
        <div className="space-y-1">
          <h3 className="text-sm font-bold">Documents du dossier</h3>
          <p className="text-xs text-muted">
            Pièces d’identité, dossiers médicaux, logistique et facturation — stockés sur le serveur
            eXpert.
          </p>
        </div>
        <Can module="ged" action="create">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm"
              value={categorie}
              disabled={locked || upload.isPending}
              onChange={(e) => setCategorie(e.target.value as typeof categorie)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              disabled={locked || upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {upload.isPending ? 'Envoi…' : 'Ajouter un fichier'}
            </Button>
          </div>
        </Can>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition-ui',
            filter === 'ALL' ? 'bg-brand text-white' : 'bg-canvas text-muted hover:text-ink',
          )}
        >
          Tous ({data.length})
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-ui',
              filter === c.value ? 'bg-brand text-white' : 'bg-canvas text-muted hover:text-ink',
            )}
          >
            {c.label} ({counts[c.value] ?? 0})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Fichier</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Ajouté le</th>
              <th className="px-4 py-3">Par</th>
              <th className="px-4 py-3">Taille</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc) => (
              <tr key={doc.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 text-brand shrink-0" />
                    <span className="truncate max-w-[220px]">{doc.nomFichier}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {CATEGORIES.find((c) => c.value === doc.categorie)?.label ?? doc.categorie}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {format(new Date(doc.creeLe), 'dd MMM yyyy HH:mm', { locale: fr })}
                </td>
                <td className="px-4 py-3 text-muted">{doc.uploadePar?.nom ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{formatSize(doc.tailleOctets)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void download(doc)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Can module="ged" action="delete">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={locked || remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Supprimer « ${doc.nomFichier} » ?`)) {
                            remove.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Aucun document pour le moment. Ajoutez une pièce pour démarrer le dossier GED.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
