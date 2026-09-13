import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const MODULE_ACTIONS: Record<string, string[]> = {
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
};

const ROLE_MODULES: Record<RoleName, string[]> = {
  SUPER_ADMIN: Object.keys(MODULE_ACTIONS),
  ASSISTANT_MANAGER: [
    'dossiers',
    'cotation',
    'facturation',
    'logistique',
    'ged',
    'notifications',
    'audit',
  ],
  SUPPORT_CLIENT: ['dossiers', 'prospects', 'partenaires', 'ged', 'notifications'],
  CAISSE_ADMIN: ['dossiers', 'cotation', 'facturation', 'ged', 'notifications'],
  PROTOCOLE: ['dossiers', 'logistique', 'ged', 'notifications'],
};

const ROLE_ACTIONS: Partial<Record<RoleName, Record<string, string[]>>> = {
  ASSISTANT_MANAGER: {
    dossiers: ['create', 'read', 'update', 'delete', 'validate'],
    audit: ['read'],
  },
  SUPPORT_CLIENT: {
    dossiers: ['create', 'read', 'update'],
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

async function seedPermissions() {
  await prisma.permission.deleteMany();
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
      const actions =
        ROLE_ACTIONS[role]?.[mod] ?? MODULE_ACTIONS[mod] ?? ['read'];
      for (const action of actions) {
        rows.push({ role, module: mod, action });
      }
    }
  }

  await prisma.permission.createMany({ data: rows });
  console.log(`Permissions: ${rows.length}`);
}

async function seedAdmin() {
  // Purge données de démo (garde uniquement le Super Admin)
  await prisma.prospect.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.documentGED.deleteMany();
  await prisma.ligneCotation.deleteMany();
  await prisma.calculAssurance.deleteMany();
  await prisma.facture.deleteMany();
  await prisma.rendezVous.deleteMany();
  await prisma.tacheLogistique.deleteMany();
  await prisma.accompagnateur.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.demandeDeverrouillage.deleteMany();
  await prisma.dossier.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { not: 'admin@expert.sarlu' } },
  });

  const seedPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error(
      'SEED_ADMIN_PASSWORD manquant ou trop court (min. 8). Définis-le dans backend/.env avant de lancer le seed.',
    );
  }

  const hashPassword = await argon2.hash(seedPassword);
  await prisma.user.upsert({
    where: { email: 'admin@expert.sarlu' },
    create: {
      nom: 'Admin',
      email: 'admin@expert.sarlu',
      role: 'SUPER_ADMIN',
      hashPassword,
    },
    update: {
      // Ne pas écraser le nom personnalisé déjà enregistré
      role: 'SUPER_ADMIN',
      hashPassword,
      actif: true,
    },
  });
  console.log('Demo data purged. Super Admin only (admin@expert.sarlu)');
}

async function seedTarifs() {
  const tarifs = [
    { cle: 'accompagnateur', libelle: 'Accompagnateur', montant: 350, unite: 'personne' },
    { cle: 'navette_aeroport', libelle: 'Navette aéroport', montant: 70, unite: 'trajet' },
    { cle: 'ambulance', libelle: 'Ambulance', montant: 150, unite: 'trajet' },
    { cle: 'assurance_j_le_30', libelle: 'Assurance / jour (J≤30)', montant: 7, unite: 'jour' },
    { cle: 'assurance_j_ge_31', libelle: 'Assurance / jour (J≥31)', montant: 6.5, unite: 'jour' },
    { cle: 'patient_principal', libelle: 'Patient principal', montant: 0, unite: 'personne' },
  ];

  for (const t of tarifs) {
    await prisma.tarifBase.upsert({
      where: { cle: t.cle },
      create: t,
      update: { libelle: t.libelle, montant: t.montant, unite: t.unite },
    });
  }
  console.log(`Tarifs: ${tarifs.length}`);
}

async function seedVersion() {
  await prisma.appVersion.upsert({
    where: { version: '1.0.0' },
    create: {
      version: '1.0.0',
      changelog: 'MVP eXpert — Dossiers, Cotation, Validation, RBAC',
      driveUrl: process.env.DRIVE_DOWNLOAD_URL,
      actif: true,
    },
    update: { actif: true },
  });
}

async function main() {
  await seedPermissions();
  await seedAdmin();
  await seedTarifs();
  await seedVersion();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
