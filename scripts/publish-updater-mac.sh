#!/usr/bin/env bash
# Publie Mac updater (tar.gz + sig) + DMG vers S3 et enregistre AppVersion 1.0.8
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-1.0.8}"
CHANGELOG="${CHANGELOG:-Mise à jour eXpert ${VERSION} — suppression équipe, sécurité renforcée, corrections facturation et dossiers.}"

BUNDLE_DIR="${1:-}"
if [[ -z "$BUNDLE_DIR" ]]; then
  for c in \
    "$ROOT/frontend/src-tauri/target/release/bundle/macos" \
    /var/folders/*/T/cursor-sandbox-cache/*/cargo-target/release/bundle/macos
  do
    if ls $c/eXpert.app.tar.gz >/dev/null 2>&1; then
      BUNDLE_DIR="$(dirname "$(ls -d $c/eXpert.app.tar.gz | head -1)")"
      break
    fi
  done
fi

if [[ -z "${BUNDLE_DIR:-}" || ! -f "$BUNDLE_DIR/eXpert.app.tar.gz" ]]; then
  echo "Introuvable: eXpert.app.tar.gz — lancez d’abord: pnpm tauri:build"
  exit 1
fi

SIG="$BUNDLE_DIR/eXpert.app.tar.gz.sig"
TAR="$BUNDLE_DIR/eXpert.app.tar.gz"
if [[ ! -f "$SIG" ]]; then
  echo "Signature manquante: $SIG"
  exit 1
fi

DMG=""
for d in \
  "$(dirname "$BUNDLE_DIR")/dmg"/eXpert_${VERSION}_*.dmg \
  "$(dirname "$BUNDLE_DIR")/dmg"/*.dmg
do
  if [[ -f "$d" ]]; then DMG="$d"; break; fi
done

cd "$ROOT/backend"
export VERSION CHANGELOG TAR SIG DMG ROOT
node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.env.ROOT;
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, 'backend/.env'), 'utf8').split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = env.DATABASE_URL;
const client = new S3Client({
  endpoint: env.S3_ENDPOINT || env.ENDPOINT,
  region: env.S3_REGION || env.REGION || 'auto',
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID || env.ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const bucket = env.S3_BUCKET || env.BUCKET;
const prisma = new PrismaClient();
const version = process.env.VERSION;
const changelog = process.env.CHANGELOG;
const tar = fs.readFileSync(process.env.TAR);
const sig = fs.readFileSync(process.env.SIG, 'utf8').trim();
const api = 'https://expertsarlu-production.up.railway.app/api';

(async () => {
  console.log('Upload mac updater', tar.length, 'bytes');
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'releases/eXpert.app.tar.gz',
    Body: tar,
    ContentType: 'application/gzip',
  }));
  if (process.env.DMG && fs.existsSync(process.env.DMG)) {
    const dmg = fs.readFileSync(process.env.DMG);
    console.log('Upload mac dmg', dmg.length, 'bytes');
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: 'releases/eXpert-mac.dmg',
      Body: dmg,
      ContentType: 'application/x-apple-diskimage',
    }));
  }
  await prisma.appVersion.updateMany({ data: { actif: false } });
  const row = await prisma.appVersion.upsert({
    where: { version },
    create: {
      version,
      changelog,
      downloadUrlMac: `${api}/version/download/mac`,
      downloadUrlWin: `${api}/version/download/win`,
      updaterMacSig: sig,
      actif: true,
    },
    update: {
      actif: true,
      updaterMacSig: sig,
      changelog,
      downloadUrlMac: `${api}/version/download/mac`,
      downloadUrlWin: `${api}/version/download/win`,
    },
  });
  console.log('Publié', row.version, 'mac sig', !!row.updaterMacSig, 'win sig', !!row.updaterWinSig);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
NODE
