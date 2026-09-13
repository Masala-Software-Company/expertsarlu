# eXpert SARLU — Logiciel interne

Bureau de Coordination Médicale Internationale.

| Couche | Dossier | Techno |
|---|---|---|
| Backend API | **`backend/`** | NestJS + Prisma + PostgreSQL + JWT + CASL |
| Frontend desktop | **`frontend/`** | Tauri 2 + React + Vite + Tailwind |
| Hébergement API | Railway (Root Directory = `backend`) | |
| Distribution client | Google Drive + `VersionChecker` | |

Couleurs : `#144EB9` · `#0A0A0A` · `#FFFFFF`

---

## Structure

```
expert-sarlu/
├── backend/          ← NestJS API (à déployer sur Railway)
├── frontend/         ← App Tauri/React (binaires locaux / Drive)
├── logo/
├── scripts/
├── docker-compose.yml
└── pnpm-workspace.yaml
```

---

## Prérequis

- Node.js ≥ 20, pnpm 9, Rust (pour Tauri)
- PostgreSQL + Redis : `pnpm dev:db` ou `docker compose up -d postgres redis`

---

## Démarrage local

```bash
pnpm install
pnpm dev:db

cp backend/.env.example backend/.env
pnpm --filter @expert/backend prisma:generate
pnpm --filter @expert/backend exec prisma db push
pnpm --filter @expert/backend prisma:seed
pnpm --filter @expert/backend dev
# → http://localhost:3000/api/docs · /health

pnpm --filter @expert/frontend dev          # navigateur :1420
pnpm --filter @expert/frontend tauri:dev    # desktop natif
```

Comptes démo (mdp `Expert2026!`) : `admin@expert.sarlu`, `nathan@…`, `emmanuelle@…`, `ketsia@…`, `jephte@…`, `grace@…`

---

## Déploiement Railway (backend)

Le build échoue si Railway pointe sur la **racine** du monorepo (pas de script `start` à la racine).

### Configuration obligatoire du service API

1. Ouvre le service **@expert/api** (ou renomme-le **backend**)
2. **Settings → Root Directory** → saisis exactement : `backend`
3. Variables (Variables → Shared / Service) :
   - `DATABASE_URL` = référence Postgres Railway (`${{Postgres.DATABASE_URL}}`)
   - `REDIS_URL` = référence Redis (`${{Redis.REDIS_URL}}`) si utilisé
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (secrets longs)
   - `NODE_ENV=production`
   - `PORT` laissé à Railway (ou `3000`)
4. **Ne déploie pas** le frontend Tauri sur Railway (c’est une app desktop). Tu peux supprimer le service `@expert/desktop`.
5. Redeploy

Fichiers déjà dans `backend/` :

- `package.json` → `"start": "node dist/main.js"` + `"start:prod"`
- `railway.toml` / `railway.json` → build + start + healthcheck `/health`

Après deploy : `https://<ton-service>.up.railway.app/health`

Puis mets à jour `frontend/.env` :

```
VITE_API_URL=https://<ton-service>.up.railway.app/api
```

---

## Build desktop (Drive)

```bash
python3 scripts/generate-app-icon.py
pnpm --filter @expert/frontend exec tauri icon frontend/src-tauri/icons/icon-source.png
pnpm --filter @expert/frontend tauri:build
```
