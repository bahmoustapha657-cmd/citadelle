// ── « Toutes mes classes » : enseignant dans plusieurs établissements ──────
// Logique PURE (tests/enseignant-etablissements.test.js). Un enseignant
// indépendant a un espace par établissement (décision du 2026-11-18,
// étape 2) ; cette vue réunit les classes de tous ses espaces, lues par la
// RPC mes_classes() (migration 20261118160243).

// Page hors carte de permissions (comme la messagerie) : ajoutée au menu
// d'un espace enseignant seulement (AppShell, App).
export const PAGE_MES_CLASSES = "mesclasses";

// Lignes de mes_classes() → un groupe par établissement, le sien d'abord.
// Un établissement sans classe arrive avec une ligne sans classe : il
// figure quand même, avec une liste vide.
export function grouperParEtablissement(lignes = []) {
  const groupes = new Map();
  for (const l of lignes) {
    if (!l?.compte_id) continue;
    if (!groupes.has(l.compte_id)) {
      groupes.set(l.compte_id, {
        compteId: l.compte_id, code: l.ecole_code || "", nom: l.ecole_nom || "", actuel: !!l.actuel, classes: [],
        // Dernière demande de rattachement à une école (étape 3), si elle
        // attend la direction ou a été refusée.
        rattachement: l.rattachement_statut
          ? { statut: l.rattachement_statut, ecole: l.rattachement_ecole || "" }
          : null,
      });
    }
    if (l.classe_id) {
      groupes.get(l.compte_id).classes.push({
        id: l.classe_id, section: l.section, nom: l.classe || "", effectif: Number(l.effectif) || 0,
      });
    }
  }
  return [...groupes.values()].sort((a, b) => (Number(b.actuel) - Number(a.actuel))
    || a.nom.localeCompare(b.nom));
}

// Module où s'ouvre une classe : maternelle et primaire dans « Primaire »,
// collège et lycée dans « Secondaire ».
export const moduleDeSection = (section) => (section === "college" || section === "lycee" ? "secondaire" : "primaire");

// Formulaire « Ajouter un établissement » : mêmes exigences que le serveur
// (account-manage/etablissements.ts, validerNouvelEtablissement).
export function erreurNouvelEtablissement(form, t) {
  if (!String(form.etablissement || "").trim()) return t("register.teacher.errors.schoolRequired");
  if (!String(form.ville || "").trim()) return t("register.errors.cityRequired");
  if (!form.sections?.length) return t("register.teacher.errors.levelRequired");
  return "";
}

export function totauxMesClasses(groupes = []) {
  const classes = groupes.flatMap((g) => g.classes);
  return {
    etablissements: groupes.length,
    classes: classes.length,
    eleves: classes.reduce((s, c) => s + c.effectif, 0),
  };
}
