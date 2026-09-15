import { useEffect, useState } from 'react';
import axios from 'axios';
import { Apple, Download, Monitor, RefreshCw, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const POLL_MS = 5 * 60 * 1000;

type Latest = {
  version: string;
  changelog?: string;
  driveUrl?: string;
  downloadUrl?: string;
  downloadUrlMac?: string;
  downloadUrlWin?: string;
  releasesUrl?: string;
};

function isNewer(remote: string, local: string) {
  const a = remote.replace(/^v/, '').split('.').map(Number);
  const b = local.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function openDownload(url: string) {
  try {
    await open(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function VersionChecker() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await axios.get<Latest>(`${API}/version/latest`, {
          timeout: 15_000,
        });
        if (!cancelled) setLatest(data);
      } catch {
        /* silencieux hors ligne */
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const mac = latest?.downloadUrlMac;
  const win = latest?.downloadUrlWin;
  const fallback = latest?.downloadUrl || latest?.driveUrl || latest?.releasesUrl;
  const show =
    latest &&
    dismissed !== latest.version &&
    isNewer(latest.version, APP_VERSION);

  if (!show || !latest) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white shadow-soft">
        <RefreshCw className="h-4 w-4 shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 text-sm">
          <strong>Mise à jour {latest.version}</strong>
          <span className="opacity-90"> (vous avez {APP_VERSION}). </span>
          {latest.changelog ? <span className="opacity-90">{latest.changelog} </span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {mac && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
              onClick={() => void openDownload(mac)}
            >
              <Apple className="h-3.5 w-3.5" /> macOS (.dmg)
            </button>
          )}
          {win && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
              onClick={() => void openDownload(win)}
            >
              <Monitor className="h-3.5 w-3.5" /> Windows (.exe)
            </button>
          )}
          {!mac && !win && fallback && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
              onClick={() => void openDownload(fallback)}
            >
              <Download className="h-3.5 w-3.5" /> Télécharger
            </button>
          )}
        </div>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/15 shrink-0"
          onClick={() => setDismissed(latest.version)}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
