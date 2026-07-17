import { useTranslation } from "react-i18next";
import { Tabs } from "./ui";
import { useEcole } from "./ecole/use-ecole";
import { EcoleHeader } from "./ecole/EcoleHeader";
import { EcoleTabContent } from "./ecole/EcoleTabContent";

// Onglets visibles par le surveillant général (discipline des deux sections).
const TABS_SURVEILLANT = new Set(["eleves", "discipline", "emploidutemps"]);

// Orchestrateur du module École : la logique vit dans useEcole, l'en-tête dans
// EcoleHeader et l'aiguillage des onglets dans EcoleTabContent.
function Ecole({ titre, couleur, cleClasses, cleEns, cleNotes, cleEleves, avecEns, userRole, permissions = null, annee, classesPredefinies, maxNote = 20, matieresPredefinies = [], readOnly = false, verrouOuvert = false }) {
  const { t } = useTranslation();
  const e = useEcole({ cleClasses, cleEns, cleNotes, cleEleves, userRole, permissions, annee, readOnly, verrouOuvert });

  const tabItems = [
    { id: "apercu", label: t("school.tabs.overview") },
    { id: "classes", label: `${t("school.tabs.classes")} (${e.classes.length})` },
    { id: "eleves", label: `${t("school.tabs.students")} (${e.eleves.length})` },
    ...(avecEns ? [{ id: "ens", label: `${t("school.tabs.teachers")} (${e.ens.length})` }] : []),
    { id: "notes", label: `${t("school.tabs.notes")} (${e.notes.length})` },
    { id: "enseignements", label: t("school.tabs.teachings") },
    { id: "discipline", label: t("school.tabs.discipline") },
    { id: "bulletins", label: t("school.tabs.bulletins") },
    { id: "livrets", label: "📋 Livrets" },
    { id: "matieres", label: t("school.tabs.subjects") },
    ...(avecEns ? [{ id: "emploidutemps", label: t("school.tabs.schedule") }] : []),
    { id: "attestations", label: t("school.tabs.certificates") },
    // Surveillance générale : périmètre discipline uniquement — élèves
    // (lecture + impression des listes), absences et emploi du temps.
    // Les notes/bulletins lui sont aussi refusés côté règles serveur.
  ].filter((item) => userRole !== "surveillant" || TABS_SURVEILLANT.has(item.id));

  return (
    <div style={{ padding: "22px 26px" }}>
      <EcoleHeader e={e} titre={titre} couleur={couleur} readOnly={readOnly} />
      <Tabs items={tabItems} actif={e.tab} onChange={e.setTab} />
      <EcoleTabContent
        e={e}
        avecEns={avecEns}
        userRole={userRole}
        annee={annee}
        classesPredefinies={classesPredefinies}
        maxNote={maxNote}
        matieresPredefinies={matieresPredefinies}
        readOnly={readOnly}
        cleEns={cleEns}
        cleNotes={cleNotes}
        cleEleves={cleEleves}
        couleur={couleur}
      />
    </div>
  );
}

export { Ecole };
