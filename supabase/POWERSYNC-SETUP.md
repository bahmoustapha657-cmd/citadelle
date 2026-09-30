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
  Paramètres de l'école, superadmin, et les fiches de paie du portail
  enseignant (aucun bucket ne les lui livre ; la RLS lui accorde les
  siennes : `supabase/salaires-enseignant.sql`).

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

## Priorités de synchro (réseau faible) — 2026-09-29

Les règles donnent une `priority:` à chaque bucket : PowerSync rend visible
chaque niveau dès qu'il est complet, au lieu d'attendre la fin de tout.

| Priorité | Buckets | Contenu | Poids (La Citadelle) |
|---|---|---|---|
| 1 | `school_data`, `compta_data` | élèves, classes, matières, enseignants, EDT, appréciations, école, postes, comptabilité | ≈ 1,1 Mo |
| 2 | `staff_notes`, `teacher_notes` | notes, absences | ≈ 3,5 Mo |
| 3 | les autres | calendrier, examens/livrets, messages, fondation, journal, comptes | ≈ 0,2 Mo |

Mise en service : **Sync Rules** → remplacer tout par
`supabase/powersync-sync-rules.min.yaml` → **Validate** → **Deploy**.
Aucun changement SQL (mêmes tables, même publication), aucun bucket ne
change de contenu : seules les lignes `priority:` sont nouvelles. (Déplacer
une table d'un bucket à l'autre la ferait disparaître un moment du miroir au
redéploiement — `tests/powersync-sync-rules.test.js` fige ce contenu.)

⚠️ **Tout redéploiement des règles recrée les buckets** : au retour suivant,
chaque appareil re-télécharge UNE fois ses données (≈ 5 Mo pour la direction
de La Citadelle). Les anciennes données restent affichées pendant ce temps.
Déployer à une heure creuse (soir, week-end) plutôt qu'en pleine saisie.

**Vérification** : dans un vrai Chrome, se connecter avec un compte qui n'a
jamais ouvert l'app sur ce navigateur (ou profil vierge) → le bandeau passe
de « Première synchronisation… » à « Élèves et classes disponibles — notes
… en cours », les listes d'élèves se remplissent avant les notes.

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
- **Priorité 0** : jamais. Elle s'applique même avec des écritures locales
  pas encore envoyées (affichage incohérent possible) ; rester entre 1 et 3
  (`tests/powersync-sync-rules.test.js` le vérifie).
- **Navigateur qui traduit le tableau de bord** : la traduction automatique
  déforme le YAML affiché (« W HERE ») — la désactiver avant de coller.
