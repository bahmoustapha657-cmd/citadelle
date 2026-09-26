// Attente de la file d'envoi PowerSync, isolée de client.js pour être testée
// sans charger @powersync/web (tests/comptes-parents.test.js).
// `lireStats` : () => Promise<{ count }> (getUploadQueueStats). Renvoie true
// dès que la file est vide — ou illisible : rien à attendre —, false si elle
// ne l'est toujours pas au bout de `delaiMs`. Chaque lecture est bornée : une
// base locale qui ne s'ouvre pas ne bloque pas l'appelant indéfiniment.
export async function attendreFileVide(lireStats, delaiMs = 15000, pauseMs = 400) {
  const fin = Date.now() + delaiMs;
  for (;;) {
    const restant = fin - Date.now();
    if (restant <= 0) return false;
    let stats;
    try {
      stats = await Promise.race([
        lireStats(),
        new Promise((resolve) => setTimeout(() => resolve(null), restant)),
      ]);
    } catch {
      return true;
    }
    if (!stats) return false;
    if (!stats.count) return true;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
}
