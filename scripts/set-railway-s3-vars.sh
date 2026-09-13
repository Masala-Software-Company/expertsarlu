#!/usr/bin/env bash
# Pousse les variables S3 du fichier backend/.env vers Railway.
# Prérequis: npm i -g @railway/cli && railway login && railway link
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
command -v railway >/dev/null || {
  echo "Installez Railway CLI: npm i -g @railway/cli && railway login"
  exit 1
}
[ -f "$ENV_FILE" ] || {
  echo "Manque $ENV_FILE"
  exit 1
}

get_var() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

S3_ENDPOINT="$(get_var S3_ENDPOINT)"
S3_REGION="$(get_var S3_REGION)"
S3_BUCKET="$(get_var S3_BUCKET)"
S3_ACCESS_KEY_ID="$(get_var S3_ACCESS_KEY_ID)"
S3_SECRET_ACCESS_KEY="$(get_var S3_SECRET_ACCESS_KEY)"

: "${S3_ENDPOINT:?S3_ENDPOINT manquant}"
: "${S3_BUCKET:?S3_BUCKET manquant}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID manquant}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY manquant}"

railway variables set \
  "S3_ENDPOINT=${S3_ENDPOINT}" \
  "S3_REGION=${S3_REGION:-auto}" \
  "S3_BUCKET=${S3_BUCKET}" \
  "S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}" \
  "S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}"

echo "OK — variables S3 poussées sur Railway."
