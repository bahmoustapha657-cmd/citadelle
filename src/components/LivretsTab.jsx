import { useLivretsTab } from "./livrets-tab/use-livrets-tab";
import { LivretDetail } from "./livrets-tab/LivretDetail";
import { LivretsListe } from "./livrets-tab/LivretsListe";

// Livrets scolaires : logique dans useLivretsTab, vue détail/liste selon sélection.
// `section` et `periodes` viennent du module École (prop `section` d'Ecole).
function LivretsTab({ section, periodes, cleEleves, cleNotes, matieres, maxNote, userRole, annee }) {
  const h = useLivretsTab({ section, periodes, cleEleves, cleNotes, matieres, maxNote, userRole, annee });
  return h.livretSel ? <LivretDetail h={h} /> : <LivretsListe h={h} />;
}

export { LivretsTab };
