import { isSectionActive } from "../../../constants";
import { erreurEmail, normaliserEmail } from "../../../comptes-enseignants";

// Logique de l'onglet "Personnel enseignant" côté comptabilité : agrégation
// des quatre sections, aiguillage des actions par section et enregistrement
// de la paie (création / édition).

// Sections proposées (cartes, choix à la création) : celles que l'école a
// ouvertes dans Paramètres → Identité, sous le libellé que porte `_section`.
export const sectionsEnsOuvertes = (schoolInfo) => {
  const ouvertes = [["prescolaire", "Préscolaire"], ["primaire", "Primaire"], ["college", "Collège"], ["lycee", "Lycée"]]
    .filter(([section]) => isSectionActive(schoolInfo, section))
    .map(([, libelle]) => libelle);
  return ouvertes.length ? ouvertes : ["Primaire"];
};

// Section cochée à l'ouverture de « Nouvel enseignant » : le primaire (le
// gros des effectifs) s'il est ouvert, sinon la première section ouverte.
export const sectionEnsParDefaut = (schoolInfo) => {
  const ouvertes = sectionsEnsOuvertes(schoolInfo);
  return ouvertes.includes("Primaire") ? "Primaire" : ouvertes[0];
};

// Maternelle et primaire sont payés au forfait mensuel (groupe de paie
// « Primaire ») ; collège et lycée à la prime horaire.
export const estSectionForfait = (sec) => sec === "Primaire" || sec === "Préscolaire";

export function useEnseignantsTab({
  form, setForm, modal, setModal, toast, logAction,
  ensPrimaire, ensCollege, ensLycee, ensPrescolaire = [], classesTitulaire = [],
  ajEnsPrim, ajEnsCol, ajEnsLyc, ajEnsPresco, modEnsPrim, modEnsCol, modEnsLyc, modEnsPresco,
  supEnsPrim, supEnsCol, supEnsLyc, supEnsPresco,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // La maternelle manquait ici : ses enseignants étaient comptés dans le
  // libellé de l'onglet mais absents de la liste.
  const ensTous = [
    ...ensPrescolaire.map((e) => ({ ...e, _section: "Préscolaire" })),
    ...ensPrimaire.map((e) => ({ ...e, _section: "Primaire" })),
    ...ensCollege.map((e) => ({ ...e, _section: "Collège" })),
    ...ensLycee.map((e) => ({ ...e, _section: "Lycée" })),
  ];
  const ajEnsForSection = (sec) => ({ "Préscolaire": ajEnsPresco, Primaire: ajEnsPrim, "Collège": ajEnsCol, "Lycée": ajEnsLyc })[sec];
  const modEnsForSection = (sec) => ({ "Préscolaire": modEnsPresco, Primaire: modEnsPrim, "Collège": modEnsCol, "Lycée": modEnsLyc })[sec];
  const supEnsForSection = (sec) => ({ "Préscolaire": supEnsPresco, Primaire: supEnsPrim, "Collège": supEnsCol, "Lycée": supEnsLyc })[sec];

  const saveEns = async () => {
    const problemeEmail = erreurEmail(form.email);
    if (problemeEmail) { toast(problemeEmail, "warning"); return; }
    const sec = form._section || "Primaire";
    const isPrim = estSectionForfait(sec);
    const payload = {
      nom: form.nom || "", prenom: form.prenom || "",
      telephone: form.telephone || "",
      email: normaliserEmail(form.email) || "",
      grade: form.grade || "",
      statut: form.statut || "Titulaire",
    };
    if (isPrim) {
      // Classe titulaire choisie dans la liste : une valeur hors liste (ancienne
      // saisie libre) est refusée plutôt que d'enregistrer une classe fantôme.
      if (form.classeTitle && classesTitulaire.length && !classesTitulaire.includes(form.classeTitle)) {
        toast(`La classe « ${form.classeTitle} » n'existe pas. Choisissez une classe de la liste.`, "warning");
        return;
      }
      payload.montantForfait = Number(form.montantForfait || 0);
      // Vide = n'est plus titulaire (l'ancien « if » ne permettait pas de retirer).
      payload.classeTitle = form.classeTitle || "";
    } else {
      payload.primeHoraire = Number(form.primeHoraire || 0);
      payload.primeParClasse = (form.primeParClasse || []).filter((p) => p.classe && Number(p.prime) > 0).map((p) => ({ classe: p.classe, prime: Number(p.prime) }));
    }
    if (modal === "edit_ens_compta") {
      await modEnsForSection(sec)({ ...payload, _id: form._id });
      toast("Enseignant mis à jour.", "success");
      // E-mail reporté sur son compte (connexion par e-mail, mot de passe oublié).
      if (payload.email) {
        // Import différé : ce module (sectionsEnsOuvertes) est aussi chargé
        // hors navigateur, sans client Supabase.
        const { synchroniserEmailEnseignant } = await import("../../../backend/account-manage-supabase");
        await synchroniserEmailEnseignant(form._id, payload.email)
          .catch((e) => toast(`L'e-mail n'a pas pu être ajouté au compte : ${e.message}`, "warning"));
      }
      logAction("Enseignant modifié (Compta)", `${payload.prenom} ${payload.nom} · ${sec}`);
    } else {
      await ajEnsForSection(sec)(payload);
      toast("Enseignant créé. Affectations pédagogiques à compléter dans Primaire/Secondaire.", "success");
      logAction("Enseignant créé (Compta)", `${payload.prenom} ${payload.nom} · ${sec}`);
    }
    setModal(null); setForm({});
  };

  return { chg, ensTous, supEnsForSection, saveEns };
}
