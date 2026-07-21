# Mode hors ligne (PowerSync) — runbook de mise en service

Le **code est prêt** (client, connecteur, schéma local, statut de sync) et les
**Sync Rules** sont écrites (`powersync-sync-rules.yaml`). Il ne reste que la
mise en place de l'instance PowerSync Cloud et sa connexion à Supabase — les
étapes ci‑dessous, à faire **une seule fois**. Tant que `VITE_POWERSYNC_URL`
est vide, le hors‑ligne est simplement **désactivé** (l'app tourne normalement
en ligne).

Périmètre « vague 1 » = **académique** (élèves, classes, matières, enseignants,
emplois, enseignements, notes, absences, appréciations). Réservé au personnel
et aux enseignants ; les parents ne se connectent pas à PowerSync.

---

## 1. Côté Supabase (SQL Editor)

**a. Portée enseignant** (si pas déjà fait) — après `teacher-security.sql` :
```
\i powersync-scope.sql        (ou coller le contenu de supabase/powersync-scope.sql)
```

**b. Publication de réplication logique** — indique à PowerSync quelles tables
répliquer. Coller et exécuter :
```sql
create publication powersync for table
  eleves, classes, matieres, enseignants, emplois, enseignements,
  notes, absences, appreciations, comptes, enseignant_classes;
```
(`comptes` et `enseignant_classes` servent aux *Parameter Queries* côté serveur
PowerSync ; elles ne sont PAS envoyées aux appareils — seules les requêtes
`data:` des Sync Rules atteignent les clients.)

**c. Chaîne de connexion** : Supabase → **Settings → Database → Connection
string** → onglet **URI**. Notez l'hôte, le port **5432** (connexion directe)
et le **mot de passe** de la base (celui défini à la création du projet).

**d. Secret JWT** (pour que PowerSync valide les jetons de session) : Supabase →
**Settings → API → JWT Settings → JWT Secret**. Copiez‑le.

---

## 2. Côté PowerSync Cloud (dashboard, powersync.com)

1. **Create instance** (région proche, ex. Europe).
2. **Connections → Add connection → Postgres/Supabase** : collez l'URI de 1c,
   renseignez le mot de passe. Laissez le nom de publication = **`powersync`**.
   Cliquez **Test connection** → doit être vert.
3. **Sync Rules** : ouvrez l'éditeur, **remplacez tout** par le contenu de
   `supabase/powersync-sync-rules.yaml`, puis **Validate** (doit passer sans
   erreur).
4. **Client Auth** : type **Supabase** (ou « Custom / JWT »), collez le **JWT
   Secret** de 1d. (PowerSync valide ainsi l'`access_token` de la session — cf.
   `connector.js`, aucune auth séparée.)
5. **Deploy** (Validate & Deploy). Attendez que l'instance passe « Active ».
6. Copiez l'**URL de l'instance** (Instance → General, forme
   `https://xxxxx.powersync.journeyapps.com`).

---

## 3. Activer côté app

1. Dans `.env.supabase`, renseigner :
   ```
   VITE_POWERSYNC_URL=https://xxxxx.powersync.journeyapps.com
   ```
2. Redéployer : `npm run deploy:pages`.
3. Vérifier : se connecter (compte du personnel ou enseignant) → l'app
   télécharge les données ; couper le réseau → la saisie de notes/absences
   reste possible ; rétablir → la file remonte (badge « notes en attente »).

---

## Pièges connus (cause du blocage au Validate/Deploy)

- **Réplication logique indisponible** : sur les tiers Supabase très restreints,
  le slot de réplication peut manquer. Vérifier Database → Replication.
- **Connexion refusée** : utiliser le port **5432** (connexion directe), pas le
  pooler 6543, et le bon mot de passe de base.
- **Sync Rules invalides** : ne pas modifier la structure du YAML ; les
  *Parameter Queries* n'acceptent **qu'une seule table** (pas de JOIN) — c'est
  pourquoi `enseignant_classes.user_id` est dupliqué (étape 1a).
- **Auth** : sans le bon JWT Secret, les clients sont rejetés (401) même si
  l'instance est déployée.

Une fois l'instance « Active » et l'URL renseignée, plus rien à coder.
