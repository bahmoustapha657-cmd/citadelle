import { useLivretsTab } from "./livrets-tab/use-livrets-tab";
import { LivretDetail } from "./livrets-tab/LivretDetail";
import { LivretsListe } from "./livrets-tab/LivretsListe";

// Livrets scolaires : logique dans useLivretsTab, vue détail/liste selon sélection.
function LivretsTab({ cleEleves, cleNotes, matieres, maxNote, userRole, annee }) {
  const h = useLivretsTab({ cleEleves, cleNotes, matieres, maxNote, userRole, annee });
  return h.livretSel ? <LivretDetail h={h} /> : <LivretsListe h={h} />;
}

export { LivretsTab };
