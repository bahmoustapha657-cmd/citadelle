// ── Compteur tenu à jour ────────────────────────────────────────────────────
// Un total (les élèves actifs, que plafonne le plan) compté au montage puis
// RECOMPTÉ à chaque changement que signale `surveiller` : ajout, départ,
// réintégration, promotion, sur ce poste comme sur un autre. Pur (aucun
// import) : testable sous Node.
//   • Rafales coalescées : un import Excel de 300 élèves ne relance qu'un
//     comptage par fenêtre de `delaiMs`, et toujours un APRÈS le dernier
//     changement signalé.
//   • Deux comptages en vol peuvent revenir dans le désordre : un résultat
//     plus ancien que celui déjà publié est ignoré.
//   • Un comptage en échec ne publie rien : la dernière valeur connue reste.
// Renvoie la fonction d'arrêt.
export function suivreCompteur({ compter, surveiller, onValeur, delaiMs = 600 }) {
  let actif = true;
  let timer = null;
  let demandes = 0;
  let publie = 0;

  const recompter = async () => {
    const n = ++demandes;
    try {
      const valeur = await compter();
      if (actif && n > publie && Number.isFinite(valeur)) {
        publie = n;
        onValeur(valeur);
      }
    } catch { /* dernière valeur connue conservée */ }
  };
  const signaler = () => {
    if (!actif || timer) return;
    timer = setTimeout(() => { timer = null; recompter(); }, delaiMs);
  };

  recompter();
  const detacher = surveiller(signaler);
  return () => {
    actif = false;
    clearTimeout(timer);
    detacher?.();
  };
}
