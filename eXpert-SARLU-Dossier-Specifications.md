# Dossier de Spécifications — Application "eXpert" (Bureau de Coordination Médicale Internationale)

**Marque :** eXpert SARLU
**Couleurs officielles extraites du logo :** Bleu `#144EB9` · Noir `#0A0A0A` · Blanc `#FFFFFF`
**Date :** Septembre 2026

---

## 0. Synthèse & recommandations clés

Avant les prompts, voici les décisions structurantes que je te recommande en tant qu'ingénieur logiciel, sur base de ton document + du benchmark ci-dessous :

> **Mise à jour importante :** l'application est à **usage interne exclusif** du bureau eXpert SARLU — elle n'est **pas commercialisée** ni distribuée au grand public. Cela simplifie plusieurs choix (pas de page marketing de téléchargement, pas de détection automatique d'OS visiteur, signature de code optionnelle au démarrage), tout en gardant l'architecture "desktop + API centrale" qui reste la bonne approche même en interne (RBAC, audit trail, poste de travail multiple). Voir section 2 mise à jour.

| Décision | Recommandation | Pourquoi |
|---|---|---|
| Distribution | App **Desktop hybride** (Tauri) + API cloud NestJS, diffusée en **interne uniquement** | Les données (dossiers médicaux, finances) doivent rester centralisées côté serveur pour le RBAC, l'audit trail et le row-locking. Le "desktop" est donc un **client lourd** qui consomme une API centrale — pas une app locale isolée. Comme il n'y a pas de commercialisation, la distribution se fait via un **dossier Google Drive partagé de l'entreprise** (voir section 2bis), pas via un site public. |
| Framework desktop | **Tauri 2** (Rust + WebView) plutôt qu'Electron | Binaires 10x plus légers (5-15 Mo vs 150 Mo+), démarrage plus rapide, moins gourmand en RAM, signature de code plus simple pour macOS notarization et Windows Authenticode — critique si tu distribues un `.dmg`/`.exe` depuis ton site vitrine. |
| Frontend UI | **React + Vite + TypeScript + Tailwind + shadcn/ui** | S'intègre nativement dans Tauri, écosystème riche pour dashboards de type "case management" (tables, kanban, formulaires complexes). |
| Backend | **NestJS + PostgreSQL + Prisma** | Tu l'as déjà demandé — NestJS est le bon choix pour du RBAC strict, des modules métiers cloisonnés et des webhooks. |
| Mise à jour desktop | **Tauri Updater** (auto-update signé) | Comme un vrai IDE (VS Code, etc.) — l'app se met à jour automatiquement sans repasser par le site. |

---

## 1. Benchmarking — Applications similaires dans le monde

J'ai comparé ton cahier des charges à 3 catégories de logiciels existants : (A) CRM de tourisme médical, (B) logiciels de gestion de cas (case management) santé, (C) logiciels de visa/mobilité. Voici ce qui mérite d'être **copié ou amélioré** dans eXpert.

### A. CRM de tourisme médical (Planports, MetoCRM, TravelAps, Zenith Medical Tourism)

- <cite index="7-1">Ces outils traitent le parcours patient comme un pipeline commercial multi-canal : les demandes arrivent par WhatsApp, Instagram DM, formulaires web et publicités, et convergent dans une seule liste de leads plutôt que de rester éparpillées dans des téléphones personnels.</cite> **→ À copier :** une boîte de réception unifiée (WhatsApp Business API + email) directement liée au dossier MED-YYYY-XXXX, pour que le module "Onboarding" de Emmanuelle Makoso ne perde jamais un premier contact.
- <cite index="7-1">Les meilleurs outils du secteur proposent un pipeline structuré par étapes du parcours patient — de la première demande jusqu'au suivi post-traitement — plutôt qu'un simple statut "prospect → conclu".</cite> **→ À copier :** visualisation Kanban du workflow séquentiel (Étape 1 à 4 de ton cahier des charges), avec drag-and-drop pour les rôles autorisés uniquement.
- <cite index="7-1">La cotation dans ces plateformes gère des forfaits de traitement, des propositions multidevises et un suivi des validations.</cite> **→ À copier :** ton moteur de calcul (assurance voyage, navettes, accompagnateurs) doit générer un devis PDF multi-devises avec historique de versions (utile si le Super Admin modifie un tarif après coup).
- **MetoCRM** est conçu spécifiquement pour <cite index="4-1">assurer le suivi des patients pendant et après le processus de vente, et générer tous les rapports nécessaires en quelques clics, tout en automatisant les processus propres au secteur du tourisme médical</cite>. **→ À copier :** un module "Suivi post-retour" (le patient est-il rentré, satisfait, a-t-il eu besoin d'un accompagnement après le vol retour ?) — souvent oublié dans les cahiers des charges mais très demandé par les clients institutionnels.

### B. Logiciels de "case management" santé (CaseRM, Medcore, Creatio Healthcare CRM)

- **CaseRM** organise <cite index="2-1">les opérations de la clinique par dossier de cas, et non simplement par profil patient ou par rendez-vous</cite> — exactement ta logique MED-YYYY-XXXX. **→ Déjà bien pensé dans ton cahier des charges**, à conserver tel quel.
- **Medcore** structure son système autour de <cite index="5-1">55+ modules intégrant dossiers cliniques, flux de travail et transactions financières, avec un système de prescriptions, ordonnances de labo, admissions et facturation doté de pistes d'audit</cite>. **→ À copier :** le principe de "modules greffables" — conçois ton architecture NestJS pour qu'on puisse ajouter un module "Suivi clinique" plus tard sans réécrire le core.
- **Creatio CRM** met en avant une CRM <cite index="9-1">nativement pilotée par l'IA pour automatiser la gestion des patients et améliorer la coordination des soins</cite>. **→ À copier (V2) :** suggestions automatiques (relance patient sans réponse depuis X jours, alerte devis en attente > 48h), pas de l'IA générative complexe, juste des règles + notifications intelligentes.

### C. Fonctionnalités transversales à ajouter (issues du marché, absentes de ton document actuel)

1. **Portail patient (self-service)** — un lien sécurisé envoyé par email/WhatsApp où le patient/famille suit en lecture seule l'avancement de son dossier (statut visa, date de vol, montant payé). Très différenciant, faible coût de développement.
2. **Signature électronique** des devis/factures avant paiement — évite les allers-retours papier.
3. **Tableau de bord "Pipeline financier"** pour le Super Admin : encaissé vs facturé vs en attente, par agent, par pays de destination.
4. **Notifications push desktop natives** (via Tauri) : "Nouveau dossier assigné", "Devis en attente de validation depuis 24h" — reproduit la sensation "addictive" d'un vrai outil de travail (comme Slack/Linear).
5. **Recherche globale instantanée** (⌘K / Ctrl+K) façon Linear/Notion pour retrouver un dossier par nom, numéro MED, ou destination — standard UX des bons outils desktop 2026.
6. **Mode hors-ligne partiel** pour l'équipe Protocole sur le terrain (consultation des navettes/vols même sans réseau, synchronisation au retour de connexion) — cohérent avec ton besoin "Interface Mobilité".

---

## 1bis. Matrice d'accès mise à jour (Super Admin + accès par fonction)

Sur base de ta seconde note, voici comment je reformule la matrice RBAC en conciliant les deux documents : le **Super Admin voit et peut tout faire**, et chaque fonction métier n'a accès qu'à son périmètre. Les 4 "blocs fonctionnels" de ta note (Gestion Client, Évaluation Dossier, Service Protocole, Assistant Manager) deviennent des **modules d'accès** au même titre que les rôles déjà définis dans le premier document — les deux systèmes de notes décrivent en réalité la même équipe, vue sous deux angles différents (par personne vs par fonction).

| Module d'accès | Fonctionnalités couvertes | Qui y accède |
|---|---|---|
| **Super Admin** | Accès total et illimité à tous les modules ci-dessous, y compris la **tarification** (grille de prix, modification des tarifs de base), les logs d'audit, la gestion des comptes/rôles, le déverrouillage manuel des dossiers, et la **corbeille** (restauration/suppression définitive). | Direction Générale |
| **Gestion Client** | Enregistrement client, suivi dossier, suivi client, suivi des partenaires, gestion des prospects. | Support Client (Emmanuelle Makoso) |
| **Évaluation Dossier** | Évaluation du coût, évaluation de la durée de traitement, évaluation de la destination finale selon les moyens du patient, facturation (génération de devis/factures — **sans jamais voir/modifier la grille tarifaire de base**, réservée au Super Admin). | Caisse & Admin (Ketsia Ngalula) |
| **Service Protocole** | Suivi des documents à fournir / déjà disponibles, observations, conclusions sur l'état du dossier, documents en cours de création/régularisation, suivi navettes/rendez-vous. **Aucun accès aux modules financiers.** | Protocole (Jephté Kiwa / Grace Moke) |
| **Assistant Manager** | Validation de dossier (déclenche le verrouillage), dépenses administratives, gestion du personnel (présence, etc.), mobilité du patient (billets, navettes), devis final au patient. Ne peut pas modifier la grille tarifaire de base ni déverrouiller un dossier sans accord du Super Admin. | Assistant Manager (Nathan Vakele) |

**Règle technique clé pour le backend :** la **tarification** (paiement patient principal = 0$, accompagnateur = 350$, navette aéroport = 70$, calcul assurance = J×7$ ou J×6,50$, etc.) doit être un module à part, avec un `Guard` NestJS dédié `@RequireRole('SUPER_ADMIN')` sur toutes les routes de configuration de prix — les autres rôles consultent le résultat du calcul mais ne peuvent jamais modifier les taux de base.

## 1ter. Suppression douce (corbeille) des dossiers

Ajout demandé : aucune suppression de dossier ne doit être définitive par défaut.

- Un dossier "supprimé" passe en statut **`ARCHIVE_SUPPRIME`** avec horodatage (`supprime_le`) et auteur (`supprime_par_id`) — il **disparaît des listes actives** mais reste en base de données.
- Une vue **"Corbeille"**, accessible uniquement au **Super Admin** (et éventuellement à l'Assistant Manager en lecture seule), liste tous les dossiers supprimés avec la possibilité de :
  - **Restaurer** le dossier (retour à son statut précédent, action tracée dans l'AuditLog),
  - ou de le **supprimer définitivement** (hard delete), action irréversible, réservée exclusivement au Super Admin, avec double confirmation ("Tapez le numéro du dossier pour confirmer").
- Politique de rétention suggérée : conservation en corbeille pendant **90 jours** avant purge automatique (configurable), avec notification au Super Admin avant purge définitive.
- Toute suppression et toute restauration génèrent une entrée dans l'AuditLog immuable (qui l'a fait, quand, sur quel dossier) — cohérent avec le principe de traçabilité déjà prévu.

---

## 2. Stratégie de distribution Desktop — usage interne uniquement

Puisque l'app n'est utilisée **qu'au sein du bureau eXpert SARLU** (pas de commercialisation, pas de grand public), la stratégie se simplifie par rapport à un produit vendu :

- **Build tool :** Tauri 2.x — génère `.dmg`/`.app` pour macOS et `.exe`/`.msi` pour Windows, à partir du même code React. On garde Tauri (plutôt qu'Electron) même en interne : légèreté, démarrage rapide, moins de RAM consommée sur les postes du bureau.
- **Pas de site public de téléchargement.** À la place :
  - **Google Drive** : un dossier partagé de l'entreprise (ex: `eXpert SARLU > Logiciel Interne > Téléchargements`) où l'équipe télécharge la dernière version — c'est la solution retenue, détaillée en section 2bis.
- **Signature de code : recommandée mais non bloquante.** Comme les postes sont ceux du bureau (pas des inconnus sur internet), tu peux démarrer sans certificat payant (juste autoriser l'app manuellement une fois sur chaque Mac via "Ouvrir quand même"). Mais si le budget le permet, un certificat évite cette manipulation à chaque nouvelle installation/mise à jour et donne un aspect plus professionnel en interne aussi.
- **Auto-update :** conserver le Tauri Updater — même en interne, c'est très utile pour pousser une correction de bug ou une nouvelle fonctionnalité à toute l'équipe (Nathan, Ketsia, Emmanuelle, Jephté, Grace) sans repasser poste par poste.
- **Authentification desktop :** l'app Tauri ne stocke aucune donnée métier localement — elle s'authentifie via OAuth2/JWT contre le backend NestJS central (hébergé sur Railway), avec token stocké de façon chiffrée dans le trousseau natif de l'OS (Keychain macOS / Credential Manager Windows), via le plugin `tauri-plugin-store` + `keyring`.
- **Accès réseau restreint (optionnel mais recommandé pour une app médicale/financière interne) :** configurer l'API NestJS pour n'accepter les connexions que depuis l'IP fixe du bureau (ou via un VPN d'entreprise) si l'équipe Protocole n'a pas besoin d'un accès terrain hors des locaux — sinon prévoir un accès distant sécurisé (VPN) plutôt qu'une API totalement ouverte sur internet.

---

## 2bis. Décision finale d'hébergement & distribution (à donner telle quelle à Claude Code)

Pour lever toute ambiguïté avant le développement, voici la décision arrêtée :

### Hébergement (le seul composant qui tourne en continu)
- **Railway** héberge uniquement le **backend** :
  - L'API NestJS
  - PostgreSQL (addon Railway)
  - Redis pour BullMQ (addon Railway ou Upstash)
- Toutes les données sensibles (dossiers, patients, finances, GED) vivent exclusivement ici. **Aucune donnée métier ne doit jamais être stockée dans le code de l'application desktop.**
- Toutes les clés/secrets (JWT secret, identifiants base de données, clés API WhatsApp/email, clé de stockage GED) sont configurés en **variables d'environnement Railway**, jamais commités dans le code.

### Distribution du client desktop (l'app Tauri) — via Google Drive
- L'app Tauri n'est **pas hébergée** au sens serveur : c'est un exécutable (`.dmg` / `.exe`) que chaque poste du bureau télécharge une fois puis exécute localement, en se connectant à l'API Railway.
- **Dossier Google Drive partagé de l'entreprise** (ex: `eXpert SARLU > Logiciel Interne > Téléchargements`) contenant :
  - `eXpert-Setup-Windows.exe`
  - `eXpert-Setup-Mac.dmg`
  - Un fichier `Version.txt` ou une note dans le dossier indiquant le numéro de version courant et les nouveautés (mini-changelog), pour que l'équipe sache si elle a la dernière version.
- **Lien de téléchargement partagé en interne** (WhatsApp, email) : le lien de partage Google Drive du dossier — chacun choisit le fichier correspondant à son OS.
- **Permissions Drive :** partager le dossier en mode "Lecteur" (pas "Éditeur") avec les comptes Google de l'équipe, pour éviter qu'un fichier soit accidentellement supprimé ou modifié.
- **Mises à jour = processus manuel** (pas d'auto-update automatique avec Google Drive, contrairement à GitHub Releases) :
  1. À chaque nouvelle version, tu remplaces les fichiers dans le dossier Drive et mets à jour `Version.txt`.
  2. L'app peut néanmoins **vérifier au démarrage** si une nouvelle version existe (appel à un petit endpoint NestJS `GET /version/latest` qui retourne le numéro de version courant) et afficher une bannière "Nouvelle version disponible, cliquez ici pour télécharger" qui ouvre le lien Drive dans le navigateur — un bon compromis simple/efficace sans mettre en place un vrai système d'auto-update.
  3. Alternative si l'équipe grandit plus tard : migrer vers GitHub Releases privé + `tauri-plugin-updater` pour un vrai auto-update silencieux — à garder en tête comme évolution possible, pas urgent aujourd'hui.

### Ce que Claude Code doit configurer concrètement
1. Le projet backend NestJS : `railway.json`/`Procfile` + variables d'environnement documentées dans un `.env.example` (jamais de valeurs réelles commitées) + un endpoint `GET /version/latest` simple pour la vérification de version.
2. Le projet frontend Tauri : `tauri.conf.json` **sans** le plugin updater automatique (puisque la distribution se fait via Google Drive) — à la place, un composant React `VersionChecker` qui interroge `GET /version/latest` au démarrage de l'app et affiche une bannière non bloquante en cas de nouvelle version disponible, avec un lien vers le dossier Drive.
3. Un script de build local (`pnpm tauri build`) documenté dans un `README.md` pour que toi (ou la personne en charge) puisse générer les deux binaires facilement à chaque nouvelle version, avant de les déposer manuellement sur Drive.

---

## 3. PROMPT FRONTEND (à copier-coller pour ton agent IA / dev)

```
Tu es un développeur Frontend Senior (10+ ans) spécialisé en applications desktop
de gestion d'entreprise (SaaS métier). Construis le client desktop de "eXpert",
un système de gestion pour un bureau de coordination médicale internationale.

### STACK OBLIGATOIRE
- Tauri 2.x (Rust backend natif + WebView) — build final en .dmg (macOS) et .exe/.msi (Windows)
- React 18 + TypeScript (strict mode)
- Vite comme bundler
- TailwindCSS + shadcn/ui pour les composants
- TanStack Query (React Query) pour tout l'état serveur / cache API
- TanStack Table pour les tableaux de dossiers (tri, filtres, pagination virtuelle)
- React Hook Form + Zod pour tous les formulaires et leur validation
- Zustand pour l'état UI global léger (sidebar, thème, session utilisateur)
- React Router v6 (mode data router)
- Recharts pour les graphiques financiers du dashboard
- date-fns pour la gestion des dates
- react-pdf ou pdfmake pour la prévisualisation des PDF générés côté backend
- i18next (prévoir FR par défaut, EN et éventuellement d'autres langues consulaires)

### IDENTITÉ VISUELLE (STRICTE)
- Couleur primaire : #144EB9 (bleu eXpert)
- Couleur secondaire/texte fort : #0A0A0A (noir)
- Fond clair : blanc / gris très clair (#F7F8FA)
- Logo fourni : wordmark "eXpert" avec un "X" stylisé façon flèche/chevron + mention "SARLU"
- Typographie : une police sans-serif géométrique et moderne (type "Inter" ou "General Sans"),
  gras marqué sur les titres pour rappeler l'épaisseur du logo
- Le design doit donner une sensation de logiciel "pro et premium" comme Linear, Notion,
  ou Attio — PAS un design de formulaire administratif daté. Priorité à :
  - Beaucoup d'espace blanc, hiérarchie typographique nette
  - Micro-interactions fluides (transitions 150-200ms, hover states, skeleton loaders)
  - Mode sombre complet en option (toggle dans les paramètres)
  - Aucune fenêtre modale bloquante superflue — préférer les panneaux latéraux (drawers)

### PRINCIPES UX NON NÉGOCIABLES
1. Palette de commandes globale (Cmd/Ctrl+K) pour naviguer vers n'importe quel dossier,
   patient ou action en 2 secondes.
2. Barre latérale de navigation par rôle : chaque utilisateur ne voit QUE les modules
   auxquels son rôle donne accès (masquage frontend en complément — jamais en remplacement —
   du contrôle serveur).
3. Vue "Dossier" façon fiche unique scrollable avec onglets : Informations | Cotation |
   Documents (GED) | Logistique | Historique/Audit | Communications.
4. Bannière visuelle immédiate si un dossier est en Lecture Seule (verrouillé), avec bouton
   "Demander une modification" qui déclenche le workflow d'autorisation vers le Super Admin.
5. Notifications temps réel (via WebSocket / Server-Sent Events exposés par NestJS) :
   toast + badge sur l'icône cloche + notification desktop native Tauri.
6. Tableaux de dossiers avec filtres sauvegardés par utilisateur (ex: "Mes dossiers en
   attente de validation"), export CSV/PDF.
7. Formulaire de cotation dynamique : recalcul instantané du total à chaque saisie
   (accompagnateurs, navettes, jours d'assurance = J×7$ si J≤30 sinon J×6,50$), avec
   décomposition ligne par ligne visible façon "facture live".
8. Kanban optionnel (vue alternative au tableau) pour visualiser le pipeline des dossiers
   par étape (Onboarding → Cotation → Validation → Logistique).
9. Dashboard d'accueil personnalisé par rôle :
   - Super Admin : vue financière globale, logs d'audit récents, alertes de dossiers bloqués
   - Assistant Manager : dossiers en attente de validation, charge de travail par agent
   - Caisse & Admin : devis en attente d'encaissement, factures du jour
   - Support Client : nouveaux leads/demandes, dossiers en cours d'onboarding
   - Protocole : navettes et rendez-vous du jour, vue "planning" type agenda mobile
10. Interface "Protocole" pensée mobile-first même sur desktop (grandes zones tactiles,
    peu de texte, actions en un clic) car ces agents utilisent aussi des tablettes/smartphones
    sur le terrain.
11. Générateur de documents : bouton "Générer PDF" avec sélecteur de template
    (synthèse dossier / fiche logistique / relevé financier) et aperçu avant téléchargement.
12. États de chargement et d'erreur soignés partout (skeletons, retry automatique via
    React Query, messages d'erreur humains et actionnables — jamais de code d'erreur brut).
13. Vue **"Corbeille"** dans la barre latérale, visible uniquement pour le Super Admin
    (et en lecture seule pour l'Assistant Manager) : liste des dossiers supprimés avec
    date/auteur de suppression, bouton "Restaurer" et bouton "Supprimer définitivement"
    (avec modale de confirmation exigeant la saisie du numéro MED-YYYY-XXXX).
14. Sur chaque fiche Dossier, un bouton "Supprimer" (accessible selon permission) ne
    déclenche jamais une perte de données réelle côté utilisateur — toujours accompagné
    d'un message clair du type "Ce dossier sera déplacé vers la corbeille et récupérable
    pendant 90 jours".
15. L'écran "Tarification" (grille de prix : accompagnateur, navette, assurance/jour,
    etc.) n'apparaît dans la navigation QUE pour le rôle Super Admin — les autres rôles
    voient le résultat des calculs dans leurs devis, jamais l'écran de configuration.

### ARCHITECTURE FRONTEND
- Structure en feature-folders : /features/dossiers, /features/cotation, /features/logistique,
  /features/facturation, /features/utilisateurs, /features/audit, /features/auth
- Couche API centralisée dans /lib/api avec client Axios/ky configuré avec intercepteur JWT
  + refresh token automatique + gestion des erreurs 401/403 (redirection login / message
  "accès refusé" selon le rôle)
- Typage partagé avec le backend via un package OpenAPI généré automatiquement
  (openapi-typescript) à partir du Swagger exposé par NestJS — zéro divergence de types
- Tests : Vitest + React Testing Library pour la logique métier (surtout le moteur de calcul
  de cotation), Playwright pour au moins 5 parcours E2E critiques (création dossier,
  validation, verrouillage, demande de déverrouillage, génération PDF)
- Gestion des permissions en frontend via un hook `usePermission('module.action')` alimenté
  par les claims du JWT, avec composant `<Can I="edit" a="dossier">...</Can>`

### LIVRABLES ATTENDUS
1. Architecture de dossiers complète du projet Tauri+React
2. Design system (tokens Tailwind config avec les couleurs de marque, composants shadcn
   personnalisés)
3. Toutes les vues listées ci-dessus, connectées à l'API NestJS (voir prompt backend)
4. Configuration Tauri complète (tauri.conf.json) prête pour build .dmg et .exe, en
   local via `pnpm tauri build` (pas de plugin auto-updater — distribution manuelle
   via Google Drive interne, voir section 2bis de ce document), avec un composant
   `VersionChecker` qui interroge `GET /version/latest` et affiche une bannière
   "nouvelle version disponible" avec lien vers le dossier Drive
5. README documentant la procédure de build local et de dépôt des binaires sur le
   dossier Google Drive partagé de l'entreprise à chaque nouvelle version
```

---

## 4. PROMPT BACKEND (NestJS)

```
Tu es un développeur Backend Senior (10+ ans) spécialisé en systèmes d'entreprise
sécurisés (RBAC strict, audit trail, verrouillage de données). Construis l'API
centrale de "eXpert", système de gestion pour un bureau de coordination médicale
internationale, consommée par un client desktop Tauri.

### STACK OBLIGATOIRE
- NestJS (dernière version stable) en TypeScript strict
- PostgreSQL comme base de données principale
- Prisma ORM (ou TypeORM si tu préfères — justifie le choix, mais Prisma est
  recommandé pour la lisibilité du schéma et les migrations)
- Passport.js + JWT (access token courte durée + refresh token en rotation,
  stocké en cookie httpOnly côté web / keychain natif côté desktop)
- CASL (@casl/ability) pour l'implémentation du RBAC fin, combiné aux Guards NestJS
- BullMQ + Redis pour les files d'attente asynchrones (envoi emails, WhatsApp,
  génération de PDF lourds, webhooks sortants)
- class-validator + class-transformer pour la validation stricte de tous les DTO
- Swagger (nestjs/swagger) pour la documentation API auto-générée (source de vérité
  pour le typage frontend)
- Winston ou Pino pour les logs applicatifs structurés (distincts de la table d'audit métier)
- Puppeteer ou un service dédié pour la génération de PDF (synthèse dossier, factures)
- WebSocket Gateway NestJS (ou SSE) pour les notifications temps réel
- Docker + docker-compose pour l'environnement de dev (postgres, redis, api)

### MODÈLE DE DONNÉES CENTRAL (Prisma schema à concevoir en détail)
Entités minimales attendues, avec leurs relations :
- User (id, nom, email, hash_password, role, actif, cree_le)
- Role (Super Admin, Assistant Manager, Support Client, Caisse & Admin, Protocole)
  avec table de permissions granulaires (Permission: module + action: create/read/update/
  delete/validate/unlock)
- Dossier (numero MED-YYYY-XXXX auto-généré séquentiellement, type_client
  [Particulier/Institution], statut [Brouillon/En cours/Validé/Facturé & Payé/Verrouillé/
  Archive_Supprime], cree_par_id, valide_par_id, verrouille (boolean), destination,
  pathologie, budget, priorite [Normale/Urgente/Critique], supprime_le (nullable),
  supprime_par_id (nullable) — **jamais de suppression physique par défaut, voir
  DossierSoftDeleteService plus bas**)
- Patient (rattaché à un Dossier, données KYC, document d'identité scanné [référence GED])
- Accompagnateur (rattaché à un Dossier, 0..n)
- Prospect (personne en phase amont, pas encore transformée en Dossier — nom, contact,
  source du contact, statut [Nouveau/En discussion/Converti/Perdu])
- Partenaire (établissements/hôpitaux/agences partenaires — nom, pays, type, contact,
  historique des dossiers envoyés)
- RendezVous (dossier_id ou patient_id, type [ambassade/hopital/navette], date_heure,
  lieu, statut, assigne_a_id)
- LigneCotation (Dossier_id, type [navette/transfert/ambulance/assurance/frais_annexe],
  description, montant, devise)
- CalculAssurance (jours J, tarif appliqué, montant total — logique J≤30 => J×7,
  J≥31 => J×6.50, à implémenter comme service métier testé unitairement)
- Facture / Devis (numero, statut, montant_total, date_encaissement, genere_par_id)
- Paiement (facture_id, montant, methode, date)
- DocumentGED (dossier_id, categorie [identite/medical/logistique/facturation],
  chemin_stockage, uploade_par_id)
- TacheLogistique (dossier_id, type [visa/navette/vol], assigne_a_id, statut, historique)
- AuditLog (immuable — jamais de UPDATE/DELETE en SQL, uniquement des INSERT — timestamp,
  user_id, action, table_cible, record_id, ancienne_valeur JSONB, nouvelle_valeur JSONB)
- DemandeDeverrouillage (dossier_id, demande_par_id, statut, traite_par_id, motif)
- Notification (user_id, type, lu, payload JSONB, cree_le)

### RÈGLES MÉTIER CRITIQUES À IMPLÉMENTER CÔTÉ SERVEUR (jamais côté client uniquement)
1. RBAC appliqué via un Guard NestJS global (`PermissionsGuard`) qui vérifie CASL
   à CHAQUE endpoint — aucune route sensible ne doit dépendre du frontend pour se protéger.
2. Verrouillage automatique : un hook Prisma (middleware) ou un intercepteur NestJS
   doit interdire toute tentative d'UPDATE sur un Dossier dont le statut est
   "Validé" ou "Facturé & Payé", sauf si l'utilisateur a le rôle Super Admin
   OU si une DemandeDeverrouillage a été explicitement approuvée pour ce dossier
   (avec expiration automatique de l'autorisation après un délai configurable).
3. Row-level locking : utiliser `SELECT ... FOR UPDATE` (transaction Prisma
   `$transaction`) sur les opérations concurrentes de modification de dossier
   pour éviter les écritures simultanées.
4. Audit trail : un Interceptor global capture automatiquement chaque
   create/update/delete/export sur les entités sensibles et écrit dans AuditLog
   AVANT de committer la transaction métier (ou dans la même transaction).
   Aucune route ne doit pouvoir contourner cet interceptor.
5. Numérotation séquentielle MED-YYYY-XXXX : générée via une séquence PostgreSQL
   dédiée par année (pas de calcul en mémoire applicative, pour éviter les
   doublons en cas de requêtes concurrentes).
6. Règle bloquante caisse : impossible de générer un document de facture officiel
   tant qu'un Paiement correspondant n'est pas enregistré et validé — à vérifier
   dans le service `FacturationService` avant toute génération de PDF.
7. Workflow de déverrouillage : endpoint `POST /dossiers/:id/demande-deverrouillage`
   → notification temps réel + email au(x) Super Admin(s) → endpoint
   `PATCH /demandes-deverrouillage/:id/approuver` réservé au rôle Super Admin
   → déverrouillage temporaire tracé dans l'AuditLog.
8. Séparation stricte des scopes : un endpoint appelé par un agent Protocole ne
   doit JAMAIS retourner de champs financiers (même filtrés côté frontend) —
   utiliser des DTO de sortie différents par rôle (`@SerializeOptions` /
   class-transformer groups).
9. **Suppression douce (soft delete) obligatoire sur Dossier :**
   - `DELETE /dossiers/:id` ne fait JAMAIS un vrai DELETE SQL — il positionne
     `statut = ARCHIVE_SUPPRIME`, `supprime_le = now()`, `supprime_par_id = user.id`,
     retire le dossier des requêtes actives par défaut (scope Prisma
     `where: { statut: { not: 'ARCHIVE_SUPPRIME' } }` appliqué globalement sauf
     sur les endpoints de corbeille), et écrit une entrée AuditLog.
   - `GET /dossiers/corbeille` (rôle Super Admin uniquement, ou lecture seule
     Assistant Manager) liste les dossiers avec `statut = ARCHIVE_SUPPRIME`.
   - `PATCH /dossiers/:id/restaurer` (Super Admin uniquement) remet le dossier
     dans son statut précédent (à conserver dans un champ `statut_avant_suppression`
     au moment du soft delete) — tracé dans l'AuditLog.
   - `DELETE /dossiers/:id/definitif` (Super Admin uniquement, avec confirmation
     du numéro de dossier dans le body de la requête) exécute le hard delete réel
     — irréversible, avec entrée AuditLog finale avant suppression physique.
   - Un CRON (BullMQ repeatable job) purge automatiquement les dossiers en
     `ARCHIVE_SUPPRIME` depuis plus de 90 jours (durée configurable via variable
     d'environnement), en notifiant le Super Admin 7 jours avant chaque purge.
10. **Module Tarification isolé :** toutes les routes de configuration des tarifs
    de base (accompagnateur, navette, ambulance, taux d'assurance/jour) vivent
    dans un `TarificationModule` séparé, protégé par un Guard dédié
    `@RequireRole('SUPER_ADMIN')`. Les autres modules (CotationModule) ne font
    que LIRE ces tarifs via un service interne, jamais les modifier directement.

### MODULES NESTJS À LIVRER
- AuthModule (login, refresh token, logout, gestion de session)
- UsersModule (CRUD utilisateurs — Super Admin uniquement)
- RolesModule / PermissionsModule (gestion de la matrice RBAC, configurable sans redeploiement)
- DossiersModule (CRUD + machine à états du workflow séquentiel)
- CotationModule (moteur de calcul, versions de devis)
- FacturationModule (devis, factures, paiements, règle bloquante caisse)
- LogistiqueModule (tâches visa/navette/vol, assignation d'agents)
- GedModule (upload/stockage sécurisé de documents — S3-compatible ou stockage local
  chiffré selon l'infra cible)
- NotificationsModule (WebSocket Gateway + email + WhatsApp Business API)
- WebhooksModule (endpoints sortants configurables pour n8n, avec signature HMAC
  des payloads pour sécuriser les intégrations externes)
- AuditModule (lecture des logs, filtres, export)
- PdfModule (génération des 3 types de documents demandés)
- HealthModule (endpoint /health pour monitoring)

### SÉCURITÉ & QUALITÉ
- Helmet, rate limiting (@nestjs/throttler), CORS strict configuré pour l'origine
  du client Tauri (tauri://localhost + le domaine web si une version web existe)
- Toutes les entrées validées par DTO + class-validator, jamais de SQL brut sans
  paramétrage
- Hashing des mots de passe avec argon2 (pas bcrypt)
- Tests unitaires (Jest) sur tous les services métier critiques, en particulier
  CotationService (calcul assurance, navettes) et le Guard de verrouillage
- Tests d'intégration (Jest + Supertest) sur les scénarios RBAC (un agent Protocole
  qui essaie d'accéder à un endpoint financier doit recevoir 403)
- Migrations Prisma versionnées, seed de données de démonstration réalistes
- Documentation Swagger complète, exportable en JSON pour la génération de types frontend

### LIVRABLES ATTENDUS
1. Schéma Prisma complet et commenté
2. Arborescence complète des modules NestJS
3. Implémentation du Guard RBAC + de l'Interceptor d'audit trail (code complet, pas
   de pseudo-code)
4. Implémentation du service de verrouillage/déverrouillage avec transactions
5. Configuration Docker Compose (postgres, redis, api, adminer) pour l'environnement
   de développement local, + fichiers de déploiement Railway (`railway.json` ou
   configuration équivalente, `.env.example` documenté sans valeurs réelles)
6. Collection Postman ou fichier .http de tous les endpoints avec exemples
```

---

## 5. Branding — éléments à transmettre à ton designer UI/UX

- **Bleu principal :** `#144EB9`
- **Noir texte/contraste :** `#0A0A0A`
- **Suggestion de palette étendue** (à valider avec ton designer) :
  - Bleu clair d'accent/hover : `#3D6FE0`
  - Fond neutre clair : `#F7F8FA`
  - Succès : `#16A34A` · Attention : `#F59E0B` · Erreur : `#DC2626` (garder ces trois neutres pour ne pas entrer en conflit avec le bleu de marque)
- Le logo utilise un tracé de "X" en diagonale façon flèche — un designer peut s'en inspirer pour l'iconographie interne (icônes de statut, loader animé au démarrage de l'app desktop, splash screen).
- Prévoir 3 déclinaisons du logo déjà fournies (noir sur blanc, bleu sur blanc, blanc sur bleu) pour couvrir mode clair, mode sombre et écrans de chargement.

---

## 6. Prochaines étapes suggérées

1. Valider ce dossier avec ton équipe (Nathan, Ketsia, Emmanuelle, Jephté, Grace) pour confirmer que le workflow séquentiel colle à leur réalité terrain.
2. Faire chiffrer/estimer le développement par un designer UI/UX + une équipe dev sur base de ces deux prompts.
3. Prioriser un MVP : Dossiers + Cotation + Validation + RBAC de base, avant les modules WhatsApp/webhooks n8n qui peuvent venir en V2.

