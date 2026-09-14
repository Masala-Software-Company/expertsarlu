import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Truck,
  BadgeDollarSign,
  Trash2,
  ScrollText,
  UserCog,
  Building2,
  UserPlus,
} from 'lucide-react';

/** Rôles applicatifs (alignés Prisma / PDF organisation). */
export type AppRole =
  | 'SUPER_ADMIN'
  | 'ASSISTANT_MANAGER'
  | 'SUPPORT_CLIENT'
  | 'CAISSE_ADMIN'
  | 'PROTOCOLE';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Modules métier couverts (pour le tableau de bord). */
  modules?: string[];
};

/**
 * Matrice d’accès UI — d’après « MISE EN PLACE PDF » (missions, pas les noms)
 * + Super Admin = accès total.
 */
const ROLE_PATHS: Record<AppRole, string[]> = {
  SUPER_ADMIN: [
    '/',
    '/dossiers',
    '/nouveaux-patients',
    '/prospects',
    '/partenaires',
    '/logistique',
    '/tarification',
    '/corbeille',
    '/audit',
    '/equipe',
    '/profil',
  ],
  ASSISTANT_MANAGER: [
    '/',
    '/dossiers',
    '/nouveaux-patients',
    '/partenaires',
    '/logistique',
    '/corbeille',
    '/audit',
    '/profil',
  ],
  SUPPORT_CLIENT: [
    '/',
    '/dossiers',
    '/nouveaux-patients',
    '/prospects',
    '/partenaires',
    '/profil',
  ],
  CAISSE_ADMIN: ['/', '/dossiers', '/profil'],
  PROTOCOLE: ['/', '/dossiers', '/logistique', '/profil'],
};

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, modules: ['accueil'] },
  { to: '/dossiers', label: 'Dossiers', icon: FolderKanban, modules: ['dossiers'] },
  {
    to: '/nouveaux-patients',
    label: 'Nouveaux patients',
    icon: UserPlus,
    modules: ['pre_inscriptions'],
  },
  {
    to: '/prospects',
    label: 'Onboarding',
    icon: Users,
    modules: ['prospects', 'messages'],
  },
  {
    to: '/partenaires',
    label: 'Partenaires',
    icon: Building2,
    modules: ['partenaires'],
  },
  {
    to: '/logistique',
    label: 'Protocole',
    icon: Truck,
    modules: ['logistique'],
  },
  {
    to: '/tarification',
    label: 'Tarification',
    icon: BadgeDollarSign,
    modules: ['tarification'],
  },
  { to: '/corbeille', label: 'Corbeille', icon: Trash2, modules: ['corbeille'] },
  { to: '/audit', label: 'Audit', icon: ScrollText, modules: ['audit'] },
  { to: '/equipe', label: 'Équipe', icon: UserCog, modules: ['users'] },
];

/** Mission courte affichée sur le tableau de bord (PDF, sans noms). */
export const ROLE_MISSIONS: Record<AppRole, string> = {
  SUPER_ADMIN:
    'Vue complète : finances, équipe, tarification, audit et supervision de tous les modules.',
  ASSISTANT_MANAGER:
    'Supervision du flux opérationnel, validation des dossiers et suivi avec les hôpitaux partenaires.',
  SUPPORT_CLIENT:
    'Accueil des familles, constitution du dossier de base, onboarding et suivi relationnel.',
  CAISSE_ADMIN:
    'Devis, factures, encaissements et suivi de caisse — sans engagement sans règlement.',
  PROTOCOLE:
    'Logistique terrain : transferts, visas, documents et rendez-vous — aucun encaissement client.',
};

export function isAppRole(role: string | undefined | null): role is AppRole {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ASSISTANT_MANAGER' ||
    role === 'SUPPORT_CLIENT' ||
    role === 'CAISSE_ADMIN' ||
    role === 'PROTOCOLE'
  );
}

export function pathsForRole(role: string | undefined | null): string[] {
  if (!isAppRole(role)) return ['/', '/profil'];
  return ROLE_PATHS[role];
}

/** Autorise aussi les sous-routes (ex. /dossiers/:id). */
export function canAccessPath(role: string | undefined | null, pathname: string): boolean {
  const paths = pathsForRole(role);
  const clean = pathname.split('?')[0] || '/';
  if (paths.includes(clean)) return true;
  if (clean.startsWith('/dossiers/') && paths.includes('/dossiers')) return true;
  if (clean === '/onboarding' || clean.startsWith('/prospects')) {
    return paths.includes('/prospects');
  }
  if (clean === '/inbox' || clean === '/messages') {
    return paths.includes('/prospects');
  }
  return false;
}

export function navForRole(role: string | undefined | null): NavItem[] {
  const paths = new Set(pathsForRole(role));
  return NAV_ITEMS.filter((item) => paths.has(item.to));
}

/** Raccourcis métier (hors « Tableau de bord ») pour le dashboard du rôle. */
export function dashboardAccessLinks(role: string | undefined | null): NavItem[] {
  return navForRole(role).filter((item) => item.to !== '/');
}
