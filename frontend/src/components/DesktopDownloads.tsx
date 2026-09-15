import { useEffect, useState } from 'react';
import { Apple, Copy, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type Latest = {
  version?: string;
  downloadUrlMac?: string | null;
  downloadUrlWin?: string | null;
  releasesUrl?: string | null;
  downloadUrl?: string | null;
};

export function DesktopDownloads({ compact = false }: { compact?: boolean }) {
  const [latest, setLatest] = useState<Latest | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<Latest>('/version/latest');
        setLatest(data);
      } catch {
        setLatest(null);
      }
    })();
  }, []);

  const mac = latest?.downloadUrlMac;
  const win = latest?.downloadUrlWin;
  const page = latest?.releasesUrl || latest?.downloadUrl;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copié`);
    } catch {
      toast.error('Copie impossible');
    }
  };

  if (!mac && !win && !page) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        Installateurs en cours de publication. Relancez le workflow{' '}
        <span className="font-mono text-white/80">Desktop release</span> sur GitHub.
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft'
      }
    >
      {!compact && (
        <div className="mb-3">
          <div className="text-sm font-bold text-white">Installer eXpert sur un poste</div>
          <p className="mt-1 text-xs text-white/55">
            Partagez le lien Mac (.dmg) ou Windows (.exe) avec l’équipe
            {latest?.version ? ` — v${latest.version}` : ''}.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {mac && (
          <>
            <a
              href={mac}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0B1F44] hover:bg-white/90"
            >
              <Apple className="h-3.5 w-3.5" /> Télécharger macOS
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
              onClick={() => void copy(mac, 'Lien macOS')}
            >
              <Copy className="h-3.5 w-3.5" /> Copier
            </button>
          </>
        )}
        {win && (
          <>
            <a
              href={win}
              className="inline-flex items-center gap-2 rounded-xl bg-[#144EB9] px-3 py-2 text-xs font-bold text-white hover:brightness-110"
            >
              <Monitor className="h-3.5 w-3.5" /> Télécharger Windows
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
              onClick={() => void copy(win, 'Lien Windows')}
            >
              <Copy className="h-3.5 w-3.5" /> Copier
            </button>
          </>
        )}
        {!mac && !win && page && (
          <a
            href={page}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0B1F44]"
          >
            Voir les installateurs
          </a>
        )}
      </div>
    </div>
  );
}
