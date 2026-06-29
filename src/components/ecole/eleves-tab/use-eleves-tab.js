import { genererMdp } from "../../../constants";
import { apiFetch, getAuthHeaders } from "../../../apiClient";
import { isSupabase } from "../../../backend";
import { creerCompte as creerCompteSb } from "../../../backend/account-manage-supabase";

// Logique de l'onglet Élèves : droit de création de compte parent, édition
// du formulaire et création/rattachement du compte parent via /account-manage.
export function useElevesTab({
  cleEleves, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, setFormP,
}) {
  // Compat : si l'appelant ne fournit pas canCreateParent, on retombe sur
  // canEdit (le comportement précédent : direction/admin uniquement).
  const peutCreerParent = canCreateParent ?? canEdit;
  const chgP = (k) => (e) => setFormP((p) => ({ ...p, [k]: e.target.value }));

  // Identifiant valide côté serveur : minuscules, sans accents, [a-z0-9]
  // uniquement (le pattern d'API rejette é/è/à et les espaces).
  const slugLogin = (s) => (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  const ouvrirCompte = (e) => {
    const loginSuggere = `parent.${slugLogin(e.nom).slice(0, 12)}`;
    setParentEleve(e);
    setFormP({ login: loginSuggere, mdp: genererMdp() });
  };

  const creerCompteParent = async (formP) => {
    if (!formP.login?.trim()) { toast("Identifiant requis.", "warning"); return; }
    if (!formP.mdp || formP.mdp.length < 8) { toast("Mot de passe minimum 8 caracteres.", "warning"); return; }
    try {
      const section = cleEleves.includes("Primaire") ? "primaire" : cleEleves.includes("Lycee") ? "lycee" : "college";
      const payload = {
        schoolId,
        login: formP.login.trim().toLowerCase(),
        mdp: formP.mdp,
        role: "parent",
        label: "Parent",
        nom: (parentEleve.tuteur || `Parent de ${parentEleve.prenom}`),
        eleveId: parentEleve._id,
        eleveNom: `${parentEleve.prenom} ${parentEleve.nom}`,
        eleveClasse: parentEleve.classe || "",
        section,
        sections: [section],
        eleveIds: [parentEleve._id],
        elevesAssocies: [{
          eleveId: parentEleve._id,
          eleveNom: `${parentEleve.prenom} ${parentEleve.nom}`,
          eleveClasse: parentEleve.classe || "",
          section,
        }],
        tuteur: parentEleve.tuteur || "",
        contactTuteur: parentEleve.contactTuteur || "",
        filiation: parentEleve.filiation || "",
        statut: "Actif",
      };
      let data;
      if (isSupabase) {
        data = await creerCompteSb(payload);
      } else {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        const res = await apiFetch("/account-manage", {
          method: "POST", headers,
          body: JSON.stringify({ action: "create", ...payload }),
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Creation du compte impossible.");
      }
      const loginUtilise = data.compte?.login || formP.login;
      if (data.merged || data.mergedIntoExisting) {
        toast(`${parentEleve.prenom} a ete rattache au compte parent ${loginUtilise}. Le mot de passe actuel est conserve.`, "success");
        logAction("Eleve rattache compte parent", `Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
      } else {
        toast(`Compte parent cree - ID : ${loginUtilise}. Remettez-le au tuteur de ${parentEleve.prenom}.`, "success");
        logAction("Compte parent cree", `Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
      }
      setParentEleve(null);
    } catch (e) {
      toast("Erreur : " + e.message, "error");
    }
  };

  return { peutCreerParent, chgP, ouvrirCompte, creerCompteParent };
}
