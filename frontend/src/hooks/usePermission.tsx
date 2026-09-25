import { useAuthStore } from '@/features/auth/auth-store';

/** Permissions UI de secours si la session n’a pas encore /auth/me (évite un écran vide). */
const ROLE_FALLBACK: Record<string, { module: string; action: string }[]> = {
  ASSISTANT_MANAGER: [
    { module: 'dossiers', action: 'create' },
    { module: 'dossiers', action: 'read' },
    { module: 'dossiers', action: 'update' },
    { module: 'dossiers', action: 'delete' },
    { module: 'dossiers', action: 'validate' },
    { module: 'cotation', action: 'read' },
    { module: 'cotation', action: 'create' },
    { module: 'cotation', action: 'update' },
    { module: 'facturation', action: 'read' },
    { module: 'facturation', action: 'create' },
    { module: 'facturation', action: 'update' },
    { module: 'logistique', action: 'read' },
    { module: 'logistique', action: 'create' },
    { module: 'logistique', action: 'update' },
    { module: 'ged', action: 'read' },
    { module: 'ged', action: 'create' },
    { module: 'ged', action: 'update' },
    { module: 'ged', action: 'delete' },
    { module: 'partenaires', action: 'read' },
    { module: 'partenaires', action: 'create' },
    { module: 'partenaires', action: 'update' },
    { module: 'audit', action: 'read' },
    { module: 'notifications', action: 'read' },
    { module: 'notifications', action: 'update' },
    { module: 'pre_inscriptions', action: 'read' },
    { module: 'pre_inscriptions', action: 'update' },
  ],
  SUPPORT_CLIENT: [
    { module: 'dossiers', action: 'create' },
    { module: 'dossiers', action: 'read' },
    { module: 'dossiers', action: 'update' },
    { module: 'ged', action: 'read' },
    { module: 'ged', action: 'create' },
    { module: 'prospects', action: 'read' },
    { module: 'prospects', action: 'create' },
    { module: 'prospects', action: 'update' },
    { module: 'partenaires', action: 'read' },
    { module: 'pre_inscriptions', action: 'read' },
    { module: 'pre_inscriptions', action: 'update' },
    { module: 'notifications', action: 'read' },
  ],
  CAISSE_ADMIN: [
    { module: 'dossiers', action: 'read' },
    { module: 'dossiers', action: 'update' },
    { module: 'cotation', action: 'read' },
    { module: 'cotation', action: 'create' },
    { module: 'cotation', action: 'update' },
    { module: 'facturation', action: 'read' },
    { module: 'facturation', action: 'create' },
    { module: 'facturation', action: 'update' },
    { module: 'ged', action: 'read' },
    { module: 'notifications', action: 'read' },
  ],
  PROTOCOLE: [
    { module: 'dossiers', action: 'read' },
    { module: 'dossiers', action: 'update' },
    { module: 'logistique', action: 'read' },
    { module: 'logistique', action: 'create' },
    { module: 'logistique', action: 'update' },
    { module: 'ged', action: 'read' },
    { module: 'ged', action: 'create' },
    { module: 'notifications', action: 'read' },
  ],
};

export function usePermission(module: string, action: string) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const fromSession = user.permissions?.some((p) => p.module === module && p.action === action);
  if (fromSession) return true;
  if (user.permissions && user.permissions.length > 0) return false;
  return (
    ROLE_FALLBACK[user.role]?.some((p) => p.module === module && p.action === action) ?? false
  );
}

export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const ok = usePermission(module, action);
  return <>{ok ? children : fallback}</>;
}
