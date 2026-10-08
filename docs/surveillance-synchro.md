# Surveillance de la synchro hors ligne (PowerSync)

Le workflow **Surveillance synchro** vérifie toutes les 15 minutes, en
lecture seule, que PowerSync lit bien la base de production. Tant que tout va
bien, il est silencieux. S'il échoue, GitHub vous envoie un **e-mail**.

À vérifier une fois : GitHub → Settings (de votre compte) → Notifications →
**Actions** → « Notify me for failed workflows only », par e-mail.

## Ce que signifie une alerte

| Message | Cause probable | Que faire |
|---|---|---|
| **PowerSync est DÉCONNECTÉ de la base** | mot de passe de la base changé, panne PowerSync | dashboard PowerSync → Issues ; corriger la connexion (ci-dessous) |
| **PowerSync prend du retard : N Mo** | PowerSync ralenti ou bloqué | dashboard PowerSync → Issues / Logs ; à 512 Mo le slot est perdu |
| **Slot en état « lost » / « unreserved »** | la base abandonne le slot | réparer la connexion PUIS redéployer les Sync Rules |
| **Aucun slot PowerSync** | règles jamais redéployées après une perte | redéployer les Sync Rules |
| **Connexion à la base impossible** | le secret GitHub `SUPABASE_DB_URL` a un ancien mot de passe | mettre à jour le secret |

## Réparer la connexion PowerSync

PowerSync Dashboard → instance → **Source Database Connection** (crayon) :

| Champ | Valeur |
|---|---|
| Host | `db.pfzanslrcowkjjipuzpa.supabase.co` (connexion **directe** — jamais le *pooler* `aws-…pooler.supabase.com` : la réplication ne passe pas par lui) |
| Port | `5432` |
| Database | `postgres` |
| Username | `powersync_role` |
| Password | le mot de passe **de powersync_role** (gestionnaire de mots de passe : « PowerSync – powersync_role »), **en clair**, collé |
| SSL | `verify-full` |

**Test Connection** → **Save Connection**. Si le slot a été perdu : éditeur
**Sync Rules** → **Validate** → **Deploy** (règles inchangées) : nouveau slot
et recopie des données en quelques minutes.

## Deux comptes, deux mots de passe

Depuis le 2026-10-08 (après l'incident du même jour), PowerSync a **son
propre compte** :

| Compte | Utilisé par | Changer son mot de passe |
|---|---|---|
| `powersync_role` (`LOGIN`, `REPLICATION`, `BYPASSRLS`, lecture seule des tables synchronisées) | PowerSync uniquement | SQL Editor : `alter role powersync_role with password '…';` puis le reporter dans PowerSync (ci-dessus). Supprimer la requête de l'historique de l'éditeur. |
| `postgres` (propriétaire du schéma) | secret GitHub `SUPABASE_DB_URL` (migrations, dump, diagnostics, cette surveillance) | Supabase → Settings → Database → Reset ; puis mettre à jour le secret (adresse *pooler*, mot de passe encodé s'il contient des caractères spéciaux). **Sans effet sur PowerSync.** |

Avant le 2026-10-08, PowerSync se connectait en `postgres` : réinitialiser ce
mot de passe l'a déconnecté sans prévenir, et le slot a été perdu un peu plus d'une
heure plus tard. Diagnostic détaillé : Actions → **Schéma production** →
action `diagnostic-synchro` (la colonne `usename` des connexions de
réplication doit afficher `powersync_role`).
