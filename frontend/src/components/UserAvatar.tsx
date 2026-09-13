import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn, firstName } from '@/lib/utils';

type Props = {
  userId?: string;
  photoProfil?: string | null;
  nom?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-11 w-11 text-xs',
  lg: 'h-16 w-16 text-base',
};

export function UserAvatar({ userId, photoProfil, nom = '', size = 'md', className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const initials = (firstName(nom).charAt(0) || nom.charAt(0) || '?').toUpperCase();

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    if (!userId || !photoProfil) {
      return;
    }
    const bust = `${encodeURIComponent(photoProfil)}-${Date.now()}`;
    void (async () => {
      try {
        const { data } = await api.get(`/users/${userId}/photo`, {
          responseType: 'blob',
          params: { v: bust },
          headers: {
            'Cache-Control': 'no-cache, no-store',
            Pragma: 'no-cache',
          },
        });
        if (cancelled) return;
        if (data.type && !data.type.startsWith('image/')) {
          setSrc(null);
          return;
        }
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, photoProfil]);

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/15 font-bold text-brand',
        SIZES[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span>{initials}</span>}
    </div>
  );
}
