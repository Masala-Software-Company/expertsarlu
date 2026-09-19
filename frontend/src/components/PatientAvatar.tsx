import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { isLikelyPortraitUrl } from '@/lib/patient-photo';
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
        objectUrl = URL.createObjectURL(data);
        const ok = await isLikelyPortraitUrl(objectUrl);
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
