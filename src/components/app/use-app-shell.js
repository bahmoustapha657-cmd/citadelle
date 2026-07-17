import { useEffect, useState } from "react";
import { signOutSession } from "../../backend/session";
import { getPrimaryModuleForRole, getRoleLabelForSchool } from "../../constants";
import { getPrimaryModuleForCompte } from "../../../shared/postes-config.js";
import { computePlanInfo } from "./app-shell-plan";
import {
  chargerAnnee,
  envoyerPushApi,
  logActionDoc,
  persisterAnnee,
  sAbonnerAuxPush,
  syncEcolePublic,
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

  const logAction = logActionDoc;

  const [annee, setAnneeState] = useState(() => localStorage.getItem("LC_annee") || "2025-2026");
  const setAnnee = (val) => {
    setAnneeState(val);
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
  useEffect(() => {
    // Legacy : ancien doc global, uniquement si l'école n'a pas encore
    // son propre champ (écoles existantes avant la migration).
    if (anneePartagee) return;
    chargerAnnee().then((val) => { if (val) setAnneeState(val); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planInfo = computePlanInfo({ schoolInfoState, nowTs, totalElevesActifs, t });

  // Synchronise le profil public de l'école (direction/admin uniquement).
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return undefined;
    if (!["direction", "admin"].includes(utilisateur.posteCle || utilisateur.role)) return undefined;
    let annule = false;
    (async () => {
      try {
        if (annule) return;
        await syncEcolePublic(schoolId);
      } catch {
        // Best effort only: keep the public school profile aligned.
      }
    })();
    return () => { annule = true; };
  }, [schoolId, utilisateur]);

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
