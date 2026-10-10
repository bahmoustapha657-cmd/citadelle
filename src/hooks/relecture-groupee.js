// Relecture après écriture, GROUPÉE. Chaque écriture de useFirestore attend
// une relecture complète de la collection avant de rendre la main (l'appelant
// retrouve sa ligne dans la liste). Lancées en parallèle, N écritures
// donnaient N relectures de toute l'année : une grille de 30 notes relisait
// 30 fois les ~6 700 notes.
//
// Ici, au plus UNE relecture tourne, et au plus UNE autre attend derrière :
//   • aucune en cours → on la lance ;
//   • une en cours → elle a pu partir AVANT notre écriture, on ne peut pas
//     s'y fier : on attend la suivante, partagée par toutes les écritures
//     terminées pendant ce temps.
// Chaque appelant obtient donc une relecture lancée APRÈS son écriture, comme
// avant, mais 30 écritures ne coûtent plus que 2 ou 3 relectures.
export function creerRelectureGroupee(lire) {
  let enCours = null;
  let suivante = null;

  const lancer = () => {
    const p = Promise.resolve().then(() => lire());
    enCours = p;
    const liberer = () => { if (enCours === p) enCours = null; };
    p.then(liberer, liberer);
    return p;
  };

  return function relire() {
    if (suivante) return suivante;
    if (!enCours) return lancer();
    const attendue = enCours;
    suivante = attendue.then(() => {}, () => {}).then(() => {
      suivante = null;
      return lancer();
    });
    return suivante;
  };
}
