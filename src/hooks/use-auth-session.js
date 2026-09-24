import { useEffect, useState } from "react";
import { watchAuthState } from "../backend/auth-supabase";
import { powerSyncConfigured, moduleDisponibleHorsLigne } from "../backend/powersync/tables";
import { getPrimaryModuleForRole } from "../constants";
import { getPrimaryModuleForCompte, getOfflineModuleForCompte } from "../../shared/postes-config.js";

// Page d'atterrissage : module principal habituel, SAUF si l'app démarre sans
// réseau et que ce module n'est pas utilisable hors ligne — dans ce cas on
// bascule sur un module académique accessible (élèves/notes) pour éviter
// d'ouvrir un écran voué aux erreurs réseau (mode hors ligne, vague 1).
function choisirPageInitiale(u) {
  const principal = getPrimaryModuleForCompte(u) || getPrimaryModuleForRole(u.role);
  if (
    powerSyncConfigured && u.role !== "parent"
    && !navigator.onLine && !moduleDisponibleHorsLigne(principal)
  ) {
    return getOfflineModuleForCompte(u) || principal;
  }
  return principal;
}

// `import()` dynamique + garde `powerSyncConfigured` : évite de charger
// @powersync/web/wa-sqlite tant que VITE_POWERSYNC_URL n'est pas renseigné
// (fonctionnalité désactivée par défaut) — ni bundle, ni requête.
const connectPowerSync = () => (powerSyncConfigured
  ? import("../backend/powersync/client").then((m) => m.connectPowerSync())
  : Promise.resolve());
const disconnectPowerSync = () => (powerSyncConfigured
  ? import("../backend/powersync/client").then((m) => m.disconnectPowerSync())
  : Promise.resolve());

// Hook qui synchronise l'état utilisateur + page courante avec la session.
// La session Supabase fournit déjà l'utilisateur complet, construit depuis la
// table `comptes` (rôle, poste, périmètre) — il n'y a pas de second aller-retour
// pour aller chercher un profil, contrairement au chemin Firebase qui lisait
// /users/{uid} après coup.
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useAuthSession({ setSchoolId, setPage }) {
  const [utilisateur, setUtilisateur] = useState(null);

  useEffect(() => {
    let actif = true;
    let unsub = () => {};

    watchAuthState((u) => {
      if (!actif) return;
      if (!u) {
        setUtilisateur(null);
        setPage(null);
        disconnectPowerSync().catch(() => {});
        return;
      }
      if (u.schoolId) {
        setSchoolId(u.schoolId);
        localStorage.setItem("LC_schoolId", u.schoolId);
      }
      setUtilisateur(u);
      setPage((p) => p || choisirPageInitiale(u));
      // Mode hors ligne (vague 1 = académique) : personnel + enseignants
      // seulement. Les PARENTS ne se connectent PAS à PowerSync — leur
      // périmètre (leurs enfants) n'est pas couvert par les Sync Rules, qui
      // synchroniseraient sinon toute l'école. (Portail parent = vague 2.)
      if (u.role !== "parent") connectPowerSync().catch(() => {});
    }).then((cleanup) => {
      if (actif) unsub = cleanup; else cleanup();
    }).catch(() => {});

    return () => { actif = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { utilisateur, setUtilisateur };
}
