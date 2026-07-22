# Mode hors ligne (PowerSync) — runbook

L'instance PowerSync Cloud est **en service** (vague 1 académique déployée le
2026-07-22). Ce document décrit la **mise à niveau « hors ligne TOTAL »**
(tous les modules du personnel, sauf portail parent) et, en annexe, la mise en
service initiale.

Périmètre « hors ligne total » :
- **Académique** (tout le personnel + enseignants) : élèves, classes,
  matières, enseignants, emplois, enseignements, appréciations, notes,
  absences (+ fiche école, annonces, postes).
- **Par module, selon les permissions du poste** : Comptabilité (recettes,
  dépenses, versements, bons, personnel, salaires, tarifs), Calendrier
  (événements), Examens (examens, livrets, honneurs), Messages Parents,
  Fondation (membres, documents), Historique, Comptes (lecture, AdminPanel).
- **Restent en ligne** : portail parent (vague ultérieure), messagerie
  interne, création de comptes / reset mdp (Edge Functions), sauvegarde des
  Paramètres de l'école, superadmin.

---

## Mise à niveau « hors ligne total » (à faire UNE fois, dans CET ordre)

⚠️ **Le front ne doit être redéployé QU'APRÈS les 3 étapes ci‑dessous**,
sinon les modules non-académiques liraient un miroir local vide.

**1. Supabase → SQL Editor** — colonnes de permissions dénormalisées :
coller et exécuter `supabase/powersync-perms.sql` (idempotent ; le SELECT
final montre la répartition perm_* par rôle — vérifier que direction a tout).

**2. Supabase → SQL Editor** — étendre la publication :
```sql
drop publication if exists powersync;
create publication powersync for table
  eleves, classes, matieres, enseignants, emplois, enseignements,
  notes, absences, appreciations, comptes, enseignant_classes,
  ecoles, annonces, postes, recettes, depenses, versements, bons,
  personnel, salaires, tarifs, evenements, examens, livrets,
  honneurs, messages, membres, documents, historique;
```

**3. PowerSync dashboard → Sync Rules** : remplacer tout par le contenu de
`supabase/powersync-sync-rules.min.yaml` (version sans commentaires, collage
sûr) → **Validate** → **Deploy**. Attendre que l'instance repasse « Active ».

**4. Redéployer le front** : `npm run deploy:pages`.

**Vérification** : se connecter (direction) → ouvrir Comptabilité et
Calendrier → couper le réseau → les données restent, la saisie d'une recette
ou d'un événement passe → rétablir → badge de sync puis remontée.

---

## Annexe — mise en service initiale (déjà faite)

1. **Supabase SQL Editor** : `rls.sql` → `teacher-security.sql` →
   `postes.sql` → `powersync-scope.sql` (user_id sur enseignant_classes)
   → `powersync-perms.sql`.
2. **Chaîne de connexion** : Settings → Database → Connection string → URI,
   port **5432** (direct, pas le pooler 6543) + mot de passe de la base.
3. **Secret JWT** : Settings → API → JWT Settings → JWT Secret.
4. **PowerSync Cloud** : Create instance → Connections (URI + mdp, publication
   `powersync`, Test connection vert) → Sync Rules (coller le .min.yaml,
   Validate) → Client Auth (Supabase / JWT Secret) → Deploy.
5. **App** : `VITE_POWERSYNC_URL=https://xxxxx.powersync.journeyapps.com`
   dans `.env.supabase` → `npm run deploy:pages`.

## Pièges connus

- **Collage YAML** : coller la version `.min.yaml` (les commentaires
  multi-lignes cassent l'indentation → « All mapping items must start at the
  same column »).
- **Parameter Queries** : une seule table, pas de JOIN, pas de `IN (liste)`,
  pas de DISTINCT, pas de jsonb — d'où `enseignant_classes.user_id`
  (powersync-scope.sql) et les colonnes `perm_*` (powersync-perms.sql).
- **Publication** : après tout `drop/create publication`, PowerSync reprend
  un snapshot initial des nouvelles tables (quelques minutes).
- **Auth** : sans le bon JWT Secret, les clients sont rejetés (401).
- **Webview/preview** : le SharedWorker PowerSync n'y tourne pas
  (`connected:false` trompeur) — tester dans un vrai Chrome.
