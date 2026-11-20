#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  Recharge les DONNÉES d'une sauvegarde EduGest dans une base Supabase dont
#  le schéma est déjà en place (migrations appliquées), puis compare chaque
#  table au relevé fait au moment de la sauvegarde.
# ════════════════════════════════════════════════════════════════════════
# Usage : scripts/restaurer-base.sh <dossier-de-la-sauvegarde> <url-de-la-base>
#
# C'est LA procédure de restauration : la même que celle que le workflow
# « Sauvegarde hors site » rejoue chaque nuit dans un Supabase local
# (cf. docs/sauvegarde-hors-site.md). Les tables présentes dans la sauvegarde
# sont vidées puis rechargées, contraintes et déclencheurs suspendus.
#
# N'affiche que des totaux et le nom des tables en écart : jamais une valeur
# (le journal d'une action GitHub de ce dépôt est public).
# Sortie 1 si une table de « public » ne retombe pas sur ses lignes.
set -euo pipefail

dossier=${1:?dossier de la sauvegarde}
base=${2:?url de la base cible}
[ -f "$dossier/data.sql" ] && [ -f "$dossier/lignes.tsv" ] || {
  echo "Sauvegarde incomplète : $dossier/data.sql et lignes.tsv attendus." >&2
  exit 2
}

travail=$(mktemp -d)
trap 'rm -rf "$travail"' EXIT
cut -f1 "$dossier/lignes.tsv" | sed 's/.*/TRUNCATE TABLE & CASCADE;/' > "$travail/vider.sql"

{ echo "SET session_replication_role = replica;"
  cat "$travail/vider.sql" "$dossier/data.sql"
} | psql "$base" -q -v ON_ERROR_STOP=0 > /dev/null 2> "$travail/erreurs.log" || true
erreurs=$(grep -c '^ERROR' "$travail/erreurs.log" || true)

tables=0; ecarts=0; ecarts_publics=0
while IFS=$'\t' read -r table attendu; do
  tables=$((tables + 1))
  obtenu=$(psql "$base" -Atc "select count(*) from $table" 2>/dev/null || echo "?")
  if [ "$obtenu" != "$attendu" ]; then
    ecarts=$((ecarts + 1))
    case "$table" in '"public".'*) ecarts_publics=$((ecarts_publics + 1)) ;; esac
    echo "écart : $table — sauvegarde $attendu, restauré $obtenu"
  fi
done < "$dossier/lignes.tsv"

echo "Restauration : $tables tables, $ecarts écart(s) dont $ecarts_publics dans public, $erreurs erreur(s) SQL"
echo "RESULTAT tables=$tables ecarts=$ecarts ecarts_publics=$ecarts_publics erreurs=$erreurs"
[ "$ecarts_publics" -eq 0 ]
