import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Eye, FileText, Trash2, Upload, X } from 'lucide-react';
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

function guessMime(doc: Doc) {
  if (doc.mimeType) return doc.mimeType;
  const n = doc.nomFichier.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
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
  const [preview, setPreview] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      const { data: blob } = await api.get(`/ged/file/${doc.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nomFichier;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Téléchargement impossible');
    }
  };

  const openPreview = async (doc: Doc) => {
    setPreview(doc);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const { data: blob } = await api.get(`/ged/file/${doc.id}`, { responseType: 'blob' });
      const typed = blob.type && blob.type !== 'application/octet-stream'
        ? blob
        : new Blob([blob], { type: guessMime(doc) });
      setPreviewUrl(URL.createObjectURL(typed));
    } catch {
      toast.error('Aperçu impossible');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreview(null);
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

  const previewMime = preview ? guessMime(preview) : '';
  const isPdf = previewMime.includes('pdf');
  const isImage = previewMime.startsWith('image/');

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
              <tr
                key={doc.id}
                className="border-t border-[var(--border)] hover:bg-brand/[0.03] cursor-pointer"
                onClick={() => void openPreview(doc)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-brand">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[220px] underline-offset-2 hover:underline">
                      {doc.nomFichier}
                    </span>
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
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void openPreview(doc)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
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

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-extrabold">{preview.nomFichier}</h3>
                <p className="text-xs text-muted">
                  {CATEGORIES.find((c) => c.value === preview.categorie)?.label ?? preview.categorie}
                  {' · '}
                  {formatSize(preview.tailleOctets)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => void download(preview)}>
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </Button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-lg p-2 hover:bg-canvas"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-canvas p-3">
              {previewLoading && (
                <p className="text-sm text-muted">Chargement de l’aperçu…</p>
              )}
              {!previewLoading && previewUrl && isPdf && (
                <iframe
                  title={preview.nomFichier}
                  src={previewUrl}
                  className="h-[70vh] w-full rounded-xl bg-white"
                />
              )}
              {!previewLoading && previewUrl && isImage && (
                <img
                  src={previewUrl}
                  alt={preview.nomFichier}
                  className="max-h-[70vh] max-w-full rounded-xl object-contain"
                />
              )}
              {!previewLoading && previewUrl && !isPdf && !isImage && (
                <div className="space-y-3 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted" />
                  <p className="text-sm text-muted">
                    Aperçu non disponible pour ce type de fichier.
                    <br />
                    Utilisez Télécharger pour l’ouvrir.
                  </p>
                  <Button onClick={() => void download(preview)}>
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
