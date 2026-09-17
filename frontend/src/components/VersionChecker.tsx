import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

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
  silentUpdate?: boolean;
};

type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'done' | 'error';

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

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

/** Mise à jour silencieuse via plugin Tauri (in-place). */
async function runSilentUpdate(
  onPhase: (p: UpdatePhase, detail?: string) => void,
): Promise<boolean> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');
    onPhase('checking');
    const update = await check();
    if (!update) {
      onPhase('idle');
      return false;
    }
    onPhase('downloading', update.version);
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') onPhase('downloading', update.version);
      if (event.event === 'Finished') onPhase('installing', update.version);
    });
    onPhase('done', update.version);
    await relaunch();
    return true;
  } catch (e) {
    onPhase('error', e instanceof Error ? e.message : 'Échec mise à jour');
    return false;
  }
}

export function VersionChecker() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [phaseDetail, setPhaseDetail] = useState<string | undefined>();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('expert-update-dismissed');
    } catch {
      return null;
    }
  });
  const [silentTried, setSilentTried] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const data = await fetchLatest();
      if (cancelled || !data) return;
      setLatest(data);

      // Auto silent update in desktop builds when remote is newer
      if (
        isTauri() &&
        !silentTried &&
        isNewer(data.version, LOCAL_VERSION)
      ) {
        setSilentTried(true);
        const ok = await runSilentUpdate((p, d) => {
          if (!cancelled) {
            setPhase(p);
            setPhaseDetail(d);
          }
        });
        if (!ok && !cancelled) {
          // fallback : bannière manuelle
          setPhase('available');
        }
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const retry = window.setTimeout(() => void check(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(retry);
    };
  }, [silentTried]);

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

  const hasUpdate = !!(latest && isNewer(latest.version, LOCAL_VERSION));
  const busy =
    phase === 'checking' ||
    phase === 'downloading' ||
    phase === 'installing' ||
    phase === 'done';
  const showProgress = isTauri() && hasUpdate && busy;
  const showManual =
    hasUpdate &&
    latest != null &&
    dismissed !== latest.version &&
    !busy;

  if (showProgress && latest) {
    const label =
      phase === 'checking'
        ? 'Recherche de mise à jour…'
        : phase === 'downloading'
          ? `Téléchargement de la v${phaseDetail ?? latest.version}…`
          : phase === 'installing'
            ? 'Installation en cours…'
            : 'Redémarrage…';
    return (
      <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
        <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white shadow-soft">
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin opacity-90" />
          <div className="text-sm font-medium">{label}</div>
        </div>
      </div>
    );
  }

  if (!showManual || !latest) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white shadow-soft">
        <RefreshCw className="h-4 w-4 shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 text-sm">
          <strong>Nouvelle version {latest.version}</strong>
          <span className="opacity-90"> — vous avez {LOCAL_VERSION}. </span>
          {phase === 'error' ? (
            <span className="opacity-90">
              Mise à jour auto impossible — téléchargez l’installateur.{' '}
            </span>
          ) : latest.changelog ? (
            <span className="opacity-90">{latest.changelog} </span>
          ) : null}
        </div>
        {isTauri() ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-white/90"
            onClick={() => {
              void runSilentUpdate((p, d) => {
                setPhase(p);
                setPhaseDetail(d);
              });
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Mettre à jour maintenant
          </button>
        ) : null}
        {updateUrl ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25"
            onClick={() => void openDownload(updateUrl)}
          >
            <Download className="h-4 w-4" />
            Installateur
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
