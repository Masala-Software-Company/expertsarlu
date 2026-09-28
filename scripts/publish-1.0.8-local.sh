#!/bin/zsh
# Publie eXpert 1.0.8 (Mac déjà local + Windows via CI) vers S3/DB.
# Usage: zsh scripts/publish-1.0.8-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd "$ROOT"
echo "=== Publish eXpert 1.0.8 ==="

GH=$(command -v gh || true)
if [[ -z "$GH" ]]; then
  curl -sL -o /tmp/gh.tgz https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_macOS_amd64.tar.gz
  tar -xzf /tmp/gh.tgz -C /tmp
  GH=/tmp/gh_2.63.2_macOS_amd64/bin/gh
fi

mkdir -p /tmp/expert-win-108 "$ROOT/releases" "$HOME/Desktop/eXpert-installateurs"
RUN=$($GH run list -R Masala-Software-Company/expertsarlu --workflow=build-windows.yml --limit 5 --json databaseId,conclusion,headSha -q '.[]|select(.conclusion=="success")|.databaseId' | head -1)
echo "run=$RUN"
$GH run download "$RUN" -R Masala-Software-Company/expertsarlu -D /tmp/expert-win-108 || true
find /tmp/expert-win-108 -type f | head -20
EXE=$(find /tmp/expert-win-108 -name '*.exe' | head -1)
SIG=$(find /tmp/expert-win-108 -name '*.sig' | head -1)
if [[ -n "$EXE" ]]; then
  cp -f "$EXE" "$ROOT/releases/eXpert_1.0.8_Windows.exe"
  cp -f "$EXE" "$HOME/Desktop/eXpert-installateurs/eXpert_1.0.8_Windows.exe"
  [[ -n "$SIG" ]] && cp -f "$SIG" "$ROOT/releases/eXpert_1.0.8_Windows.exe.sig"
fi
[[ -f "$ROOT/releases/eXpert_1.0.8_macOS.dmg" ]] && cp -f "$ROOT/releases/eXpert_1.0.8_macOS.dmg" "$HOME/Desktop/eXpert-installateurs/" || true

cd "$ROOT/backend"
node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, 'backend/.env'), 'utf8').split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
process.env.DATABASE_URL = env.DATABASE_URL;
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
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
const api = 'https://expertsarlu-production.up.railway.app/api';
const version = '1.0.8';
const changelog = 'Mise à jour eXpert 1.0.8 — suppression équipe, sécurité renforcée, corrections facturation et dossiers.';
async function put(Key, file, ContentType) {
  if (!file || !fs.existsSync(file)) { console.log('skip', Key); return false; }
  const Body = fs.readFileSync(file);
  console.log('upload', Key, Body.length);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType }));
  return true;
}
(async () => {
  const macTar = path.join(root, 'releases/eXpert.app.tar.gz');
  const macSig = path.join(root, 'releases/eXpert.app.tar.gz.sig');
  const macDmg = path.join(root, 'releases/eXpert_1.0.8_macOS.dmg');
  const winExe = path.join(root, 'releases/eXpert_1.0.8_Windows.exe');
  const winSig = path.join(root, 'releases/eXpert_1.0.8_Windows.exe.sig');
  await put('releases/eXpert.app.tar.gz', macTar, 'application/gzip');
  await put('releases/eXpert-mac.dmg', macDmg, 'application/x-apple-diskimage');
  await put('releases/eXpert-setup.exe', winExe, 'application/octet-stream');
  await put('releases/eXpert-win.exe', winExe, 'application/octet-stream');
  const macSigText = fs.readFileSync(macSig, 'utf8').trim();
  const winSigText = fs.existsSync(winSig) ? fs.readFileSync(winSig, 'utf8').trim() : null;
  await prisma.appVersion.updateMany({ data: { actif: false } });
  const row = await prisma.appVersion.upsert({
    where: { version },
    create: {
      version, changelog,
      downloadUrlMac: api + '/version/download/mac',
      downloadUrlWin: api + '/version/download/win',
      updaterMacSig: macSigText,
      updaterWinSig: winSigText,
      actif: true,
    },
    update: {
      actif: true, changelog,
      downloadUrlMac: api + '/version/download/mac',
      downloadUrlWin: api + '/version/download/win',
      updaterMacSig: macSigText,
      ...(winSigText ? { updaterWinSig: winSigText } : {}),
    },
  });
  console.log('Publié', row.version, 'mac', !!row.updaterMacSig, 'win', !!row.updaterWinSig);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); process.exit(1); });
NODE

echo "=== Verify ==="
curl -sS https://expertsarlu-production.up.railway.app/api/version/latest; echo
curl -sS https://expertsarlu-production.up.railway.app/api/version/tauri-update; echo
ls -lah "$HOME/Desktop/eXpert-installateurs" | tail -12
