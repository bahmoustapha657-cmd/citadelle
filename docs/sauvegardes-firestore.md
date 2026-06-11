# Sauvegardes Firestore — mise en place et restauration

EduGest exporte automatiquement toute la base Firestore chaque nuit (03h00 UTC)
vers un bucket Cloud Storage, via le workflow GitHub Actions
[`backup-firestore.yml`](../.github/workflows/backup-firestore.yml).
Tant que la configuration ci-dessous n'est pas faite, le workflow s'exécute
sans erreur mais n'exporte rien (avertissement dans les logs Actions).

## Mise en place (une seule fois, ~10 minutes)

Prérequis : projet GCP `citadelle-school` avec la facturation activée
(l'export Firestore l'exige) et [gcloud CLI](https://cloud.google.com/sdk)
connecté en propriétaire du projet.

```bash
# 1. Créer le bucket de sauvegarde (région proche, classe Nearline = économique)
gcloud storage buckets create gs://citadelle-school-backups \
  --project=citadelle-school --location=europe-west1 \
  --default-storage-class=NEARLINE --uniform-bucket-level-access

# 2. Rétention : purger automatiquement les exports de plus de 30 jours
cat > /tmp/lifecycle.json <<'EOF'
{ "rule": [ { "action": { "type": "Delete" }, "condition": { "age": 30 } } ] }
EOF
gcloud storage buckets update gs://citadelle-school-backups --lifecycle-file=/tmp/lifecycle.json

# 3. Compte de service dédié aux sauvegardes
gcloud iam service-accounts create edugest-backup \
  --project=citadelle-school --display-name="EduGest sauvegardes Firestore"

# 4. Droits : export Firestore + écriture dans le bucket (et rien d'autre)
gcloud projects add-iam-policy-binding citadelle-school \
  --member="serviceAccount:edugest-backup@citadelle-school.iam.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"
gcloud storage buckets add-iam-policy-binding gs://citadelle-school-backups \
  --member="serviceAccount:edugest-backup@citadelle-school.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 5. Clé JSON du compte de service
gcloud iam service-accounts keys create edugest-backup-key.json \
  --iam-account=edugest-backup@citadelle-school.iam.gserviceaccount.com
```

Enfin, dans GitHub : `Settings → Secrets and variables → Actions →
New repository secret`, nom **`GCP_SA_KEY`**, valeur = contenu du fichier
`edugest-backup-key.json`. Supprimez ensuite le fichier local
(`rm edugest-backup-key.json`) — la clé ne doit vivre que dans le secret.

Test immédiat : onglet **Actions → Sauvegarde Firestore → Run workflow**.

## Restauration

> ⚠️ L'import **écrase** les documents portant les mêmes identifiants.
> Faites un export frais AVANT toute restauration, et restaurez de
> préférence vers un projet de test d'abord.

```bash
# Lister les sauvegardes disponibles
gcloud storage ls gs://citadelle-school-backups/exports/

# Restaurer la totalité d'un export
gcloud firestore import gs://citadelle-school-backups/exports/2026-06-11_0300 \
  --project=citadelle-school
```

Pour restaurer une seule collection, exporter avec `--collection-ids=...`
puis importer cet export ciblé (un export complet ne permet pas l'import
sélectif d'une collection).

## Bonnes pratiques

- Vérifiez une fois par trimestre que la restauration fonctionne (vers un
  projet de test) — une sauvegarde non testée n'est pas une sauvegarde.
- Le badge du workflow dans l'onglet Actions vire au rouge si un export
  échoue : surveillez-le après tout changement de droits IAM.
- La rotation de la clé du compte de service est recommandée une fois par an
  (étape 5, puis mise à jour du secret GitHub).
