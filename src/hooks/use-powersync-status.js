import { useEffect, useState } from "react";
import { powerSyncConfigured } from "../backend/powersync/tables";
import { compterPhotosEnAttente } from "../photos-hors-ligne";

// État du mode hors ligne (PowerSync). No-op si PowerSync n'est pas configuré
// (VITE_POWERSYNC_URL vide) : rien en attente, pas de synchro en cours, sans
// coût — le module lourd (@powersync/web/wa-sqlite) n'est chargé en
// `import()` que s'il l'est.
//   • syncPendantes : changements locaux pas encore remontés à Supabase,
//     photos d'élèves en attente d'envoi comprises.
//   • premiereSynchro : null, ou { fraction (0 → 1), essentielPret } tant que
//     le miroir de cet appareil n'a jamais été complet — première connexion
//     d'un compte sur l'appareil. L'écran dit ce qui manque encore.
export function usePowerSyncStatus() {
  const [syncPendantes, setSyncPendantes] = useState(0);
  const [premiereSynchro, setPremiereSynchro] = useState(null);

  useEffect(() => {
    if (!powerSyncConfigured) return;
    let actif = true;
    let unsub = null;
    let timer = null;

    import("../backend/powersync/client").then(({ getPowerSync }) => {
      if (!actif) return;
      const ps = getPowerSync();

      const rafraichir = async () => {
        if (!actif) return;
        const statut = ps.currentStatus;
        // hasSynced vaut undefined tant que la base locale s'ouvre : on
        // n'affiche rien plutôt qu'une fausse alerte.
        if (statut?.hasSynced === false) {
          const fraction = statut.downloadProgress?.downloadedFraction || 0;
          // Priorité 1 des règles de synchro (élèves, classes, école,
          // comptabilité) déjà livrée : les écrans sont utilisables, seuls
          // les notes et les modules secondaires arrivent encore.
          const essentielPret = !!statut.statusForPriority?.(1)?.hasSynced;
          setPremiereSynchro((prec) => (prec?.fraction === fraction && prec?.essentielPret === essentielPret
            ? prec : { fraction, essentielPret }));
        } else {
          setPremiereSynchro(null);
        }
        try {
          const stats = await ps.getUploadQueueStats();
          // + photos d'élèves prises hors ligne, pas encore envoyées.
          const photos = await compterPhotosEnAttente();
          if (actif) setSyncPendantes((stats?.count || 0) + photos);
        } catch { /* base locale pas encore prête */ }
      };

      unsub = ps.registerListener?.({ statusChanged: rafraichir });
      rafraichir();
      timer = window.setInterval(rafraichir, 5000);
    });

    return () => { actif = false; unsub?.(); if (timer) window.clearInterval(timer); };
  }, []);

  return { syncPendantes, premiereSynchro };
}
