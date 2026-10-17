import { genererMdp } from "../../../constants";
import { creerCompte as creerCompteSb } from "../../../backend/account-manage-supabase";
import { teacherAccountSection } from "../../../backend/teacher-scope";
import { coordonneesEnseignant, identifiantAffiche, loginEnseignant, loginInterneEnseignant, modesIdentifiant } from "../../../comptes-enseignants";
import { compteExistantPour, relierComptes } from "../../../backend/espaces-supabase";
import { libelleEspace } from "../../../espaces-comptes";

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
      // Numéro ou e-mail déjà utilisé par un autre compte de l'école (la même
      // personne est déjà parent d'élève, ou membre du personnel) : on propose
      // d'ajouter l'espace Enseignant À CETTE PERSONNE plutôt que de refuser.
      const existant = await compteExistantPour({ login, email });
      let relierA = null;
      if (existant?.role === "enseignant") {
        toast(`${existant.par === "login" ? "Ce numéro" : "Cet e-mail"} est déjà celui du compte enseignant « ${existant.nom || existant.login} » : cet enseignant a sans doute déjà un compte.`, "warning");
        return;
      }
      if (existant) {
        const espace = libelleEspace(existant).titre;
        const ok = window.confirm(
          `${existant.par === "login" ? `Le numéro ${identifiant}` : `L'e-mail ${email}`} est déjà celui du compte « ${existant.nom || existant.login} » (${espace}).\n\n`
          + `S'il s'agit de la même personne : créer l'espace Enseignant et le RELIER à ce compte ? Elle se connectera comme d'habitude, puis passera d'un espace à l'autre avec le bouton « Espace ».\n\n`
          + "Annuler si ce n'est pas la même personne.",
        );
        if (!ok) return;
        relierA = existant;
      }
      // Le numéro reste l’identifiant du compte existant ; l’espace enseignant
      // reçoit un identifiant interne (la personne ne le tape jamais).
      const loginFinal = relierA?.par === "login" ? loginInterneEnseignant(login) : login;
      const emailFinal = relierA?.par === "email" ? null : email;
      const payload = {
        schoolId,
        login: loginFinal,
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
        ...(emailFinal ? { email: emailFinal } : {}),
      };
      const cree = await creerCompteSb(payload);
      if (relierA) {
        try {
          await relierComptes([relierA.id, cree.id]);
          toast(`Espace Enseignant ajouté à « ${relierA.nom || relierA.login} » : connexion avec ${identifiant}, puis bouton « Espace ».`, "success");
          logAction("Espace enseignant relié", `${nomComplet} · relié au compte ${relierA.login}`);
        } catch (e) {
          // Liaison réservée à la Direction : le compte existe, à relier ensuite.
          toast(`Compte enseignant créé (identifiant ${loginFinal}), mais pas encore relié : ${e.message} La Direction peut le relier dans Comptes & Postes → « Une personne, plusieurs espaces ».`, "warning");
          logAction("Compte enseignant créé", `Identifiant : ${loginFinal} · ${nomComplet}`);
        }
        setEnsCompte(null);
        return;
      }
      toast(`Compte enseignant créé — identifiant : ${identifiant} · L'enseignant changera son mot de passe à la 1ère connexion.`, "success");
      logAction("Compte enseignant créé", `Identifiant : ${identifiant} · ${nomComplet}`);
      setEnsCompte(null);
    } catch (e) {
      toast("Erreur : " + e.message, "error");
    }
  };

  return { chg, chgC, sectionEns, ouvrirCompteEns, creerCompteEns };
}
