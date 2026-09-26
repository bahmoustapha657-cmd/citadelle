import { genererMdp } from "../../../constants";
import { creerOuRattacherCompteParent } from "../../../backend/compte-parent";
import { loginParentSuggere, messageCompteParent } from "../../../comptes-parents";

// Logique de l'onglet Élèves : droit de création de compte parent, édition
// du formulaire, et création du compte parent — ou rattachement de l'élève
// au compte de son foyer s'il en a déjà un (backend/compte-parent.js).
// `section` : prop d'Ecole, celle de l'élève (pas du compte : un parent
// suit ses enfants dans toutes les sections). Elle était déduite du nom de
// collection, et un élève de maternelle partait avec la section « college ».
export function useElevesTab({
  section, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, setFormP,
}) {
  // Compat : si l'appelant ne fournit pas canCreateParent, on retombe sur
  // canEdit (le comportement précédent : direction/admin uniquement).
  const peutCreerParent = canCreateParent ?? canEdit;
  const chgP = (k) => (e) => setFormP((p) => ({ ...p, [k]: e.target.value }));

  const ouvrirCompte = (e) => {
    setParentEleve(e);
    setFormP({ login: loginParentSuggere(e.nom), mdp: genererMdp() });
  };

  const creerCompteParent = async (formP) => {
    if (!formP.login?.trim()) { toast("Identifiant requis.", "warning"); return; }
    if (!formP.mdp || formP.mdp.length < 8) { toast("Mot de passe minimum 8 caracteres.", "warning"); return; }
    const eleves = [{ ...parentEleve, section }];
    try {
      const r = await creerOuRattacherCompteParent({ schoolId, login: formP.login, mdp: formP.mdp, eleves });
      toast(messageCompteParent(r, eleves), r.dejaRattache ? "info" : "success");
      if (!r.dejaRattache) {
        logAction(r.rattache ? "Eleve rattache compte parent" : "Compte parent cree",
          `Login: ${r.login} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
      }
      setParentEleve(null);
    } catch (e) {
      toast("Erreur : " + e.message, "error");
    }
  };

  return { peutCreerParent, chgP, ouvrirCompte, creerCompteParent };
}
