# Domaines publics expert-evac.com — à coller dans Railway → Variables

PUBLIC_VERIFY_BASE_URL=https://verify.expert-evac.com
PUBLIC_FORM_BASE_URL=https://form.expert-evac.com
PUBLIC_PATIENT_PORTAL_URL=https://form.expert-evac.com
PUBLIC_SUIVI_BASE_URL=https://patient.expert-evac.com

# Étendre le CORS existant (ne pas écraser les origines locales / Tauri)
# CORS_ORIGINS=http://localhost:1420,tauri://localhost,https://tauri.localhost,https://form.expert-evac.com,https://patient.expert-evac.com,https://verify.expert-evac.com

# DNS
# verify.expert-evac.com  → Custom Domain Railway (service API)  → sert /v/:code
# form.expert-evac.com    → Vercel (Root = apps/patient-portal) → formulaire /
# patient.expert-evac.com → Vercel (même projet)                 → /suivi/:token

# ---------------------------------------------------------------------------
# Si verify.expert-evac.com affiche « Application failed to respond » (502) :
# 1. Railway → expertsarlu → Settings → Networking → Custom Domain
#    verify.expert-evac.com doit cibler le MÊME port que *.up.railway.app (souvent 8080)
# 2. Cloudflare → DNS → verify :
#    - Type CNAME → expertsarlu-production.up.railway.app
#    - Proxy : NUAGE GRIS (DNS only) — le proxy orange cause souvent le 502
# 3. Si vous gardez le proxy orange : SSL/TLS = Full (strict), jamais Flexible
# 4. Test de contrôle (doit afficher la page HTML eXpert) :
#    https://expertsarlu-production.up.railway.app/v/TESTCODE
# ---------------------------------------------------------------------------
