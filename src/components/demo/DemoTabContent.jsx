import { NotesView } from "./tabs/NotesView";
import { EdtView } from "./tabs/EdtView";
import { DisciplineView } from "./tabs/DisciplineView";
import { ComptaView } from "./tabs/ComptaView";
import { EnseignantView } from "./tabs/EnseignantView";
import { ParentsView } from "./tabs/ParentsView";
import { DirectionView } from "./tabs/DirectionView";

// Aiguillage des vues de démonstration selon l'onglet. Chaque vue est dans
// demo/tabs/.
export function DemoTabContent({ tab, onApercuBulletin }) {
  if (tab === "notes") return <NotesView onApercuBulletin={onApercuBulletin} />;
  if (tab === "edt") return <EdtView />;
  if (tab === "discipline") return <DisciplineView />;
  if (tab === "compta") return <ComptaView />;
  if (tab === "enseignant") return <EnseignantView />;
  if (tab === "parents") return <ParentsView />;
  return <DirectionView />;
}
