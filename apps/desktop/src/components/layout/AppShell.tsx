import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Truck,
  BadgeDollarSign,
  Trash2,
  ScrollText,
  LogOut,
  Search,
  Moon,
  PanelLeft,
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
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleDark = useUiStore((s) => s.toggleDark);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const items = NAV.filter(
    (n) => n.roles === 'all' || (user && (n.roles as string[]).includes(user.role)),
  );

  return (
    <div className="flex h-full min-h-screen bg-canvas">
      <aside
        className={cn(
          'flex flex-col border-r border-black/5 bg-white transition-ui',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-black/5 px-4">
          <img src={logoLight} alt="eXpert SARLU" className={cn('h-8 object-contain', collapsed && 'h-7')} />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-ui',
                  isActive
                    ? 'bg-brand text-white shadow-soft'
                    : 'text-ink/70 hover:bg-brand/5 hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-black/5 p-3">
          {!collapsed && user && (
            <div className="mb-3 rounded-xl bg-canvas px-3 py-2">
              <div className="text-sm font-semibold">{user.nom}</div>
              <div className="text-xs text-black/50">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Déconnexion'}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-black/5 bg-white/80 px-5 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Sidebar">
              <PanelLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-10 w-72 items-center gap-2 rounded-xl border border-black/10 bg-canvas px-3 text-sm text-black/45 transition-ui hover:border-brand/30"
            >
              <Search className="h-4 w-4" />
              Rechercher…
              <kbd className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black/40 border border-black/5">
                ⌘K
              </kbd>
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Thème">
            <Moon className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
