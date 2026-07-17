import { useCallback, useEffect, useRef, useState } from "react";
import { genererMdp } from "../../../constants";
import { DEFAULT_POSTES } from "../../../../shared/postes-config.js";
import {
  chargerPostes, sauverPoste, supprimerPoste, rattacherComptesAuxPostes, creerCompte, majEmailCompte,
} from "../../../backend/account-manage-supabase";
import { genererClePoste, roleCompteDuPoste } from "./postes-logic";

// Logique du panneau Comptes & Postes (mode Supabase uniquement) :
// chargement des postes, bootstrap des gabarits pour une école vierge,
// édition de la matrice de permissions et création de comptes multiples.
export function usePostesCard({ schoolId, peutGererRoles, comptes, refreshComptes, toast, setMdpsInitiaux }) {
  const [postes, setPostes] = useState([]);
  const [chargementPostes, setChargementPostes] = useState(true);
  const [posteEdite, setPosteEdite] = useState(null); // copie de travail dans l'éditeur
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const bootstrapTenteRef = useRef(false);

  const recharger = useCallback(async () => {
    try {
      setPostes(await chargerPostes());
    } catch (e) {
      toast(e.message || "Chargement des postes impossible.", "error");
    } finally {
      setChargementPostes(false);
    }
  }, [toast]);

  useEffect(() => { recharger(); }, [recharger]);

  // École sans postes (première ouverture après migration) : créer les 6
  // gabarits système et rattacher les comptes legacy de même rôle.
  // Une seule tentative par montage — même garde que l'init des comptes.
  useEffect(() => {
    if (chargementPostes || !peutGererRoles || postes.length > 0 || bootstrapTenteRef.current) return;
    bootstrapTenteRef.current = true;
    (async () => {
      try {
        const crees = [];
        for (const gabarit of DEFAULT_POSTES) {
          const { id } = await sauverPoste(schoolId, {
            cle: gabarit.cle, label: gabarit.label, systeme: true,
            actif: gabarit.actif, permissions: gabarit.permissions,
          });
          crees.push({ id, cle: gabarit.cle, label: gabarit.label });
        }
        await rattacherComptesAuxPostes(crees);
        toast("Postes initialisés à partir des rôles historiques.", "success");
        await recharger();
        refreshComptes?.();
      } catch (e) {
        toast(e.message || "Initialisation des postes impossible.", "error");
      }
    })();
  }, [chargementPostes, peutGererRoles, postes, schoolId, toast, recharger, refreshComptes]);

  const nouveauPoste = () => setPosteEdite({
    id: null, cle: "", label: "", systeme: false, actif: true, permissions: {}, nbComptes: 0,
  });

  const editerPoste = (poste) => setPosteEdite({ ...poste, permissions: { ...poste.permissions } });

  const enregistrerPoste = async () => {
    if (!posteEdite) return;
    const label = (posteEdite.label || "").trim();
    if (label.length < 3) { toast("Nom du poste : 3 caractères minimum.", "warning"); return; }
    setSauvegardeEnCours(true);
    try {
      const cle = posteEdite.id ? posteEdite.cle : genererClePoste(label, postes);
      await sauverPoste(schoolId, { ...posteEdite, label, cle });
      toast(`Poste « ${label} » enregistré.`, "success");
      setPosteEdite(null);
      await recharger();
    } catch (e) {
      toast(e.message || "Enregistrement du poste impossible.", "error");
    } finally {
      setSauvegardeEnCours(false);
    }
  };

  const retirerPoste = async (poste) => {
    try {
      await supprimerPoste(poste.id);
      toast(`Poste « ${poste.label} » supprimé.`, "success");
      setPosteEdite(null);
      await recharger();
    } catch (e) {
      toast(e.message || "Suppression impossible.", "error");
    }
  };

  const basculerActif = async (poste) => {
    try {
      await sauverPoste(schoolId, { ...poste, actif: !poste.actif });
      await recharger();
    } catch (e) {
      toast(e.message || "Changement d'état impossible.", "error");
    }
  };

  // Crée un compte de personnel rattaché au poste ; le mot de passe généré
  // est montré UNE fois via la modale des mots de passe initiaux.
  const creerCompteDuPoste = async (poste, { nom, login, email }) => {
    const mdp = genererMdp();
    await creerCompte({
      schoolId, login, mdp, nom: nom || login, email: email || null,
      role: roleCompteDuPoste(poste), posteId: poste.id, label: poste.label,
    });
    setMdpsInitiaux?.([{ login, label: poste.label, role: poste.cle, mdp }]);
    refreshComptes?.();
    await recharger();
  };

  // E-mail réel d'un compte existant (connexion par e-mail).
  const definirEmail = async (compte, email) => {
    try {
      await majEmailCompte(compte._id, email);
      toast(email ? `E-mail enregistré pour ${compte.nom}.` : `E-mail retiré pour ${compte.nom}.`, "success");
      refreshComptes?.();
    } catch (e) {
      toast(e.message || "Enregistrement de l'e-mail impossible.", "error");
    }
  };

  const comptesDuPoste = (poste) => comptes.filter((c) => c.posteId === poste.id
    || (!c.posteId && poste.systeme && c.role === poste.cle));

  return {
    postes, chargementPostes, posteEdite, setPosteEdite, sauvegardeEnCours,
    nouveauPoste, editerPoste, enregistrerPoste, retirerPoste, basculerActif,
    creerCompteDuPoste, comptesDuPoste, definirEmail,
  };
}
