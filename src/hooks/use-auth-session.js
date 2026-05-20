import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseDb";
import { signOutCurrentUser, watchAuthState } from "../firebaseAuth";
import { getPrimaryModuleForRole } from "../constants";

// Hook qui synchronise l'état utilisateur + page courante avec l'auth
// Firebase. Au démarrage et à chaque changement d'état Firebase :
// - si pas connecté : reset utilisateur/page
// - sinon : charge le profil depuis /users/{uid}, vérifie le statut,
//   injecte schoolId + page initiale, et prefetch les modules les plus
//   utilisés.
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useAuthSession({ setSchoolId, setPage }) {
  const [utilisateur, setUtilisateur] = useState(null);

  useEffect(() => {
    let actif = true;
    let unsub = () => {};

    watchAuthState(async (firebaseUser) => {
      if (!actif) return;
      if (!firebaseUser) {
        // Session Firebase expirée ou déconnexion → vider l'état
        setUtilisateur(null);
        setPage(null);
        return;
      }
      try {
        const profil = await getDoc(doc(db, "users", firebaseUser.uid));
        if (profil.exists() && actif) {
          const d = profil.data();
          if (d.statut && d.statut !== "Actif") {
            signOutCurrentUser().catch(() => {});
            setUtilisateur(null);
            setPage(null);
            return;
          }
          const sid = d.schoolId;
          setSchoolId(sid);
          localStorage.setItem("LC_schoolId", sid);
          setUtilisateur({
            uid: firebaseUser.uid,
            login: d.login,
            nom: d.nom,
            role: d.role,
            label: d.label || d.role,
            premiereCo: !!d.premiereCo,
            compteDocId: d.compteDocId || null,
            schoolId: sid,
            section: d.section || null,
            sections: Array.isArray(d.sections) ? d.sections : [],
            eleveId: d.eleveId || null,
            eleveIds: Array.isArray(d.eleveIds) ? d.eleveIds : [],
            eleveNom: d.eleveNom || "",
            eleveClasse: d.eleveClasse || "",
            elevesAssocies: Array.isArray(d.elevesAssocies) ? d.elevesAssocies : [],
            enseignantId: d.enseignantId || null,
            enseignantNom: d.enseignantNom || "",
            matiere: d.matiere || "",
            tuteur: d.tuteur || "",
            contactTuteur: d.contactTuteur || "",
            filiation: d.filiation || "",
          });
          setPage((p) => p || getPrimaryModuleForRole(d.role));
          // Prefetch des pages les plus utilisées pendant que le dashboard se rend
          import("../components/Comptabilite").catch(() => {});
          import("../components/Ecole").catch(() => {});
        }
      } catch (e) {
        console.error("Erreur chargement profil:", e);
      }
    }).then((cleanup) => {
      if (actif) unsub = cleanup;
      else cleanup();
    }).catch(() => {});

    return () => {
      actif = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { utilisateur, setUtilisateur };
}
