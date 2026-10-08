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
| Username | `postgres` |
| Password | le mot de passe de la base, **en clair**, collé |
| SSL | `verify-full` |

**Test Connection** → **Save Connection**. Si le slot a été perdu : éditeur
**Sync Rules** → **Validate** → **Deploy** (règles inchangées) : nouveau slot
et recopie des données en quelques minutes.

## Le mot de passe de la base sert à DEUX endroits

1. PowerSync (en clair, connexion directe) ;
2. le secret GitHub `SUPABASE_DB_URL` (adresse *pooler*, mot de passe encodé
   s'il contient des caractères spéciaux).

Le changer à un endroit sans l'autre casse la synchro (incident du
2026-10-08). Diagnostic détaillé : Actions → **Schéma production** →
action `diagnostic-synchro`.
