import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type NotifPayload = {
  dossierId?: string;
  demandeId?: string;
  numero?: string;
  motif?: string;
  demandePar?: string;
};

type Notif = {
  id: string;
  type: string;
  titre: string;
  lu: boolean;
  creeLe: string;
  payload?: NotifPayload | null;
};

function apiOrigin() {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
  return base.replace(/\/api\/?$/, '');
}

function typeLabel(type: string) {
  switch (type) {
    case 'UNLOCK_REQUEST':
      return 'Déverrouillage';
    case 'UNLOCK_APPROVED':
      return 'Approuvé';
    case 'UNLOCK_REFUSED':
      return 'Refusé';
    case 'CLIENT_INSCRIPTION':
    case 'PORTAIL_INSCRIPTION':
      return 'Portail client';
    case 'RAPPEL_DEVIS':
      return 'Devis';
    case 'PURGE_CORBEILLE':
      return 'Corbeille';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isAdmin = user?.role === 'SUPER_ADMIN';

  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Notif[]>('/notifications')).data,
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const unread = data.filter((n) => !n.lu).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/${id}/lu`)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: async () => (await api.patch('/notifications/lire-toutes')).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const approve = useMutation({
    mutationFn: async (demandeId: string) =>
      (await api.patch(`/dossiers/demandes-deverrouillage/${demandeId}/approuver`)).data,
    onSuccess: (_data, demandeId) => {
      const n = data.find((x) => x.payload?.demandeId === demandeId);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      if (n?.payload?.dossierId) {
        void qc.invalidateQueries({ queryKey: ['dossier', n.payload.dossierId] });
      }
      toast.success('Dossier déverrouillé');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Approbation impossible'),
  });

  const refuse = useMutation({
    mutationFn: async (demandeId: string) =>
      (await api.patch(`/dossiers/demandes-deverrouillage/${demandeId}/refuser`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Demande refusée');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Refus impossible'),
  });

  useEffect(() => {
    if (!user?.id || !accessToken) return;
    const socket = io(`${apiOrigin()}/notifications`, {
      auth: { userId: user.id },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('notification', (notif: Notif) => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      toast(notif.titre);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, accessToken, qc]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openDossier = (n: Notif) => {
    if (!n.lu) markRead.mutate(n.id);
    const dossierId = n.payload?.dossierId;
    setOpen(false);
    if (dossierId) navigate(`/dossiers/${dossierId}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-muted transition-ui hover:bg-brand/10 hover:text-brand"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <div>
              <div className="text-sm font-bold">Notifications</div>
              {unread > 0 && (
                <div className="text-xs text-muted">{unread} non lue{unread > 1 ? 's' : ''}</div>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                onClick={() => markAll.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout lire
              </button>
            )}
          </div>

          <ul className="max-h-[24rem] overflow-auto">
            {data.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted">
                Aucune notification
              </li>
            )}
            {data.map((n) => {
              const payload = n.payload ?? {};
              const isUnlock = n.type === 'UNLOCK_REQUEST' && !!payload.demandeId;
              return (
                <li
                  key={n.id}
                  className={cn(
                    'border-b border-[var(--border)] px-4 py-3',
                    !n.lu && 'bg-brand/[0.06]',
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => openDossier(n)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-brand">
                          {typeLabel(n.type)}
                          {payload.numero ? ` · ${payload.numero}` : ''}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold leading-snug">{n.titre}</div>
                        {payload.motif && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{payload.motif}</p>
                        )}
                        {payload.demandePar && (
                          <p className="mt-0.5 text-xs text-muted">Par {payload.demandePar}</p>
                        )}
                      </div>
                      {!n.lu && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      )}
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted">
                      {formatDistanceToNow(new Date(n.creeLe), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </div>
                  </button>

                  {isUnlock && isAdmin && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={approve.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          approve.mutate(payload.demandeId!);
                          markRead.mutate(n.id);
                        }}
                      >
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        disabled={refuse.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          refuse.mutate(payload.demandeId!);
                          markRead.mutate(n.id);
                        }}
                      >
                        Refuser
                      </Button>
                    </div>
                  )}

                  {payload.dossierId && !isUnlock && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => openDossier(n)}
                    >
                      Ouvrir le dossier
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
