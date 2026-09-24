import { isSectionActive } from "../../../constants";

// Logique de l'onglet "Personnel enseignant" côté comptabilité : agrégation
// des trois sections, aiguillage des actions par section et enregistrement
// de la paie (création / édition).

// Sections proposées (cartes, choix à la création) : celles que l'école a
// ouvertes dans Paramètres → Identité, sous le libellé que porte `_section`.
// Une école de maternelle seule garde « Primaire » : tout autre libellé
// serait aiguillé vers le lycée par les sélecteurs ci-dessous.
export const sectionsEnsOuvertes = (schoolInfo) => {
  const ouvertes = [["primaire", "Primaire"], ["college", "Collège"], ["lycee", "Lycée"]]
    .filter(([section]) => isSectionActive(schoolInfo, section))
    .map(([, libelle]) => libelle);
  return ouvertes.length ? ouvertes : ["Primaire"];
};

export function useEnseignantsTab({
  form, setForm, modal, setModal, toast, logAction,
  ensPrimaire, ensCollege, ensLycee,
  ajEnsPrim, ajEnsCol, ajEnsLyc, modEnsPrim, modEnsCol, modEnsLyc, supEnsPrim, supEnsCol, supEnsLyc,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const ensTous = [
    ...ensPrimaire.map((e) => ({ ...e, _section: "Primaire" })),
    ...ensCollege.map((e) => ({ ...e, _section: "Collège" })),
    ...ensLycee.map((e) => ({ ...e, _section: "Lycée" })),
  ];
  const ajEnsForSection = (sec) => sec === "Primaire" ? ajEnsPrim : sec === "Collège" ? ajEnsCol : ajEnsLyc;
  const modEnsForSection = (sec) => sec === "Primaire" ? modEnsPrim : sec === "Collège" ? modEnsCol : modEnsLyc;
  const supEnsForSection = (sec) => sec === "Primaire" ? supEnsPrim : sec === "Collège" ? supEnsCol : supEnsLyc;

  const saveEns = async () => {
    const sec = form._section || "Primaire";
    const isPrim = sec === "Primaire";
    const payload = {
      nom: form.nom || "", prenom: form.prenom || "",
      telephone: form.telephone || "",
      grade: form.grade || "",
      statut: form.statut || "Titulaire",
    };
    if (isPrim) {
      payload.montantForfait = Number(form.montantForfait || 0);
      if (form.classeTitle) payload.classeTitle = form.classeTitle;
    } else {
      payload.primeHoraire = Number(form.primeHoraire || 0);
      payload.primeParClasse = (form.primeParClasse || []).filter((p) => p.classe && Number(p.prime) > 0).map((p) => ({ classe: p.classe, prime: Number(p.prime) }));
    }
    if (modal === "edit_ens_compta") {
      await modEnsForSection(sec)({ ...payload, _id: form._id });
      toast("Enseignant mis à jour.", "success");
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
