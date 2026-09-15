# Portail public de pré-enregistrement patient

Application **indépendante** d’Expert SARLU, destinée à Vercel.

## Architecture

```
Patient (navigateur)
  → apps/patient-portal (Vercel)
  → POST /api/public/pre-inscriptions (Railway / NestJS)
  → table pre_inscriptions + photo (S3/local)
  → notification Super Admin / Assistant / Support
  → écran interne « Nouveaux patients »
  → création dossier Expert après vérification
```

Le patient n’a **aucun accès** au logiciel interne.

## Développement local

```bash
# API (Railway ou locale)
pnpm dev:api

# Portail (http://localhost:5174)
pnpm dev:portal
```

Variables :

```env
VITE_API_URL=http://localhost:3000/api
```

En production, pointer vers l’API Railway :

```
VITE_API_URL=https://expertsarlu-production.up.railway.app/api
```

Sur Railway, le domaine Vercel doit être autorisé en CORS (déjà inclus pour
`https://patient-form-gold.vercel.app` ; sinon ajoutez-le dans `CORS_ORIGINS`).

## Déploiement Vercel

1. Root Directory : `apps/patient-portal`
2. Build : `pnpm build`
3. Output : `dist`
4. Env : `VITE_API_URL=https://<votre-api>/api`
