import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

/** Toujours interroger la prod — même si le build pointe vers une autre API. */
const PRODUCTION_VERSION_URL =
  'https://expertsarlu-production.up.railway.app/api/version/latest';
const LOCAL_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || '1.0.0';
const LOCAL_API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const POLL_MS = 2 * 60 * 1000;

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
  const a = remote.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const b = local.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function detectPlatform(): 'mac' | 'win' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'win';
  return 'other';
}

async function openDownload(url: string) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

async function fetchLatest(): Promise<Latest | null> {
  const urls = [
    PRODUCTION_VERSION_URL,
    LOCAL_API ? `${LOCAL_API}/version/latest` : null,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      window.clearTimeout(t);
      if (!res.ok) continue;
      const data = (await res.json()) as Latest;
      if (data?.version) return data;
    } catch {
      /* essai suivant */
    }
  }
  return null;
}

export function VersionChecker() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('expert-update-dismissed');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const data = await fetchLatest();
      if (!cancelled && data) setLatest(data);
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    // 2e check rapide au cas où le réseau démarre après le splash
    const retry = window.setTimeout(() => void check(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(retry);
    };
  }, []);

  const platform = detectPlatform();
  const updateUrl =
    (platform === 'mac' && latest?.downloadUrlMac) ||
    (platform === 'win' && latest?.downloadUrlWin) ||
    latest?.downloadUrlMac ||
    latest?.downloadUrlWin ||
    latest?.downloadUrl ||
    latest?.driveUrl ||
    latest?.releasesUrl ||
    null;

  const show =
    latest &&
    dismissed !== latest.version &&
    isNewer(latest.version, LOCAL_VERSION);

  if (!show || !latest) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white shadow-soft">
        <RefreshCw className="h-4 w-4 shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 text-sm">
          <strong>Nouvelle version {latest.version}</strong>
          <span className="opacity-90"> — vous avez {LOCAL_VERSION}. </span>
          {latest.changelog ? (
            <span className="opacity-90">{latest.changelog} </span>
          ) : null}
        </div>
        {updateUrl ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-white/90"
            onClick={() => void openDownload(updateUrl)}
          >
            <Download className="h-4 w-4" />
            Mettre à jour
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/15 shrink-0"
          onClick={() => {
            setDismissed(latest.version);
            try {
              sessionStorage.setItem('expert-update-dismissed', latest.version);
            } catch {
              /* ignore */
            }
          }}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
