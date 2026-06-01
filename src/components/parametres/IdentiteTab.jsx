import { InfosGeneralesSection } from "./identite-tab/InfosGeneralesSection";
import { CouleursSection } from "./identite-tab/CouleursSection";
import { LogoSection } from "./identite-tab/LogoSection";
import { AnneePeriodiciteSection } from "./identite-tab/AnneePeriodiciteSection";

// Onglet "Identité" de ParametresEcole : informations générales, couleurs, logo,
// mois de début d'année et périodicité. Aiguille form/setForm/chg + les handlers
// (logo, couleurs détectées, migration) vers chaque section.
export function IdentiteTab({
  form,
  setForm,
  chg,
  schoolInfo,
  apercu,
  handleLogoFile,
  resetLogo,
  couleursDetectees,
  setCouleursDetectees,
  appliquerCouleursDetectees,
  setMigrationOuverte,
  inp,
  lbl,
  sec,
}) {
  return (
    <>
      <InfosGeneralesSection form={form} setForm={setForm} chg={chg} inp={inp} lbl={lbl} sec={sec} />
      <CouleursSection form={form} chg={chg} inp={inp} lbl={lbl} sec={sec} />
      <LogoSection
        form={form}
        setForm={setForm}
        apercu={apercu}
        handleLogoFile={handleLogoFile}
        resetLogo={resetLogo}
        couleursDetectees={couleursDetectees}
        setCouleursDetectees={setCouleursDetectees}
        appliquerCouleursDetectees={appliquerCouleursDetectees}
        inp={inp}
        lbl={lbl}
        sec={sec}
      />
      <AnneePeriodiciteSection form={form} chg={chg} schoolInfo={schoolInfo} setMigrationOuverte={setMigrationOuverte} inp={inp} sec={sec} />
    </>
  );
}
