import { useEffect } from "react";
import { powerSyncConfigured } from "../backend/powersync/tables";
import { envoyerPhotosEleves } from "../storageUtils";
import { prechargerPhotos } from "../photos-hors-ligne";

// Toutes les 2 minutes, au retour du réseau et peu après l'ouverture :
//   1. envoi des photos d'élèves prises hors ligne (ou sur réseau trop lent) ;
//   2. mise en cache des photos et du logo pas encore présents sur l'appareil,
//      pour qu'ils s'affichent hors ligne même jamais vus ici.
// Personnel et enseignants seulement (les parents ne passent pas par le
// miroir local ni par la prise de photo).
const PERIODE_MS = 2 * 60 * 1000;
const PREMIER_PASSAGE_MS = 5000;

// URL des photos d'élèves et du logo, lues dans le miroir local — une fois la
// première synchro terminée : pendant celle-ci, le réseau lui est réservé.
async function photosDuMiroir() {
  if (!powerSyncConfigured) return [];
  const { getPowerSync } = await import("../backend/powersync/client");
  const ps = getPowerSync();
  if (!ps.currentStatus?.hasSynced) return [];
  const lignes = await ps.getAll(
    `SELECT photo AS url FROM eleves WHERE photo LIKE 'https://%'
     UNION SELECT logo AS url FROM ecoles WHERE logo LIKE 'https://%'`,
  );
  return lignes.map((l) => l.url);
}

export function usePhotosHorsLigne(utilisateur) {
  const schoolId = utilisateur?.schoolId || null;
  const concerne = !!schoolId &&!["parent", "superadmin"].includes(utilisateur?.role);

  useEffect(() => {
    if (!concerne) return undefined;
    let arrete = false;
    const passer = async () => {
      if (arrete || !navigator.onLine) return;
      try { await envoyerPhotosEleves(schoolId); } catch { /* réessai au prochain passage */ }
      try { if (!arrete) await prechargerPhotos(await photosDuMiroir()); } catch { /* idem */ }
    };
    const premier = setTimeout(passer, PREMIER_PASSAGE_MS);
    const minuteur = setInterval(passer, PERIODE_MS);
    window.addEventListener("online", passer);
    return () => {
      arrete = true;
      clearTimeout(premier);
      clearInterval(minuteur);
      window.removeEventListener("online", passer);
    };
  }, [concerne, schoolId]);
}
