import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Truck,
  BadgeDollarSign,
  Trash2,
  ScrollText,
  UserCog,
  LogOut,
  Search,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import logoLight from '@/assets/logos/logo-light.jpg';
import { useAuthStore } from '@/features/auth/auth-store';
import { useUiStore } from '@/lib/ui-store';
import { ROLE_LABELS, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: 'all' },
  { to: '/dossiers', label: 'Dossiers', icon: FolderKanban, roles: 'all' },
  {
    to: '/prospects',
    label: 'Prospects',
    icon: Users,
    roles: ['SUPER_ADMIN', 'SUPPORT_CLIENT', 'ASSISTANT_MANAGER'],
  },
  {
    to: '/logistique',
    label: 'Protocole',
    icon: Truck,
    roles: ['SUPER_ADMIN', 'PROTOCOLE', 'ASSISTANT_MANAGER'],
  },
  {
    to: '/tarification',
    label: 'Tarification',
    icon: BadgeDollarSign,
    roles: ['SUPER_ADMIN'],
  },
  {
    to: '/corbeille',
    label: 'Corbeille',
    icon: Trash2,
    roles: ['SUPER_ADMIN', 'ASSISTANT_MANAGER'],
  },
  {
    to: '/audit',
    label: 'Audit',
    icon: ScrollText,
    roles: ['SUPER_ADMIN', 'ASSISTANT_MANAGER'],
  },
  {
    to: '/utilisateurs',
    label: 'Utilisateurs',
    icon: UserCog,
    roles: ['SUPER_ADMIN'],
  },
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const dark = useUiStore((s) => s.dark);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleDark = useUiStore((s) => s.toggleDark);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const items = NAV.filter(
    (n) => n.roles === 'all' || (user && (n.roles as string[]).includes(user.role)),
  );

  return (
    <div className="flex h-full min-h-screen bg-canvas text-ink">
      <aside
        className={cn(
          'relative flex shrink-0 flex-col border-r border-[var(--border)] bg-surface transition-[width] duration-200 ease-out',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-[var(--border)]',
            collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3',
          )}
        >
          <img
            src={logoLight}
            alt="eXpert SARLU"
            className={cn('object-contain', collapsed ? 'h-7 w-7' : 'h-8 max-w-[140px]')}
          />
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              aria-label="Réduire le menu"
              title="Réduire le menu"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto p-2', collapsed && 'px-1.5')}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-xl text-sm font-medium transition-ui',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-brand text-white shadow-soft'
                    : 'text-muted hover:bg-brand/10 hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t border-[var(--border)] p-2', collapsed && 'px-1.5')}>
          {!collapsed && user && (
            <div className="mb-2 rounded-xl bg-canvas px-3 py-2">
              <div className="truncate text-sm font-semibold">{user.nom}</div>
              <div className="truncate text-xs text-muted">
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
            title="Déconnexion"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Déconnexion'}
          </Button>
          {collapsed && (
            <Button
              variant="ghost"
              className="mt-1 w-full justify-center px-0"
              onClick={toggleSidebar}
              aria-label="Étendre le menu"
              title="Étendre le menu"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Poignée de redimensionnement / collapse au bord */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
          title={collapsed ? 'Étendre' : 'Réduire'}
          className="absolute -right-3 top-1/2 z-20 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-muted shadow-soft transition-ui hover:text-brand"
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-surface/80 px-5 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
              title={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-10 w-72 max-w-[50vw] items-center gap-2 rounded-xl border border-[var(--border)] bg-canvas px-3 text-sm text-muted transition-ui hover:border-brand/30"
            >
              <Search className="h-4 w-4" />
              Rechercher…
              <kbd className="ml-auto rounded border border-[var(--border)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                ⌘K
              </kbd>
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDark}
            aria-label={dark ? 'Mode clair' : 'Mode sombre'}
            title={dark ? 'Mode clair' : 'Mode sombre'}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
