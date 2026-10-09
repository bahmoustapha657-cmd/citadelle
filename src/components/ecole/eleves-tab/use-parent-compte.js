import { useEffect, useState } from "react";
import { genererMdp } from "../../../constants";
import {
  comptesParentsDeLEleve, comptesParentsEcole, creerOuRattacherCompteParent,
  detacherCompteParent, rattacherCompteParent,
} from "../../../backend/compte-parent";
import { chercherComptesParents, libelleLien, loginParentSuggere, messageCompteParent } from "../../../comptes-parents";

// Modale « Compte parent » d'un élève : les comptes qui le suivent (à
// détacher), le rattachement à un compte existant (recherche par numéro, nom
// ou identifiant) et la création — le numéro du parent proposé comme
// identifiant. Un enfant peut être suivi par plusieurs comptes : le père et
// la mère chacun le sien.
// `section` : celle de l'élève, portée par le lien (pas par le compte).
export function useParentCompte({ eleve, section, schoolId, toast, logAction }) {
  const [lies, setLies] = useState(null); // null : chargement
  const [comptesEcole, setComptesEcole] = useState(null); // chargés à la 1re recherche
  const [chargementComptes, setChargementComptes] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [lienRattachement, setLienRattachement] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [formulaire, setFormulaire] = useState(() => ({
    nom: eleve.tuteur || "", telephone: eleve.contactTuteur || "", lien: "",
    login: null, // null : identifiant suggéré d'après le numéro
    mdp: genererMdp(),
  }));
  const [cree, setCree] = useState(null); // { login, mdp } du compte créé ici
  // Formulaire de création ouvert à la demande quand l'élève a déjà un compte.
  const [creationOuverte, setCreationOuverte] = useState(false);
  const nomEleve = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim();
  const accorde = (participe) => `${participe}${eleve.sexe === "F" ? "e" : ""}`;

  const recharger = async () => {
    try {
      setLies(await comptesParentsDeLEleve(eleve._id));
    } catch (e) {
      setLies([]);
      toast("Comptes parents : " + e.message, "error");
    }
  };
  // Au montage seulement : la modale est remontée pour chaque élève (clé).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recharger(); }, []);

  const chercher = async (saisie) => {
    setRecherche(saisie);
    if (comptesEcole || chargementComptes || saisie.trim().length < 2) return;
    setChargementComptes(true);
    try {
      setComptesEcole(await comptesParentsEcole());
    } catch (e) {
      toast("Recherche : " + e.message, "error");
    } finally {
      setChargementComptes(false);
    }
  };
  const dejaLies = new Set((lies || []).map((c) => c.id));
  const resultats = chercherComptesParents((comptesEcole || []).filter((c) => !dejaLies.has(c.id)), recherche);

  // Action serveur commune : verrou, toast d'erreur, rechargement des comptes.
  const agir = async (action) => {
    if (enCours) return;
    setEnCours(true);
    try {
      await action();
      await recharger();
    } catch (e) {
      toast("Erreur : " + (e?.message || e), "error");
    } finally {
      setEnCours(false);
    }
  };

  const rattacher = (compte) => agir(async () => {
    await rattacherCompteParent({ schoolId, compteId: compte.id, eleveId: eleve._id, lien: lienRattachement });
    toast(`${eleve.prenom} ${accorde("rattaché")} au compte parent « ${compte.login} ».`, "success");
    logAction("Eleve rattache compte parent", `Login: ${compte.login} - Eleve: ${nomEleve}`);
    setRecherche("");
  });

  const detacher = (compte) => {
    const qui = [libelleLien(compte.lien), compte.nom].filter(Boolean).join(" — ") || compte.login;
    if (!confirm(`Détacher ${eleve.prenom} du compte parent « ${compte.login} » (${qui}) ? Ce parent ne verra plus ses notes, absences ni paiements.`)) return;
    agir(async () => {
      await detacherCompteParent({ schoolId, compteId: compte.id, eleveId: eleve._id });
      toast(`${eleve.prenom} ${accorde("détaché")} du compte parent « ${compte.login} ».`, "success");
      logAction("Eleve detache compte parent", `Login: ${compte.login} - Eleve: ${nomEleve}`);
    });
  };

  const loginSaisi = formulaire.login ?? loginParentSuggere(eleve.nom, formulaire.telephone);
  const champ = (cle) => (e) => setFormulaire((f) => ({ ...f, [cle]: e.target.value }));

  const creer = () => {
    if (!loginSaisi.trim()) { toast("Identifiant requis.", "warning"); return; }
    if (formulaire.mdp.length < 8) { toast("Mot de passe : 8 caractères minimum.", "warning"); return; }
    const eleves = [{ ...eleve, section }];
    agir(async () => {
      const r = await creerOuRattacherCompteParent({
        schoolId, login: loginSaisi, mdp: formulaire.mdp, eleves,
        parent: { nom: formulaire.nom, telephone: formulaire.telephone, lien: formulaire.lien },
      });
      toast(messageCompteParent(r, eleves), r.dejaRattache ? "info" : "success");
      if (!r.dejaRattache) {
        logAction(r.rattache ? "Eleve rattache compte parent" : "Compte parent cree", `Login: ${r.login} - Eleve: ${nomEleve}`);
      }
      // Nouveau compte : identifiants à remettre au parent. Compte existant :
      // son mot de passe ne change pas.
      if (!r.rattache) setCree({ login: r.login, mdp: formulaire.mdp });
      // Formulaire replié et vidé : un éventuel autre parent part de zéro,
      // sans renvoyer par mégarde la même demande.
      setCreationOuverte(false);
      setFormulaire({ nom: "", telephone: "", lien: "", login: null, mdp: genererMdp() });
    });
  };

  return {
    lies, enCours, cree,
    recherche, chercher, resultats, chargementComptes, comptesCharges: Boolean(comptesEcole),
    lienRattachement, setLienRattachement, rattacher, detacher,
    formulaire, champ, setFormulaire, loginSaisi, creer, creationOuverte, setCreationOuverte,
  };
}
