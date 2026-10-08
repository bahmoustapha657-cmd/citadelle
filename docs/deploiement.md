# Mise en production d'EduGest

Le front (build Supabase) est servi par **Cloudflare Pages**, projet
`edugest-gn` → https://edugest-gn.pages.dev. Il se déploie **depuis GitHub
Actions**, jamais depuis un poste.

## Déployer

1. GitHub → onglet **Actions** → workflow **CI** → **Run workflow** → branche
   **master** → Run.
2. Le workflow refait lint + tests + builds sur un checkout propre de master
   et rejoue les migrations sur une base vierge ;
3. puis `migrations-production` applique à la production les migrations SQL
   en attente (cf. [migrations-sql.md](migrations-sql.md)) ;
4. puis `deploy-production` publie ce bundle exact et vérifie que
   `version.json` en ligne affiche bien le commit déployé.

Le run échoue (et rien n'est publié) si un test ou une migration casse. Un
run lancé sur une autre branche que master ne déploie rien. Plus aucun
script SQL à coller à la main avant de déployer.

## Savoir ce qui est en ligne

- https://edugest-gn.pages.dev/version.json → `commit`, `date`, `propre`.
- Dans l'app : `v xxxxxxx` en bas de la barre latérale (version réellement
  chargée par CET appareil — une PWA pas encore mise à jour affiche l'ancienne).
- Console du navigateur : `[EduGest] version …`.

`propre: false` / suffixe `+modifs` = build fait avec des fichiers non
commités : ne doit jamais apparaître en production.

## Revenir en arrière

Actions → ouvrir le run de déploiement précédent (le dernier bon) →
**Re-run all jobs** : il redéploie son propre commit (bundle reconstruit et
retesté). Plus rapide en urgence : tableau de bord Cloudflare Pages →
`edugest-gn` → Deployments → ancien déploiement → *Rollback*.

## Secours (GitHub indisponible)

```bash
npm run deploy:pages
```

Refuse de partir si l'on n'est pas sur `master`, s'il reste des fichiers
modifiés (hors `.claude/`) ou si `master` ≠ `origin/master`. Nécessite
`npx wrangler login`.

## Configuration (une seule fois)

Dans GitHub → Settings → Environments → `production` (créé au premier run) :

| Secret | Valeur |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Jeton Cloudflare (My Profile → API Tokens → Create Token → modèle personnalisé, permission **Account · Cloudflare Pages · Edit**, limité au compte EduGest) |
| `CLOUDFLARE_ACCOUNT_ID` | Identifiant du compte Cloudflare (colonne de droite du tableau de bord) |

Facultatif : dans cet environnement, ajouter *Required reviewers* (vous-même)
pour qu'un clic d'approbation soit demandé avant chaque mise en ligne.

## Variables du build

Le build de production ne lit que `.env.supabase` (commité ; tout y est
public par nature). Les `.env` / `.env.local` d'un poste ne sont PAS vus par
la CI : toute nouvelle variable `VITE_*` nécessaire en production va dans
`.env.supabase`.
