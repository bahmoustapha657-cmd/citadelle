import { useEffect, useState } from "react";
import { isSupabase } from "../backend";
import { powerSyncConfigured } from "../backend/powersync/tables";

// Nombre de changements locaux pas encore remontés à Supabase (mode hors
// ligne, vague 1). No-op côté Firebase et si PowerSync n'est pas configuré
// (VITE_POWERSYNC_URL vide) : renvoie toujours 0, sans coût — le module lourd
// (@powersync/web/wa-sqlite) n'est chargé en `import()` que si les deux
// conditions ci-dessous sont réunies.
export function usePowerSyncStatus() {
  const [syncPendantes, setSyncPendantes] = useState(0);

  useEffect(() => {
    if (!isSupabase || !powerSyncConfigured) return;
    let actif = true;
    let unsub = null;
    let timer = null;

    import("../backend/powersync/client").then(({ getPowerSync }) => {
      if (!actif) return;
      const ps = getPowerSync();

      const rafraichir = async () => {
        try {
          const stats = await ps.getUploadQueueStats();
          if (actif) setSyncPendantes(stats?.count || 0);
        } catch { /* base locale pas encore prête */ }
      };

      unsub = ps.registerListener?.({ statusChanged: rafraichir });
      rafraichir();
      timer = window.setInterval(rafraichir, 5000);
    });

    return () => { actif = false; unsub?.(); if (timer) window.clearInterval(timer); };
  }, []);

  return { syncPendantes };
}
