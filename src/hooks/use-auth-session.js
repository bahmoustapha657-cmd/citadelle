import { useEffect, useState } from "react";
import { watchAuthState } from "../backend/auth-supabase";
import { powerSyncConfigured, moduleDisponibleHorsLigne } from "../backend/powersync/tables";
import { getPrimaryModuleForRole } from "../constants";
import { getPrimaryModuleForCompte, getOfflineModuleForCompte } from "../../shared/postes-config.js";
import { protegerDonneesLocales } from "../stockage-persistant";

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
// (feature désactivée par défaut) — zéro coût réseau en plus du zéro coût de
// bundle.
const connectPowerSync = (uid) => (powerSyncConfigured
  ? import("../backend/powersync/client").then((m) => m.connectPowerSync(uid))
  : Promise.resolve());
const disconnectPowerSync = () => (powerSyncConfigured
  ? import("../backend/powersync/client").then((m) => m.disconnectPowerSync())
  : Promise.resolve());

// Hook qui synchronise l'état utilisateur + page courante avec la session
// Supabase. La session fournit l'utilisateur complet (construit depuis la
// table `comptes`) :
// - si pas connecté : reset utilisateur/page, synchro hors ligne coupée
// - sinon : injecte schoolId + page initiale, connecte la synchro hors ligne.
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
// Landing ouverte par le lien ?decouvrir : ce n'est pas un module, une
// session restaurée part sur sa page initiale, et l'absence de session à
// l'ouverture ne la referme pas.
const PAGE_DECOUVRIR = "decouvrir";

export function useAuthSession({ setSchoolId, setPage }) {
  const [utilisateur, setUtilisateur] = useState(null);

  useEffect(() => {
    let actif = true;
    let unsub = () => {};

    watchAuthState((u) => {
      if (!actif) return;
      if (!u) {
        setUtilisateur(null);
        setPage((p) => (p === PAGE_DECOUVRIR ? p : null));
        // Coupe la synchro sans vider le miroir : le même compte retrouvera
        // ses données au retour (cf. powersync/proprietaire.js).
        disconnectPowerSync().catch(() => {});
        return;
      }
      if (u.schoolId) {
        setSchoolId(u.schoolId);
        localStorage.setItem("LC_schoolId", u.schoolId);
      }
      // Même compte que celui déjà affiché (ex. posé par le formulaire de
      // connexion, puis confirmé par l'événement d'auth) : on garde l'objet
      // pour ne pas relancer les chargements qui dépendent de l'utilisateur.
      setUtilisateur((prec) => (prec && JSON.stringify(prec) === JSON.stringify(u) ? prec : u));
      setPage((p) => (p && p !== PAGE_DECOUVRIR ? p : choisirPageInitiale(u)));
      // Mode hors ligne (vague 1 = académique) : personnel + enseignants
      // seulement. Les PARENTS ne se connectent PAS à PowerSync — leur
      // périmètre (leurs enfants) n'est pas couvert par les Sync Rules, qui
      // synchroniseraient sinon toute l'école. (Portail parent = vague 2.)
      if (u.role !== "parent") {
        connectPowerSync(u.uid).catch(() => {});
        // Miroir, saisies non envoyées et photos : à protéger contre
        // l'effacement par le navigateur quand le disque se remplit.
        protegerDonneesLocales();
      }
    }).then((cleanup) => {
      if (actif) unsub = cleanup; else cleanup();
    }).catch(() => {});

    return () => { actif = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { utilisateur, setUtilisateur };
}
