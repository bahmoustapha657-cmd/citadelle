import { genererMdp } from "../../../constants";
import { apiFetch, getAuthHeaders } from "../../../apiClient";

// Logique de l'onglet Enseignants : édition des formulaires, section déduite
// de la clé, ouverture et création de compte enseignant via /account-manage.
export function useEnsTab({
  cleEns, schoolId, toast, logAction,
  ensCompte, setEnsCompte, formC, setFormC, setForm,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const chgC = (k) => (e) => setFormC((p) => ({ ...p, [k]: e.target.value }));
  const sectionEns = cleEns.includes("Lycee") ? "lycee" : cleEns.includes("College") ? "college" : "primaire";

  // Identifiant valide côté serveur : minuscules, sans accents, uniquement
  // [a-z0-9] par segment (le pattern d'API n'accepte ni é/è/à ni espaces).
  const slugLogin = (s) => (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  const ouvrirCompteEns = (e) => {
    const prenom = slugLogin(e.prenom);
    const nom = slugLogin(e.nom);
    const loginSuggere = [prenom, nom].filter(Boolean).join(".");
    setEnsCompte(e);
    setFormC({ login: loginSuggere, mdp: genererMdp() });
  };

  const creerCompteEns = async () => {
    if (!formC.login?.trim()) { toast("Identifiant requis.", "warning"); return; }
    if (!formC.mdp || formC.mdp.length < 8) { toast("Mot de passe minimum 8 caractères.", "warning"); return; }
    try {
      const nomComplet = `${ensCompte.prenom || ""} ${ensCompte.nom || ""}`.trim();
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/account-manage", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "create",
          schoolId,
          login: formC.login.trim().toLowerCase(),
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Création du compte impossible.");
      toast(`Compte enseignant créé — ID : ${formC.login} · L'enseignant changera son mot de passe à la 1ère connexion.`, "success");
      logAction("Compte enseignant créé", `Login: ${formC.login} · ${nomComplet}`);
      setEnsCompte(null);
    } catch (e) {
      toast("Erreur : " + e.message, "error");
    }
  };

  return { chg, chgC, sectionEns, ouvrirCompteEns, creerCompteEns };
}
