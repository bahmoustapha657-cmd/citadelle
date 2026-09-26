import { useContext, useState } from "react";
import { genererMdp } from "../../../constants";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { creerOuRattacherCompteParent } from "../../../backend/compte-parent";
import { loginParentSuggere, messageCompteParent } from "../../../comptes-parents";

// Compte parent de la fratrie inscrite par la saisie rapide : UN compte pour
// tous les enfants, quelle que soit leur section, en un seul appel. Si le
// foyer a déjà son compte (un aîné inscrit l'an dernier…), le serveur y
// rattache la fratrie (backend/compte-parent.js).
// `eleves` : élèves inscrits pendant la saisie (leur section est dans
// `niveau`) ; seuls ceux dont on connaît l'`_id` peuvent être rattachés.
export function useCompteParentFratrie({ eleves, schoolId, toast }) {
  const { logAction } = useContext(SchoolContext);
  const [login, setLogin] = useState(null); // null : identifiant suggéré
  const [mdp, setMdp] = useState(() => genererMdp());
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // { login, mdp|null, rattache, dejaRattache }

  const enAttente = eleves.filter((e) => e._id).map((e) => ({ ...e, section: e.niveau }));
  const loginSaisi = login ?? loginParentSuggere(enAttente[0]?.nom);

  const valider = async () => {
    if (enCours || resultat || !enAttente.length) return;
    if (!loginSaisi.trim()) { toast("Identifiant requis.", "warning"); return; }
    if (mdp.length < 8) { toast("Mot de passe : 8 caractères minimum.", "warning"); return; }
    setEnCours(true);
    try {
      const r = await creerOuRattacherCompteParent({
        schoolId, login: loginSaisi, mdp, eleves: enAttente, apresInscription: true,
      });
      // Mot de passe affiché seulement s'il vient d'être choisi : celui d'un
      // compte existant ne change pas et n'est pas connu ici.
      setResultat({ ...r, mdp: r.rattache ? null : mdp });
      toast(messageCompteParent(r, enAttente), r.dejaRattache ? "info" : "success");
      if (!r.dejaRattache) {
        logAction(r.rattache ? "Eleve rattache compte parent" : "Compte parent cree",
          `Login: ${r.login} - Eleves: ${enAttente.map((e) => `${e.prenom} ${e.nom}`).join(", ")}`);
      }
    } catch (e) {
      toast("Compte parent : " + (e?.message || e), "error");
    } finally {
      setEnCours(false);
    }
  };

  return { login: loginSaisi, setLogin, mdp, setMdp, enCours, resultat, enAttente, valider };
}
