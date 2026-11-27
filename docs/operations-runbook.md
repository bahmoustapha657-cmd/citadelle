# Runbook exploitation et incidents

Objectif : exploiter EduGest sans improviser en cas d'incident.

Architecture : front React servi par **Cloudflare Pages** (edugest-gn),
données et comptes sur **Supabase** (Postgres + RLS, Auth, Storage, Edge
Functions), mode hors ligne par **PowerSync** (miroir SQLite sur l'appareil).
Plus de Firebase ni de Vercel (cf. [retrait-firebase.md](retrait-firebase.md)).

## Garanties actuelles

- CI GitHub (bloquante pour tout déploiement) : lint, tests unitaires,
  typecheck, build, migrations SQL rejouées sur une base vierge, tests de
  bout en bout en ligne ET hors ligne ([tests-e2e.md](tests-e2e.md)).
- Déploiement uniquement depuis la CI : migrations puis front, puis
  vérification de `version.json` ([deploiement.md](deploiement.md)).
- Surveillance de la synchro hors ligne toutes les 15 min, e-mail en cas
  d'alerte ([surveillance-synchro.md](surveillance-synchro.md)).
- Écritures refusées par la base jamais silencieuses
  ([ecritures-sans-effet.md](ecritures-sans-effet.md)).
- Erreurs du navigateur remontées à Sentry si `VITE_SENTRY_DSN` est posé.

## Vérification quotidienne

- La dernière CI est verte ; la « Surveillance synchro » aussi.
- https://edugest-gn.pages.dev/version.json affiche le commit attendu.
- Au moins une connexion fonctionne.

## Incident connexion

Symptômes : impossible de se connecter, déconnexions, « session invalide ».

1. Tableau de bord Supabase → Auth : service disponible, compte présent et
   non bloqué (`comptes.statut`).
2. Edge Functions (`inscription`, `account-manage`, `password-reset`) :
   journaux d'erreurs.
3. Derniers déploiements : un retour arrière règle-t-il le problème ?

## Incident synchro hors ligne

Symptômes : synchro bloquée à 99 %, données qui ne remontent plus.
Suivre [surveillance-synchro.md](surveillance-synchro.md) (connexion
PowerSync, slot de réplication, compte `powersync_role`).

## Incident sécurité

Symptômes : suspicion d'escalade de privilèges, accès à une autre école,
compte modifié de façon inattendue.

1. Geler les déploiements.
2. Identifier les comptes concernés (table `comptes`, `historique`).
3. Bloquer les comptes concernés et changer leurs mots de passe.
4. Corriger par une migration SQL, puis redéployer seulement avec CI verte.

## Retour arrière

Cf. [deploiement.md](deploiement.md#revenir-en-arrière) : relancer le run
de déploiement du dernier bon commit, ou *Rollback* dans Cloudflare Pages.
Une migration SQL déjà appliquée n'est jamais défaite automatiquement : la
corriger par une nouvelle migration.

Documenter ensuite : heure, cause, impact, commit retiré, commit restauré.

## Sauvegarde et récupération

- Hors site, chaque nuit : base + fichiers, chiffrés, dans Cloudflare R2,
  puis restaurés à blanc pour preuve
  ([sauvegarde-hors-site.md](sauvegarde-hors-site.md), procédure de
  restauration comprise).
- Sur le poste : `node supabase/backup-donnees.mjs` (export JSON hors du
  dépôt) ; état : `npm run sauvegarde:verifier`.
- Schéma : `supabase/migrations/` (baseline + migrations) et action
  « photographier » de [migrations-sql.md](migrations-sql.md).
- Code : chaque déploiement correspond à un commit de master.

## Prochaines marches

- Restauration à un instant donné (PITR, option payante de Supabase).
- Canal de retour utilisateur direct (e-mail visible, groupe WhatsApp).
- Accès partagé ou coffre récupérable (un seul développeur).
