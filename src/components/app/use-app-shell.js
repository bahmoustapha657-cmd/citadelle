import { useEffect, useState } from "react";
import { signOutCurrentUser } from "../../firebaseAuth";
import { getPrimaryModuleForRole, getRoleLabelForSchool } from "../../constants";
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
    persisterAnnee(val);
  };
  useEffect(() => {
    chargerAnnee().then((val) => { if (val) setAnneeState(val); });
  }, []);

  const planInfo = computePlanInfo({ schoolInfoState, nowTs, totalElevesActifs, t });

  // Synchronise le profil public de l'école (direction/admin uniquement).
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return undefined;
    if (!["direction", "admin"].includes(utilisateur.role)) return undefined;
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
    setPage(getPrimaryModuleForRole(c.role, schoolInfo));
    const labelConnexion = getRoleLabelForSchool(c.role, schoolInfo) || c.label || c.role;
    logAction("Connexion", `${c.nom} (${labelConnexion})`, c.nom);
    const schoolIdEffectif = sid || localStorage.getItem("LC_schoolId");
    if (schoolIdEffectif) sAbonnerAuxPush(c, schoolIdEffectif);
  };

  const deconnecter = () => {
    signOutCurrentUser().catch(() => {});
    setUtilisateur(null);
    setPage(null);
  };

  return { toasts, toast, logAction, annee, setAnnee, planInfo, envoyerPush, connecter, deconnecter };
}
