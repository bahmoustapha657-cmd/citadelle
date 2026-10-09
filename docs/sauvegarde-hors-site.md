# Sauvegarde hors site (Cloudflare R2)

Chaque nuit à 02:17 (heure de Conakry), le workflow **« Sauvegarde hors
site »** :

1. sauvegarde la base de production : rôles, schéma, et **toutes les
   données**, comptes et mots de passe (hachés) compris ;
2. y ajoute les **fichiers** : photos d'élèves, logos, signatures, documents
   et vocaux de la messagerie ;
3. chiffre le tout (AES-256) avec une phrase de passe que seule la direction
   détient hors ligne ;
4. le dépose dans **Cloudflare R2**, loin du poste qui fait les sauvegardes
   locales ;
5. **restaure** cette sauvegarde dans une base jetable et compare chaque
   table, ligne pour ligne. Une sauvegarde jamais restaurée ne prouve rien.

Un échec, à n'importe quelle étape, envoie un e-mail (notifications GitHub
Actions). Le résumé du run donne la taille de l'archive, le nombre de tables
et de lignes, le nombre de fichiers et le résultat de la restauration.

Les sauvegardes locales (`supabase/backup-donnees.mjs`) continuent : elles
sont la copie rapide sur place, celle-ci est la copie qui survit au poste.

## Mise en place (une seule fois)

### 1. Le bucket R2

Tableau de bord Cloudflare → **R2** → **Create bucket** :

- nom : `edugest-sauvegardes` ;
- emplacement : *Automatic* (ou *Western Europe*).

Dans le bucket → **Settings** → **Object lifecycle rules**, deux règles :

| Nom | Préfixe | Action |
|---|---|---|
| quotidien | `quotidien/` | supprimer après **35 jours** |
| mensuel | `mensuel/` | supprimer après **400 jours** |

On garde ainsi une sauvegarde par nuit sur cinq semaines, et celle du 1er de
chaque mois pendant plus d'un an.

Recommandé, si l'option **Bucket lock rules** est proposée : une règle sur
tout le bucket, 30 jours. Même avec un jeton volé, personne ne peut alors
effacer les sauvegardes récentes.

### 2. Le jeton d'accès R2

R2 → **Manage R2 API Tokens** → **Create API token** :

- permission : **Object Read & Write** ;
- **Apply to specific buckets only** → `edugest-sauvegardes` ;
- durée : sans expiration.

Copier **Access Key ID** et **Secret Access Key**. Ils ne s'affichent
qu'une fois.

### 3. La phrase de passe

Elle chiffre les sauvegardes. **Sans elle, aucune sauvegarde ne pourra
jamais être relue**, ni par un voleur, ni par nous.

- 32 caractères aléatoires au moins : un gestionnaire de mots de passe, ou
  dans Git Bash : `openssl rand -base64 32`.
- La noter à **deux endroits hors de l'ordinateur** : gestionnaire de mots
  de passe et papier rangé en lieu sûr.

### 4. La clé service_role de Supabase

Elle permet de lire les fichiers des buckets privés (messagerie).
Supabase → **Project Settings** → **API Keys** → `service_role` → copier.

### 5. Les secrets GitHub

GitHub → dépôt → **Settings** → **Environments** → **production** →
**Add environment secret**, quatre fois :

| Secret | Valeur |
|---|---|
| `R2_ACCESS_KEY_ID` | Access Key ID (étape 2) |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key (étape 2) |
| `SAUVEGARDE_PHRASE` | la phrase de passe (étape 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role (étape 4) |

`CLOUDFLARE_ACCOUNT_ID` et `SUPABASE_DB_URL` y sont déjà (déploiement).

## Vérifier

Actions → **Sauvegarde hors site** : chaque run vert = une sauvegarde
déposée **et** restaurée avec succès. Pour un essai immédiat :
**Run workflow**.

## Restaurer

À faire depuis un poste avec Git Bash, Node et le dépôt.

**1. Récupérer l'archive** : R2 → `edugest-sauvegardes` → `quotidien/` (ou
`mensuel/`) → l'archive voulue → **Download**.

**2. La déchiffrer** (Git Bash, la phrase de passe est demandée) :

```bash
gpg -d edugest-AAAA-MM-JJ.tar.gz.gpg > sauvegarde.tar.gz
```

```bash
tar -xzf sauvegarde.tar.gz
```

Le dossier `edugest-AAAA-MM-JJ/` contient `roles.sql`, `schema.sql`,
`data.sql`, `lignes.tsv` (lignes par table) et `stockage/` (les fichiers).

**3. Le schéma** : dans le nouveau projet Supabase (ou la base à remettre
d'aplomb), appliquer les migrations du dépôt :

```bash
npx supabase db push --db-url "<URL de la base cible>"
```

**4. Les données** (la procédure testée chaque nuit par la CI) :

```bash
bash scripts/restaurer-base.sh edugest-AAAA-MM-JJ "<URL de la base cible>"
```

Résultat attendu : `0 écart(s) dont 0 dans public`.

**5. Les fichiers** :

```bash
SUPABASE_URL="<URL du projet>" SUPABASE_SERVICE_ROLE_KEY="<clé>" node scripts/restaurer-stockage.mjs edugest-AAAA-MM-JJ/stockage
```

**6. Remettre le service en route** sur un NOUVEAU projet :

- Edge Functions et leurs secrets ;
- connexion PowerSync, cf. [surveillance-synchro.md](surveillance-synchro.md) ;
- URL et clé dans `.env.supabase`, puis déploiement.

Les comptes gardent leurs mots de passe, restaurés avec `auth.users`.

## Ce que ce workflow ne couvre pas

- Une **restauration à la minute près** (PITR) : il faut l'option payante
  de Supabase. Au pire, on perd la journée depuis 02:17.
- La **configuration** : secrets des Edge Functions, réglages Auth et
  PowerSync. Elle se trouve dans les tableaux de bord et dans ce dépôt.
