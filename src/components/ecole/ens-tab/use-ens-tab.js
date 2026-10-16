import { genererMdp } from "../../../constants";
import { creerCompte as creerCompteSb } from "../../../backend/account-manage-supabase";
import { teacherAccountSection } from "../../../backend/teacher-scope";
import { coordonneesEnseignant, identifiantAffiche, loginEnseignant, modesIdentifiant } from "../../../comptes-enseignants";

// Logique de l'onglet Enseignants : édition des formulaires, section du
// compte (depuis la prop `section` d'Ecole), ouverture et création de compte
// enseignant (Edge Function account-manage).
// L'identifiant d'un nouveau compte est le TÉLÉPHONE ou l'E-MAIL de la fiche
// (comptes-enseignants.js) ; l'e-mail est enregistré sur le compte dans les
// deux cas, pour la connexion par e-mail et « Mot de passe oublié ».
export function useEnsTab({
  section, schoolId, toast, logAction,
  ensCompte, setEnsCompte, formC, setFormC, setForm,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const chgC = (k) => (e) => setFormC((p) => ({ ...p, [k]: e.target.value }));
  const sectionEns = teacherAccountSection(section);

  const ouvrirCompteEns = (e) => {
    const modes = modesIdentifiant(e);
    if (!modes.length) {
      toast("Renseignez d'abord le téléphone ou l'e-mail de l'enseignant (bouton Modifier) : ce sera son identifiant de connexion.", "warning");
      return;
    }
    setEnsCompte(e);
    setFormC({ mode: modes[0], mdp: genererMdp() });
  };

  const creerCompteEns = async () => {
    const login = loginEnseignant(formC.mode, ensCompte);
    const identifiant = identifiantAffiche(formC.mode, ensCompte);
    if (!login) { toast("Choisissez le téléphone ou l'e-mail comme identifiant.", "warning"); return; }
    if (!formC.mdp || formC.mdp.length < 8) { toast("Mot de passe minimum 8 caractères.", "warning"); return; }
    try {
      const nomComplet = `${ensCompte.prenom || ""} ${ensCompte.nom || ""}`.trim();
      const { email } = coordonneesEnseignant(ensCompte);
      const payload = {
        schoolId,
        login,
        mdp: formC.mdp,
        role: "enseignant",
        label: "Enseignant",
        nom: nomComplet,
        enseignantId: ensCompte._id,
        enseignantNom: nomComplet,
        section: sectionEns,
        sections: [sectionEns],
        matiere: ensCompte.matiere || "",
        statut: "Actif",
        ...(email ? { email } : {}),
      };
      await creerCompteSb(payload);
      toast(`Compte enseignant créé — identifiant : ${identifiant} · L'enseignant changera son mot de passe à la 1ère connexion.`, "success");
      logAction("Compte enseignant créé", `Identifiant : ${identifiant} · ${nomComplet}`);
      setEnsCompte(null);
    } catch (e) {
      toast("Erreur : " + e.message, "error");
    }
  };

  return { chg, chgC, sectionEns, ouvrirCompteEns, creerCompteEns };
}
