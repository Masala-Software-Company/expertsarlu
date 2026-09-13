import { useAuthStore } from '@/features/auth/auth-store';

export function usePermission(module: string, action: string) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return (
    user.permissions?.some((p) => p.module === module && p.action === action) ??
    false
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
