import { useState, useEffect, useContext, useRef } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { useFirestore } from "../../../hooks/useFirestore";
import { genererMdp, getComptesDefautForSchool } from "../../../constants";
import { ROLES_SYSTEME_RESERVES } from "../admin-helpers";
import { creerCompte, reinitialiserMotDePasse } from "./admin-panel-api";

// Logique du panneau Admin : comptes Firestore, initialisation automatique
// des comptes manquants et réinitialisation de mot de passe.
export function useAdminPanel({ schoolId, userRole }) {
  const peutGererRoles = userRole === "direction" || userRole === "superadmin";
  const peutResetCompte = (targetRole) => {
    if (userRole === "superadmin" || userRole === "direction") return true;
    if (userRole === "admin") return !ROLES_SYSTEME_RESERVES.has(targetRole);
    return false;
  };
  const { toast, schoolInfo, setSchoolInfo } = useContext(SchoolContext);
  const { items: comptes, chargement, refresh: refreshComptes } = useFirestore("comptes");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [mdpsInitiaux, setMdpsInitiaux] = useState(null);
  const [initEnCours, setInitEnCours] = useState(false);
  // UNE seule tentative d'initialisation par montage (succès OU échec) :
  // sans ce garde, l'effet retentait en boucle — après un échec (ex. CORS,
  // fonction froide) l'écran mitraillait l'Edge Function, et après un succès
  // la liste `comptes` pas encore rafraîchie relançait des créations en 409.
  const initTenteeRef = useRef(false);
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const comptesDefaut = getComptesDefautForSchool(schoolInfo);

  // Initialiser les comptes actifs manquants avec la configuration de l'école
  useEffect(() => {
    if (chargement || initEnCours || initTenteeRef.current) return;
    const comptesManquants = comptesDefaut.filter((compteDefaut) =>
      !comptes.some((compteExistant) => compteExistant.role === compteDefaut.role),
    );
    if (comptesManquants.length === 0) return;
    // Garde-fou anti-réentrance : on verrouille avant l'initialisation async.
    initTenteeRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitEnCours(true);
    (async () => {
      const comptesCrees = [];
      for (const compteDefaut of comptesManquants) {
        const mdpClair = genererMdp();
        comptesCrees.push({
          login: compteDefaut.login,
          label: compteDefaut.label,
          role: compteDefaut.role,
          mdp: mdpClair,
        });
        try {
          await creerCompte({
            schoolId,
            login: compteDefaut.login,
            mdp: mdpClair,
            role: compteDefaut.role,
            nom: compteDefaut.nom,
            label: compteDefaut.label,
          });
        } catch (e) {
          toast(e.message || "Erreur création comptes.", "error");
          setInitEnCours(false);
          return;
        }
      }
      if (comptesCrees.length > 0) setMdpsInitiaux(comptesCrees);
      refreshComptes();
      setInitEnCours(false);
    })();
  }, [chargement, comptes, comptesDefaut, initEnCours, schoolId, toast, refreshComptes]);

  const sauvegarder = async () => {
    if (!form.mdp || form.mdp.length < 8) {
      toast("Le mot de passe doit contenir au moins 8 caractères.", "warning");
      return;
    }
    try {
      await reinitialiserMotDePasse({ schoolId, accountId: form._id, mdp: form.mdp });
      toast(`Mot de passe réinitialisé pour ${form.nom}.`, "success");
      setModal(null);
    } catch (e) {
      toast(e.message || "Erreur lors de la réinitialisation.", "error");
    }
  };

  return {
    peutGererRoles, peutResetCompte, schoolInfo, setSchoolInfo,
    comptes, chargement, refreshComptes, modal, setModal, form, setForm,
    mdpsInitiaux, setMdpsInitiaux, initEnCours, chg, sauvegarder, toast,
  };
}
