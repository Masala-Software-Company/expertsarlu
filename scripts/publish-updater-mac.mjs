#!/usr/bin/env node
/**
 * Upload eXpert.app.tar.gz (+ .sig) vers S3 et enregistre updaterMacSig en base.
 * Usage: node scripts/publish-updater-mac.mjs [chemin/vers/macos]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, 'backend/.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

function findBundleDir(arg) {
  if (arg && fs.existsSync(path.join(arg, 'eXpert.app.tar.gz'))) return arg;
  const candidates = [
    path.join(root, 'frontend/src-tauri/target/release/bundle/macos'),
  ];
  try {
    const found = execSync(
      'find /var/folders -name "eXpert.app.tar.gz" 2>/dev/null | head -5',
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const f of found) candidates.push(path.dirname(f));
  } catch {
    /* ignore */
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'eXpert.app.tar.gz'))) return c;
  }
  return null;
}

async function main() {
  const dir = findBundleDir(process.argv[2]);
  if (!dir) {
    console.error('eXpert.app.tar.gz introuvable — lancez un build Tauri signé d’abord.');
    process.exit(1);
  }
  const tarPath = path.join(dir, 'eXpert.app.tar.gz');
  const sigPath = path.join(dir, 'eXpert.app.tar.gz.sig');
  if (!fs.existsSync(sigPath)) {
    console.error('Signature manquante:', sigPath);
    process.exit(1);
  }

  process.env.DATABASE_URL = env.DATABASE_URL;
  const { S3Client, PutObjectCommand } = require(path.join(
    root,
    'backend/node_modules/@aws-sdk/client-s3',
  ));
  // resolve from monorepo
  let S3, PrismaClient;
  try {
    ({ S3Client: S3, PutObjectCommand } = require('@aws-sdk/client-s3'));
  } catch {
    ({ S3Client: S3, PutObjectCommand } = require(path.join(
      root,
      'node_modules/@aws-sdk/client-s3',
    )));
  }
  try {
    ({ PrismaClient } = require('@prisma/client'));
  } catch {
    ({ PrismaClient } = require(path.join(
      root,
      'node_modules/.pnpm/node_modules/@prisma/client',
    )));
  }

  // Prefer workspace resolution
  const aws = require(require.resolve('@aws-sdk/client-s3', { paths: [path.join(root, 'backend'), root] }));
  const prismaMod = require(require.resolve('@prisma/client', { paths: [path.join(root, 'backend'), root] }));

  const client = new aws.S3Client({
    endpoint: env.S3_ENDPOINT || env.ENDPOINT,
    region: env.S3_REGION || env.REGION || 'auto',
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID || env.ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  const bucket = env.S3_BUCKET || env.BUCKET;
  const prisma = new prismaMod.PrismaClient();
  const tar = fs.readFileSync(tarPath);
  const sig = fs.readFileSync(sigPath, 'utf8').trim();
  const api = 'https://expertsarlu-production.up.railway.app/api';
  const version = '1.0.5';

  console.log('Upload', tarPath, tar.length, 'bytes');
  await client.send(
    new aws.PutObjectCommand({
      Bucket: bucket,
      Key: 'releases/eXpert.app.tar.gz',
      Body: tar,
      ContentType: 'application/gzip',
    }),
  );

  // DMG classique si présent à côté
  const dmgCandidates = [
    path.join(dir, '../dmg/eXpert_1.0.5_x64.dmg'),
    path.join(root, 'releases/eXpert_1.0.5_macOS.dmg'),
  ];
  for (const dmg of dmgCandidates) {
    if (fs.existsSync(dmg)) {
      console.log('Upload DMG', dmg);
      await client.send(
        new aws.PutObjectCommand({
          Bucket: bucket,
          Key: 'releases/eXpert-mac.dmg',
          Body: fs.readFileSync(dmg),
          ContentType: 'application/x-apple-diskimage',
        }),
      );
      break;
    }
  }

  await prisma.appVersion.updateMany({ data: { actif: false } });
  const row = await prisma.appVersion.upsert({
    where: { version },
    create: {
      version,
      changelog: 'Mise à jour silencieuse eXpert — installation automatique.',
      downloadUrlMac: `${api}/version/download/mac`,
      downloadUrlWin: `${api}/version/download/win`,
      updaterMacSig: sig,
      actif: true,
    },
    update: {
      actif: true,
      updaterMacSig: sig,
      changelog: 'Mise à jour silencieuse eXpert — installation automatique.',
      downloadUrlMac: `${api}/version/download/mac`,
      downloadUrlWin: `${api}/version/download/win`,
    },
  });
  console.log('Publié', row.version, '| sig chars', sig.length);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
