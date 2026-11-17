# Sauvegarde hors du PC (Google Drive, chiffrée)

La sauvegarde quotidienne vit sur ce PC et sur le disque externe : un vol, un
incendie ou une inondation peuvent emporter les deux. Chaque nuit, GitHub fait
donc une **copie complète** de la production, la **chiffre**, puis la range dans
**Google Drive**. Le jour où le PC n'est plus là, on récupère la copie dans Drive
depuis n'importe quel ordinateur et on remonte l'école
([remontage.md](remontage.md)).

```
Supabase (production) ── base + fichiers ──▶ GitHub (machine jetable, 01 h 41)
                                               │ chiffre avec la clé PUBLIQUE
                                               ▼
                                Google Drive : EduGest-sauvegardes/
                                  sauvegardes/backup-<date>/   (90 jours)
                                  fichiers/…                   (miroir, gardé)
```

- **Chiffrée avant de partir.** Google, GitHub, ou quelqu'un qui entrerait dans
  le compte Drive ne voient que du bruit. Seule une **clé privée** ouvre les
  copies, et elle ne se trouve que chez ses détenteurs.
- **Rien ne reste sur GitHub** : ni artefact, ni cache. Le dépôt est public,
  donc son journal aussi ; on n'y écrit que des tailles et des nombres de
  fichiers.
- **Complète** : données, comptes **avec leurs mots de passe**, vocaux et pièces
  jointes de la messagerie. C'est la même copie que `base/donnees.sql`.
- La copie locale (PC et disque externe) continue comme avant, sans lien avec
  celle de Drive.

## Mise en place (une seule fois)

### 1. La clé

```bash
node scripts/cle-sauvegarde.mjs
```

La commande crée `C:\Users\ADMIN\edugest-cle-sauvegardes\CLE-PRIVEE-SAUVEGARDES.txt`
et ajoute la clé publique à `supabase/cles-sauvegarde.txt`. La clé privée n'est
jamais affichée, et une clé existante n'est jamais écrasée. La « clé
principale » a été créée le 2026-11-17.

**Ranger la clé privée à trois endroits :**

1. **gestionnaire de mots de passe** : y coller tout le contenu du fichier ;
2. **papier** : recopier les 4 lignes du bas du fichier et les ranger en lieu
   sûr (coffre, enveloppe scellée) ;
3. **disque externe** : y copier le fichier.

Après chaque recopie retapée, vérifier qu'elle est juste :

```bash
node scripts/cle-sauvegarde.mjs --verifier <fichier de la recopie>
```

**Jamais** par WhatsApp ou par e-mail, jamais dans Drive ni sur GitHub, jamais en
photo dans un téléphone synchronisé.

- Clé **perdue** : les copies de Drive sont illisibles pour toujours. Google
  lui-même ne peut pas les ouvrir.
- Clé **volée** : quelqu'un qui aurait aussi accès au Drive pourrait lire les
  copies. Dans ce cas, créer une nouvelle clé, retirer la ligne de l'ancienne
  dans `supabase/cles-sauvegarde.txt`, puis supprimer de Drive les copies faites
  avec l'ancienne.

### 2. L'accès à Google Drive (jeton rclone)

1. Sur https://rclone.org/downloads/, prendre **Windows, Intel/AMD 64 Bit** et
   extraire le `.zip`, par exemple dans `C:\Users\ADMIN\outils\rclone`.
2. Ouvrir PowerShell dans ce dossier et lancer :

   ```powershell
   .\rclone.exe config create edugest drive scope=drive.file
   ```

   Le navigateur s'ouvre. Se connecter au **compte Google qui gardera les
   copies**, puis accepter. Si rclone pose des questions, garder la réponse par
   défaut (Entrée).
3. Lancer `.\rclone.exe config show edugest` et copier ce qui suit
   `token = ` : tout le texte de `{` à `}`.

La portée `drive.file` limite l'accès : rclone ne voit et ne touche que ce qu'il
a créé lui-même, jamais le reste du Drive.

### 3. Les secrets GitHub

Sur GitHub, ouvrir le dépôt, puis **Settings → Environments → production →
Add environment secret** :

| Nom | Valeur |
|---|---|
| `RCLONE_DRIVE_TOKEN` | le jeton copié à l'étape 2 |
| `SUPABASE_SERVICE_ROLE` | la clé *service_role*, la même que `serviceRole` dans `supabase/config.local.mjs` (ou tableau de bord Supabase → Project Settings → API Keys) |

`SUPABASE_DB_URL` s'y trouve déjà.

### 4. Ne pas créer le dossier dans Drive

Le workflow crée lui-même le dossier `EduGest-sauvegardes`. Avec la portée
`drive.file`, il ne verrait pas un dossier créé à la main.

### 5. Premier lancement

Sur GitHub : **Actions → « Sauvegarde hors du PC » → Run workflow**. Une coche
verte signifie que la copie est arrivée dans Drive et qu'elle a été relue
(mêmes empreintes MD5). Le premier lancement envoie tous les fichiers de la
messagerie (environ 65 Mo) ; les suivants n'envoient que les nouveaux.

## Au quotidien

- La copie se fait **chaque nuit à 01 h 41** (heure de Conakry). En cas
  d'échec, GitHub envoie un e-mail.
- **Place occupée** : environ 2 Mo par jour pour la base, plus les nouveaux
  fichiers. Les copies sont gardées 90 jours, puis passent par la corbeille de
  Drive (30 jours). Cela fait moins de 1 Go aujourd'hui, et les 15 Go gratuits
  de Google suffisent.
- **Disque externe** : la tâche planifiée du PC (`lancer-sauvegarde.cmd`)
  recopie `C:\Users\ADMIN\edugest-backups` sur `H:\edugest-backups` dès que le
  disque est branché. Sinon, elle le note dans son journal et continue. Le
  laisser branché, sous la lettre **H:**.

### Ce qui peut l'arrêter

| Cause | Signe | Remède |
|---|---|---|
| Accès rclone retiré du compte Google | e-mail d'échec ; étape « Inventaire de Drive » en rouge | refaire l'étape 2, remplacer `RCLONE_DRIVE_TOKEN` |
| Mot de passe de la base changé | étape « Copie chiffrée » en rouge | mettre à jour `SUPABASE_DB_URL` |
| Clé *service_role* changée | « fichier(s) déposé(s) illisible(s) » | mettre à jour `SUPABASE_SERVICE_ROLE` |
| 60 jours sans activité dans le dépôt | GitHub suspend les tâches planifiées (avec un e-mail avant) | Actions → « Sauvegarde hors du PC » → **Enable workflow** |
| Drive plein | étape « Envoi dans Google Drive » en rouge | libérer de la place |

## Rouvrir une copie (le jour où le PC n'est plus là)

1. Sur n'importe quel ordinateur : installer Node 22, récupérer ce dépôt
   (`git clone`) et installer Docker Desktop (voir [remontage.md](remontage.md)).
2. Dans Google Drive, faire clic droit sur `EduGest-sauvegardes` →
   **Télécharger**, puis extraire le `.zip`. Si Drive découpe le
   téléchargement en plusieurs `.zip`, les extraire tous au même endroit.
3. Mettre la clé privée dans un fichier texte (retapée depuis le papier si
   besoin) et la vérifier :
   `node scripts/cle-sauvegarde.mjs --verifier cle.txt`
4. Rouvrir la copie :

   ```bash
   node scripts/dechiffrer-sauvegarde.mjs <dossier extrait> --cle cle.txt
   ```

   La commande prend la copie la plus récente. Pour une plus ancienne, ajouter
   `--sauvegarde backup-<date>`. Le script contrôle le nombre de lignes de
   chaque table, puis affiche la commande de remontage.
5. Lancer `node scripts/remonter-edugest.mjs --sauvegarde <…>`, puis suivre
   [remontage.md](remontage.md).

## Un suppléant

```bash
node scripts/cle-sauvegarde.mjs --libelle "suppléant" --dossier <dossier de sa clé>
```

Ensuite : PR, fusion, puis remettre le fichier au suppléant. Il peut ouvrir les
copies faites **à partir de ce moment**. Chacun garde sa propre clé, et aucune
n'a besoin de l'autre.

## Exercice

Chaque trimestre, avec l'exercice de remontage : télécharger la dernière copie
de Drive, la rouvrir, la remonter, puis noter le résultat ici.

| Date | Copie | Résultat |
|---|---|---|
| 2026-11-17 | essai local, sans Drive, clé jetable | Copie chiffrée en 364 s sur la connexion du PC (base 1,6 Mo, 662 fichiers, 65 Mo), rouverte en 2 s. Une autre clé est refusée. Remontage en **110 s** : 87 tables identiques, 183 comptes, 662 fichiers sur 662, identiques octet par octet au miroir local. |

## Pour un informaticien

- Chiffrement : X25519, HKDF-SHA256 et AES-256-GCM (`node:crypto`, aucune
  dépendance). Le format est décrit en tête de `supabase/chiffrage-sauvegarde.mjs`.
- Chaque fichier reçoit une clé de données aléatoire, enveloppée pour chaque
  détenteur. Un fichier altéré ou tronqué est refusé.
- Ce que Google voit : les tailles, les dates et les noms des fichiers de la
  messagerie (des identifiants), jamais le contenu.
- La tâche GitHub n'installe aucun paquet npm : à côté des secrets de la
  production ne tourne que le code du dépôt.
