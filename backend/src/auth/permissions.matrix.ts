import { RoleName } from '@prisma/client';

export const MODULE_ACTIONS: Record<string, string[]> = {
  dossiers: ['create', 'read', 'update', 'delete', 'validate', 'unlock'],
  cotation: ['create', 'read', 'update'],
  facturation: ['create', 'read', 'update'],
  logistique: ['create', 'read', 'update'],
  ged: ['create', 'read', 'update', 'delete'],
  prospects: ['create', 'read', 'update'],
  partenaires: ['create', 'read', 'update'],
  audit: ['read'],
  users: ['create', 'read', 'update', 'delete'],
  tarification: ['read', 'update'],
  notifications: ['read', 'update'],
  pre_inscriptions: ['read', 'update'],
};

/**
 * Matrice RBAC (PDF organisation + spec) :
 * - Support : relation client / onboarding / partenaires
 * - Caisse : cotation & facturation (pas tarification)
 * - Protocole : logistique & GED (pas finance)
 * - Assistant : supervision, validation, partenaires, logistique, audit
 * - Super Admin : tout
 */
export const ROLE_MODULES: Record<RoleName, string[]> = {
  SUPER_ADMIN: Object.keys(MODULE_ACTIONS),
  ASSISTANT_MANAGER: [
    'dossiers',
    'cotation',
    'facturation',
    'logistique',
    'partenaires',
    'ged',
    'notifications',
    'audit',
    'pre_inscriptions',
  ],
  SUPPORT_CLIENT: [
    'dossiers',
    'prospects',
    'partenaires',
    'ged',
    'notifications',
    'pre_inscriptions',
  ],
  CAISSE_ADMIN: ['dossiers', 'cotation', 'facturation', 'ged', 'notifications'],
  PROTOCOLE: ['dossiers', 'logistique', 'ged', 'notifications'],
};

export const ROLE_ACTIONS: Partial<Record<RoleName, Record<string, string[]>>> = {
  ASSISTANT_MANAGER: {
    dossiers: ['create', 'read', 'update', 'delete', 'validate'],
    partenaires: ['create', 'read', 'update'],
    audit: ['read'],
  },
  SUPPORT_CLIENT: {
    dossiers: ['create', 'read', 'update'],
    partenaires: ['create', 'read', 'update'],
  },
  CAISSE_ADMIN: {
    dossiers: ['read', 'update'],
    cotation: ['create', 'read', 'update'],
    facturation: ['create', 'read', 'update'],
  },
  PROTOCOLE: {
    dossiers: ['read', 'update'],
  },
};

export function buildPermissionRows(): { role: RoleName; module: string; action: string }[] {
  const rows: { role: RoleName; module: string; action: string }[] = [];

  for (const role of Object.keys(ROLE_MODULES) as RoleName[]) {
    if (role === 'SUPER_ADMIN') {
      for (const [mod, actions] of Object.entries(MODULE_ACTIONS)) {
        for (const action of actions) {
          rows.push({ role, module: mod, action });
        }
      }
      continue;
    }
    for (const mod of ROLE_MODULES[role]) {
      const actions = ROLE_ACTIONS[role]?.[mod] ?? MODULE_ACTIONS[mod] ?? ['read'];
      for (const action of actions) {
        rows.push({ role, module: mod, action });
      }
    }
  }

  return rows;
}
