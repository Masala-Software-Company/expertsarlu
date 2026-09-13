import { useEffect, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

type Latest = { version: string; changelog?: string; driveUrl?: string };

function isNewer(remote: string, local: string) {
  const a = remote.split('.').map(Number);
  const b = local.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export function VersionChecker() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void axios
      .get<Latest>(`${API}/version/latest`)
      .then((r) => setLatest(r.data))
      .catch(() => undefined);
  }, []);

  if (!latest || dismissed || !isNewer(latest.version, APP_VERSION)) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white shadow-soft">
        <div className="text-sm">
          <strong>Nouvelle version {latest.version}</strong> disponible.
          {latest.changelog ? ` ${latest.changelog}` : ''}{' '}
          {latest.driveUrl && (
            <a
              href={latest.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="underline font-semibold"
            >
              Télécharger sur Google Drive
            </a>
          )}
        </div>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/15"
          onClick={() => setDismissed(true)}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
