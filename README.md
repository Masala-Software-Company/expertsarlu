# eXpert SARLU — Logiciel interne

Bureau de Coordination Médicale Internationale.  
Stack conforme au [dossier de spécifications](./eXpert-SARLU-Dossier-Specifications.md) :

| Couche | Techno |
|---|---|
| Desktop | **Tauri 2** + React 18 + TypeScript + Vite + Tailwind |
| API | **NestJS** + Prisma + **PostgreSQL** + JWT + CASL |
| Files async | Redis / BullMQ (prévu, Docker Compose inclus) |
| Hébergement API | Railway (`apps/api/railway.json`) |
| Distribution client | Google Drive interne + `VersionChecker` (`GET /api/version/latest`) |

Couleurs marque : `#144EB9` · `#0A0A0A` · `#FFFFFF` — logos dans `logo/` et `apps/desktop/src/assets/logos/`.

---

## Prérequis

- Node.js ≥ 20
- **pnpm** 9 (`npm i -g pnpm`)
- **Rust** stable (`rustup`) — obligatoire pour Tauri
- **PostgreSQL 16** + **Redis** :
  - via `docker compose up -d postgres redis` **ou**
  - via `pnpm dev:db` (PostgreSQL/Redis locaux dans `.tools/`)
- macOS : Xcode CLT ; Windows : WebView2

---

## Démarrage local

```bash
# 1. Infra DB
pnpm dev:db
# (alternative) docker compose up -d postgres redis adminer

# 2. Dépendances
pnpm install

# 3. API
cp apps/api/.env.example apps/api/.env
pnpm --filter @expert/api prisma:generate
pnpm --filter @expert/api exec prisma db push
pnpm --filter @expert/api prisma:seed
pnpm --filter @expert/api dev
# → http://localhost:3000/api/docs  ·  health: http://localhost:3000/health

# 4. UI (navigateur, port Tauri)
pnpm --filter @expert/desktop dev
# → http://localhost:1420

# 5. Desktop natif Tauri
pnpm --filter @expert/desktop tauri:dev
```
### Comptes de démo (mot de passe `Expert2026!`)

| Email | Rôle |
|---|---|
| `admin@expert.sarlu` | Super Admin |
| `nathan@expert.sarlu` | Assistant Manager |
| `emmanuelle@expert.sarlu` | Support Client |
| `ketsia@expert.sarlu` | Caisse & Admin |
| `jephte@expert.sarlu` / `grace@expert.sarlu` | Protocole |

---

## Build & dépôt Google Drive (section 2bis)

Régénérer l’icône native (squircle macOS / ICO Windows / PNG Linux) :

```bash
python3 scripts/generate-app-icon.py
pnpm --filter @expert/desktop exec tauri icon apps/desktop/src-tauri/icons/icon-source.png
```

```bash
# Binaires .dmg (macOS) / .msi|.exe (Windows) / .AppImage|.deb (Linux)
pnpm --filter @expert/desktop tauri:build
```

Artefacts typiques :

- macOS : `apps/desktop/src-tauri/target/release/bundle/dmg/` — icône squirclée (rayon type Launchpad)
- Windows : `…/bundle/msi/` ou `nsis/` (`.exe`) — `icon.ico` multi-résolutions
- Linux : `…/bundle/appimage/` et `…/bundle/deb/` — PNG à coins transparents (GNOME/KDE)
Déposer dans le Drive partagé `eXpert SARLU > Logiciel Interne > Téléchargements` :

1. `eXpert-Setup-Mac.dmg` / `eXpert-Setup-Windows.exe`
2. Mettre à jour `Version.txt` + changelog
3. Mettre à jour la version active via seed / table `app_versions` (et `VITE_APP_VERSION` / `APP_VERSION`) pour que la bannière `VersionChecker` s’affiche

Pas de plugin auto-updater Tauri : distribution manuelle Drive, comme spécifié.

---

## Modules livrés (MVP spec)

**API NestJS**

- Auth JWT + refresh rotation · Users · RBAC CASL + Guards
- Dossiers (MED-YYYY-XXXX séquentiel, verrouillage, soft-delete / corbeille / hard-delete)
- Cotation (assurance J×7 / J×6,50) · Tarification Super Admin only
- Facturation (règle bloquante paiement) · Logistique · GED · Audit · Notifications WS · Version · Health

**Desktop**

- Login marque · Dashboard par rôle · Dossiers table + Kanban
- Fiche dossier (onglets) · Cotation live · Tarification · Corbeille
- Prospects · Planning Protocole · Audit · ⌘K · VersionChecker · dark toggle

---

## Variables d’environnement

Voir `apps/api/.env.example` et `apps/desktop/.env.example`.  
**Ne jamais committer** de secrets Railway / JWT réels.
