# Remonter EduGest ailleurs (plan de secours)

Si Supabase, PowerSync ou Cloudflare disparaissent, coupent le compte ou sont
injoignables longtemps, l'école doit pouvoir repartir sur **une machine à
nous**, à partir de la dernière sauvegarde, **sans que personne ne perde son
mot de passe**. Cette page dit comment. Elle sert aussi à l'exercice
chronométré, à refaire régulièrement.

## 1. Ce que contient une sauvegarde

`node supabase/backup-donnees.mjs` (tâche planifiée « EduGest-Sauvegarde »,
chaque jour) écrit dans `C:\Users\ADMIN\edugest-backups\backup-<date>\` :

| Fichier | Contenu | Sert à |
|---|---|---|
| `<table>.json` | chaque table, lue par l'API | lecture rapide, contrôle |
| `_auth_users.json` | la liste des comptes, **sans** mot de passe | contrôle |
| `base/donnees.sql` | **copie complète** (pg_dump) : données, comptes **et mots de passe hachés**, métadonnées des fichiers | le remontage |
| `base/schema-public.sql` | schéma de la production | comparaison avec les migrations |
| `../fichiers/` | vocaux et pièces jointes de la messagerie (miroir commun) | le remontage |

`node supabase/verifier-sauvegardes.mjs` indique si la dernière sauvegarde a
sa **copie complète**.

Chaque table créée par une migration doit figurer dans
`supabase/sauvegarde-tables.mjs`, sinon `npm test` échoue : c'est ainsi qu'on
avait découvert dix tables oubliées (paiements Mobile Money, présences du
personnel, transferts…).

### Mettre en place la copie complète (une seule fois)

1. **Outils PostgreSQL** : la version portable de PostgreSQL 17 (EnterpriseDB,
   « Windows x64 binaries »), décompressée dans `C:\Users\ADMIN\outils\pgsql`
   (on doit y trouver `bin\pg_dump.exe`). Un autre dossier se déclare avec
   `pgBin` dans `supabase/config.local.mjs`.
2. **Adresse de la base** : tableau de bord Supabase → **Connect** →
   **Session pooler** (IPv4), copier l'URI, y remplacer `[YOUR-PASSWORD]` par
   le mot de passe de la base, et l'ajouter **soi-même** à
   `supabase/config.local.mjs` (jamais dans git) :

   ```js
   export default {
     // … url, anonKey, serviceRole déjà présents …
     dbUrl: "postgresql://postgres.<projet>:<mot de passe>@aws-0-<région>.pooler.supabase.com:5432/postgres",
   };
   ```

   Ne pas prendre la connexion « Direct » : elle passe par IPv6, que la
   plupart des connexions ne proposent pas.
3. Lancer `node supabase/backup-donnees.mjs` : la ligne
   `✅ base complète … Mo (mots de passe compris)` doit apparaître.

## 2. Remonter l'école

Sur la machine de secours (ce PC, ou plus tard le serveur de l'école) :
**Docker Desktop démarré**, Node 22, ce dépôt **à jour** (`git pull`), puis :

```
node scripts/remonter-edugest.mjs
```

Le script prend la dernière sauvegarde complète (ou celle passée par
`--sauvegarde <dossier>`), puis enchaîne en chronométrant chaque étape :

1. **Supabase local** : base vierge, schéma rebâti par les migrations du dépôt
   (la même pile que les tests e2e de la CI). ⚠️ La base Supabase *locale* de
   la machine est remise à zéro (jamais la production).
2. **Versement des données** en une seule transaction : tout passe, ou rien.
3. **Contrôle ligne à ligne** : chaque table doit avoir exactement le nombre
   de lignes de la copie, sinon le script s'arrête et le dit.
4. **Fichiers de la messagerie**, remis depuis le miroir.
5. **PowerSync** (mode hors ligne), même version que la production
   (`--sans-powersync` pour s'en passer).
6. **L'application**, construite pour cette pile et servie sur
   **http://127.0.0.1:4173** (`--sans-application` pour s'arrêter avant).

Puis on se connecte avec un **vrai compte** de l'école : le mot de passe
habituel doit marcher. Le rapport (durée de chaque étape) est écrit dans
`C:\Users\ADMIN\edugest-backups\remontages\`.

La première fois, Docker télécharge les images de Supabase et de PowerSync
(plusieurs Go) : prévoir du temps et du réseau. Les fois suivantes, tout est
déjà sur la machine, **et le remontage ne demande plus Internet**.

## 3. Ce qui ne remonte pas

- Ce qui dépend d'un service extérieur : SMS et WhatsApp, paiement Mobile
  Money, notifications push, IA, appels via le relais TURN. Les fonctions
  Edge tournent, mais sans leurs secrets (`supabase/functions/.env`).
- L'accès depuis d'autres appareils : la pile écoute sur `127.0.0.1`. Pour
  servir toute l'école par le Wi-Fi, il faudra un nom de domaine et un
  certificat HTTPS (étape 2 du plan : le serveur dans l'école).

## 4. Exercice chronométré

À refaire **chaque trimestre** et après tout gros changement du schéma :

1. `node supabase/backup-donnees.mjs`, puis vérifier la ligne « base complète » ;
2. `node scripts/remonter-edugest.mjs` ;
3. se connecter sur http://127.0.0.1:4173 avec un vrai compte, ouvrir les
   élèves, une fiche de caisse, un bulletin ;
4. noter la durée totale du rapport ici.

| Date | Sauvegarde | Durée | Remarques |
|---|---|---|---|
| | | | |
