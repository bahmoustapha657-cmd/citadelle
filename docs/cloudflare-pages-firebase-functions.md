# Migration Cloudflare Pages + Firebase Functions

Ce projet peut etre separe proprement en deux blocs :

1. Frontend React/Vite deploye sur Cloudflare Pages
2. API HTTP deployee sur Firebase Functions

## 1. Variables d'environnement

### Cloudflare Pages

Configurer au minimum :

- `VITE_API_BASE_URL=https://<region>-<project-id>.cloudfunctions.net/api`
- `VITE_KKIAPAY_PUBLIC_KEY=...`
- `VITE_VAPID_PUBLIC_KEY=...`
- `VITE_SENTRY_DSN=` si besoin
- `NODE_VERSION=20`

### Firebase Functions

Configurer au minimum :

- `ALLOWED_ORIGIN=https://<ton-domaine-pages>`
- `FIREBASE_SERVICE_ACCOUNT=...`
- `SUPERADMIN_PASSWORD_HASH=...`
- `KKIAPAY_PRIVATE_KEY=...`
- `VAPID_PRIVATE_KEY=...`
- `ANTHROPIC_API_KEY=...` si l'assistant superadmin reste actif
- `APP_FUNCTION_REGION=europe-west1` ou la region cible

## 2. Frontend Cloudflare Pages

Parametres recommandes :

- Build command : `npm run build`
- Build output directory : `dist`
- Root directory : `/`
- Node.js version : `20`

Le frontend n'utilise plus les routes relatives `/api/...` en dur.
Toutes les requetes passent maintenant par `VITE_API_BASE_URL` via `C:\Users\ADMIN\citadelle\src\apiClient.js`.

## 3. Backend Firebase Functions

Le routeur HTTP central est dans :

- `C:\Users\ADMIN\citadelle\functions\index.js`

Il expose une seule fonction HTTP `api` et route ensuite vers :

- `/login`
- `/superadmin-login`
- `/inscription`
- `/account-manage`
- `/parent-portal`
- `/teacher-portal`
- `/school-lifecycle`
- `/ecole-public-sync`
- `/push`
- `/transfert`
- `/ia`
- `/kkiapay-webhook`

Exemple d'URL finale :

`https://europe-west1-citadelle-school.cloudfunctions.net/api/login`

## 4. Firebase config

Le projet est prepare pour deployer les fonctions depuis la racine via :

- `C:\Users\ADMIN\citadelle\firebase.json`
- `C:\Users\ADMIN\citadelle\.firebaserc`
- `C:\Users\ADMIN\citadelle\package.json`

Le point d'entree Functions est :

- `C:\Users\ADMIN\citadelle\functions\index.js`

## 5. Ordre de bascule conseille

1. Authentifier Firebase : `firebase login`
2. Verifier le projet actif : `firebase use citadelle-school`
3. Deployer les Firebase Functions : `npm run deploy:functions`
4. Tester une route simple : `/login`
5. Configurer `VITE_API_BASE_URL` dans Cloudflare Pages
6. Deployer le frontend sur Cloudflare Pages
7. Verifier :
   - connexion admin
   - inscription ecole
   - portail parent
   - portail enseignant
   - webhook Kkiapay

## 6. Checklist de bascule

Avant de pointer le frontend vers Cloudflare Pages, verifier :

- `ALLOWED_ORIGIN` = URL finale Cloudflare Pages
- `APP_FUNCTION_REGION` = meme region que l'URL Functions
- `FIREBASE_SERVICE_ACCOUNT` present
- `SUPERADMIN_PASSWORD_HASH` present
- `KKIAPAY_PRIVATE_KEY` present
- `VAPID_PRIVATE_KEY` present
- `VITE_API_BASE_URL` = URL finale Firebase Functions

## 7. Retour arriere

Si besoin, il suffit de vider `VITE_API_BASE_URL`.
Le frontend reviendra automatiquement sur le mode actuel `same-origin /api/...`.
