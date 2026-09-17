#!/usr/bin/env bash
# Publie les artefacts Tauri updater (mac) vers S3 + signatures en base.
# Usage (depuis la racine) :
#   export TAURI_SIGNING_PRIVATE_KEY_PATH=frontend/src-tauri/keys/expert.key
#   bash scripts/publish-updater-mac.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

BUNDLE_DIR="${1:-}"
if [[ -z "$BUNDLE_DIR" ]]; then
  # chemin sandbox Cursor ou target local
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

if [[ -z "$BUNDLE_DIR" || ! -f "$BUNDLE_DIR/eXpert.app.tar.gz" ]]; then
  echo "Introuvable: eXpert.app.tar.gz — lancez d’abord: pnpm tauri:build"
  exit 1
fi

SIG="$BUNDLE_DIR/eXpert.app.tar.gz.sig"
TAR="$BUNDLE_DIR/eXpert.app.tar.gz"
if [[ ! -f "$SIG" ]]; then
  echo "Signature manquante: $SIG (TAURI_SIGNING_PRIVATE_KEY requis au build)"
  exit 1
fi

node <<NODE
const fs = require('fs');
const path = require('path');
const env = Object.fromEntries(
  fs.readFileSync(path.join('${ROOT.replace(/'/g, '')}/backend/.env'),'utf8').split('\\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; })
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
const tar = fs.readFileSync('${TAR.replace(/'/g, '')}');
const sig = fs.readFileSync('${SIG.replace(/'/g, '')}', 'utf8').trim();
const api = 'https://expertsarlu-production.up.railway.app/api';
(async () => {
  console.log('Upload', tar.length, 'bytes');
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'releases/eXpert.app.tar.gz',
    Body: tar,
    ContentType: 'application/gzip',
  }));
  // garder aussi le DMG classique si présent
  const dmg = '${BUNDLE_DIR.replace(/'/g, '')}'.replace('/macos','/dmg') + '/eXpert_1.0.5_x64.dmg';
  // ignore dmg path variants
  await prisma.appVersion.updateMany({ data: { actif: false } });
  const row = await prisma.appVersion.upsert({
    where: { version: '1.0.5' },
    create: {
      version: '1.0.5',
      changelog: 'Mise à jour silencieuse eXpert — installation automatique.',
      downloadUrlMac: api + '/version/download/mac',
      downloadUrlWin: api + '/version/download/win',
      updaterMacSig: sig,
      actif: true,
    },
    update: {
      actif: true,
      updaterMacSig: sig,
      changelog: 'Mise à jour silencieuse eXpert — installation automatique.',
      downloadUrlMac: api + '/version/download/mac',
      downloadUrlWin: api + '/version/download/win',
    },
  });
  console.log('Publié', row.version, 'sig length', sig.length);
  await prisma.\$disconnect();
})().catch(async (e) => { console.error(e); await prisma.\$disconnect(); process.exit(1); });
NODE
