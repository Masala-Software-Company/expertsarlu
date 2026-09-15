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
