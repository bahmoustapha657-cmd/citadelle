import { useEffect, useState } from "react";
import { signOutSession } from "../../backend/session";
import { getPrimaryModuleForRole, getRoleLabelForSchool } from "../../constants";
import { getPrimaryModuleForCompte } from "../../../shared/postes-config.js";
import { computePlanInfo } from "./app-shell-plan";
import {
  envoyerPushApi,
  logActionDoc,
  persisterAnnee,
  sAbonnerAuxPush,
} from "./app-shell-api";

// Logique transverse du shell applicatif : toasts, journal d'actions,
// notifications push, calcul du plan (freemium + grâce), année courante,
// connexion/déconnexion. La page et l'UI restent gérées par App.
export function useAppShell({
  schoolId, setSchoolId, schoolInfo, schoolInfoState,
  utilisateur, setUtilisateur, setPage, nowTs, totalElevesActifs, t,
}) {
  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  };

  // L'auteur ne remontait JAMAIS : logActionDoc accepte un 3e argument que
  // personne ne passait. On le lie ICI, une fois, plutôt que dans chacun des
  // appelants — même principe que le journal des paiements.
  const logAction = (action, details = "", auteur = utilisateur?.nom || "") =>
    logActionDoc(action, details, auteur);

  const [annee, setAnneeState] = useState(() => localStorage.getItem("LC_annee") || "2025-2026");
  // `persister` distingue DEUX gestes que l'écran confondait :
  //
  //  • AVANCER d'une année — c'est la clôture. L'année officielle de l'école
  //    change pour tout le monde : on l'enregistre.
  //  • RECULER pour consulter une année passée — c'est de la lecture. Cela ne
  //    doit RIEN changer pour les autres.
  //
  // Le recul enregistrait pourtant l'année, comme une avance. Conséquences en
  // chaîne : l'année officielle de l'école redevenait l'ancienne (pour tous
  // les comptes, y compris à l'autre bout du monde), et surtout
  // `anneeConsultee === anneeCourante` faisait retomber useEcole hors du mode
  // archive — les élèves réapparaissaient alors avec leur classe D'AUJOURD'HUI
  // au lieu de celle de l'année consultée, et les écrans redevenaient
  // modifiables sur une année censée être close.
  const setAnnee = (val, { persister = true } = {}) => {
    setAnneeState(val);
    localStorage.setItem("LC_annee", val);
    if (!persister) return;
    persisterAnnee(schoolId, val).catch(() => {
      toast("Année non enregistrée pour l'école : seule la Direction peut la modifier.", "warning");
    });
  };
  // Année scolaire PAR ÉCOLE : ecoles/{id}.anneeScolaire est la source de
  // vérité partagée entre tous les appareils/utilisateurs de l'école.
  // (Ancien design : doc global config/annee commun à TOUTES les écoles,
  // inaccessible en écriture hors superadmin → échec silencieux.)
  const anneePartagee = schoolInfoState?.anneeScolaire;
  useEffect(() => {
    if (!anneePartagee) return;
    setAnneeState(anneePartagee);
    localStorage.setItem("LC_annee", anneePartagee);
  }, [anneePartagee]);
  const planInfo = computePlanInfo({ schoolInfoState, nowTs, totalElevesActifs, t });

  const envoyerPush = (cibles, titre, corps, url = "/") => envoyerPushApi(cibles, titre, corps, url);

  const connecter = (c, sid) => {
    if (sid) { setSchoolId(sid); localStorage.setItem("LC_schoolId", sid); }
    setUtilisateur(c);
    // Module d'atterrissage : permissions du poste d'abord, repli rôle legacy.
    setPage(getPrimaryModuleForCompte(c, schoolInfo) || getPrimaryModuleForRole(c.role, schoolInfo));
    const labelConnexion = c.posteLabel || getRoleLabelForSchool(c.role, schoolInfo) || c.label || c.role;
    logAction("Connexion", `${c.nom} (${labelConnexion})`, c.nom);
    const schoolIdEffectif = sid || localStorage.getItem("LC_schoolId");
    if (schoolIdEffectif) sAbonnerAuxPush(c, schoolIdEffectif);
  };

  const deconnecter = () => {
    signOutSession().catch(() => {});
    setUtilisateur(null);
    setPage(null);
  };

  return { toasts, toast, logAction, annee, setAnnee, planInfo, envoyerPush, connecter, deconnecter };
}
