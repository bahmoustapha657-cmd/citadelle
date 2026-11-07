// Handlers de sauvegarde du module École : classe, enseignant et appréciation.
// Reçoivent les actions Firestore et l'état nécessaires en paramètres.
import { findStaffDuplicate, getStaffDuplicateMessage } from "../../staff-utils";
import { erreurEmail, normaliserEmail } from "../../comptes-enseignants";

// Crée/modifie une classe ; propage le renommage aux élèves concernés.
// Seule la classe de l'élève est écrite : renvoyer toute la fiche depuis la
// mémoire de l'écran effaçait un encaissement fait entre-temps sur un autre
// poste (le jsonb `extra` était réécrit en entier).
export function saveClasseAction({ form, modal, classes, eleves, ajC, modC, modChampE }) {
  const row = { ...form, effectif: Number(form.effectif || 0) };
  if (modal === "add_c") { ajC(row); return; }
  const ancienNom = classes.find((c) => c._id === form._id)?.nom;
  modC(row);
  if (ancienNom && ancienNom !== form.nom)
    eleves.filter((e) => e.classe === ancienNom).forEach((e) => modChampE(e._id, { classe: form.nom }));
}

// Crée/modifie un enseignant (garde anti-doublon) ; tient à jour la classe
// titulaire associée. Renvoie false si bloqué par un doublon ou si la classe
// titulaire n'existe pas : elle se choisit dans la liste des classes, et
// l'enregistrement n'en crée plus (une faute de frappe créait une classe
// fantôme).
// E-mail : vérifié, normalisé, puis reporté sur le compte de l'enseignant
// (`syncEmail`) pour la connexion par e-mail et « Mot de passe oublié ».
export async function saveEnseignantAction({ form, modal, ens, classes, toast, ajEns, modEns, modC, syncEmail }) {
  const row = { ...form };
  const problemeEmail = erreurEmail(row.email);
  if (problemeEmail) {
    toast(problemeEmail, "warning");
    return false;
  }
  row.email = normaliserEmail(row.email) || "";
  const existante = row.classeTitle ? classes.find((c) => c.nom === row.classeTitle) : null;
  if (row.classeTitle && !existante) {
    toast(`La classe « ${row.classeTitle} » n'existe pas. Choisissez une classe de la liste.`, "warning");
    return false;
  }
  const doublon = findStaffDuplicate(row, ens, {
    excludeId: modal === "edit_ens" ? row._id : null,
  });
  if (doublon) {
    toast(getStaffDuplicateMessage(doublon, { label: "cet enseignant" }), "warning");
    return false;
  }

  if (modal === "add_ens") await ajEns(row);
  else await modEns(row);

  if (existante) {
    const nomEns = `${row.prenom || ""} ${row.nom || ""}`.trim();
    if (nomEns && existante.enseignant !== nomEns) {
      await modC({ ...existante, enseignant: nomEns });
    }
  }
  // Fiche existante seulement : une fiche neuve n'a pas encore de compte.
  if (modal === "edit_ens" && row.email && syncEmail) {
    try {
      const n = await syncEmail(row._id, row.email);
      if (n) toast("E-mail ajouté au compte : l'enseignant peut se connecter avec et récupérer un mot de passe oublié.", "success");
    } catch (e) {
      toast(`Fiche enregistrée, mais l'e-mail n'a pas pu être ajouté au compte : ${e.message}`, "warning");
    }
  }
  return true;
}

// Enregistre (ou met à jour) l'appréciation d'un élève pour une période.
// L'ANNÉE est portée par l'enregistrement : sans elle, l'appréciation de T1
// de la rentrée écrasait celle du T1 précédent (l'unicité en base porte sur
// élève + période + année).
export async function saveAppreciationAction(eleveId, periode, texte, { getAppreciation, ajApp, modApp, annee = "" }) {
  const existant = getAppreciation(eleveId, periode);
  const data = { eleveId, periode, texte: String(texte || "").trim(), annee, updatedAt: Date.now() };
  if (existant) await modApp({ ...existant, ...data });
  else await ajApp(data);
}
