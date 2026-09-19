import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { buildPermissionRows } from '../src/auth/permissions.matrix';

const prisma = new PrismaClient();

async function seedPermissions() {
  await prisma.permission.deleteMany();
  const rows = buildPermissionRows();
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
    { cle: 'accompagnateur', libelle: 'Accompagnateur', reference: 'ACC-01', montant: 350, unite: 'personne' },
    { cle: 'navette_aeroport', libelle: 'Navette aéroport', reference: 'NAV-01', montant: 70, unite: 'trajet' },
    { cle: 'ambulance', libelle: 'Ambulance', reference: 'AMB-01', montant: 150, unite: 'trajet' },
    { cle: 'assurance_j_le_30', libelle: 'Assurance / jour (≤ 30 jours)', reference: 'ASS-J30', montant: 7, unite: 'jour' },
    { cle: 'assurance_j_ge_31', libelle: 'Assurance / jour (≥ 31 jours)', reference: 'ASS-J31', montant: 6.5, unite: 'jour' },
    { cle: 'patient_principal', libelle: 'Patient principal', reference: 'PAT-01', montant: 0, unite: 'personne' },
  ];

  for (const t of tarifs) {
    await prisma.tarifBase.upsert({
      where: { cle: t.cle },
      create: t,
      update: { libelle: t.libelle, montant: t.montant, unite: t.unite, reference: t.reference },
    });
  }
  console.log(`Tarifs: ${tarifs.length}`);
}

async function seedVersion() {
  const version = process.env.APP_VERSION || '1.0.6';
  await prisma.appVersion.updateMany({
    where: { version: { not: version } },
    data: { actif: false },
  });
  await prisma.appVersion.upsert({
    where: { version },
    create: {
      version,
      changelog:
        'Correctifs mises à jour installateurs, factures manuelles/auto, documents passeport & médical.',
      driveUrl: process.env.DRIVE_DOWNLOAD_URL,
      downloadUrlMac:
        process.env.PUBLIC_API_BASE_URL
          ? `${process.env.PUBLIC_API_BASE_URL.replace(/\/$/, '')}/version/download/mac`
          : undefined,
      downloadUrlWin:
        process.env.PUBLIC_API_BASE_URL
          ? `${process.env.PUBLIC_API_BASE_URL.replace(/\/$/, '')}/version/download/win`
          : undefined,
      actif: true,
    },
    update: {
      actif: true,
      changelog:
        'Correctifs mises à jour installateurs, factures manuelles/auto, documents passeport & médical.',
    },
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
