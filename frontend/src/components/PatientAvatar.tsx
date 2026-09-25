import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  patientId?: string;
  photoProfil?: string | null;
  prenom?: string;
  nom?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
};

function isPortraitBlob(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(true), 2500);
    img.onload = () => {
      const ratio = img.naturalWidth / Math.max(img.naturalHeight, 1);
      // Logos / bannières très paysage → initiales ; sinon on affiche la photo
      done(ratio <= 1.45);
    };
    img.onerror = () => done(false);
    img.src = url;
  });
}

export function PatientAvatar({
  patientId,
  photoProfil,
  prenom = '',
  nom = '',
  size = 'md',
  className,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?';

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!patientId || !photoProfil) {
      setSrc(null);
      return;
    }

    setSrc(null);
    const bust = encodeURIComponent(photoProfil);
    void (async () => {
      try {
        const { data } = await api.get(`/patients/${patientId}/photo`, {
          responseType: 'blob',
          params: { v: bust },
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (cancelled) return;
        if (!(data instanceof Blob) || data.size === 0) {
          setSrc(null);
          return;
        }
        // Évite d’afficher du JSON/HTML d’erreur comme image
        if (data.type && !data.type.startsWith('image/')) {
          setSrc(null);
          return;
        }
        objectUrl = URL.createObjectURL(data);
        let ok = true;
        try {
          ok = await isPortraitBlob(objectUrl);
        } catch {
          ok = true;
        }
        if (cancelled) return;
        if (ok) setSrc(objectUrl);
        else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          setSrc(null);
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [patientId, photoProfil]);

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/15 font-bold text-brand',
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
