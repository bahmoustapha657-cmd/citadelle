import { Sidebar } from "../app/Sidebar";
import { useMessagerie } from "../messagerie/messagerie-contexte";

// Menu latéral du portail enseignant : la barre latérale des autres comptes
// (app/Sidebar), nourrie des entrées du portail. « Mes fiches » est un lien
// externe : il ne change pas d'onglet.
export function PortailMenu({
  schoolInfo, annee, nomEns, matiere, c2, utilisateur, deconnecter, estHorsLigne, t,
  tab, setTab, ouvrirMesFiches, estMobile, menuOuvert, setMenuOuvert,
}) {
  const messagerie = useMessagerie();

  const entrees = [
    { id: "dashboard", icon: "🏠", libelle: t("teacher.tabs.overview") },
    { id: "fiches", icon: "📚", libelle: <>{t("teacher.tabs.lessonPlans")} <span aria-hidden="true">↗</span></> },
    { id: "edt", icon: "📅", libelle: t("teacher.tabs.schedule") },
    { id: "notes", icon: "📝", libelle: t("teacher.tabs.grades") },
    { id: "eleves", icon: "👥", libelle: t("teacher.tabs.students") },
    { id: "absences", icon: "📋", libelle: t("teacher.tabs.rollRegister") },
    { id: "salaire", icon: "💰", libelle: t("accounting.tabs.salaries") },
    ...(messagerie ? [{ id: "messages", icon: "💬", libelle: t("teacher.tabs.messages") }] : []),
  ];

  return (
    <>
      {estMobile && menuOuvert && (
        <div onClick={() => setMenuOuvert(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      )}
      <Sidebar
        schoolInfo={schoolInfo} couleur2={c2} annee={annee}
        modulesVisibles={entrees} page={tab}
        setPage={(id) => (id === "fiches" ? ouvrirMesFiches() : setTab(id))}
        isMobile={estMobile} sidebarOuvert={menuOuvert} setSidebarOuvert={setMenuOuvert}
        msgsNonLus={messagerie?.nonLus || 0}
        utilisateur={{ ...utilisateur, nom: nomEns || utilisateur?.nom || "" }}
        utilisateurLabel={matiere || t("teacher.header.teacher")}
        deconnecter={deconnecter} estHorsLigne={estHorsLigne} t={t}
      />
    </>
  );
}
