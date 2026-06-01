import { ActivationSection } from "./accueil-tab/ActivationSection";
import { TextesSection } from "./accueil-tab/TextesSection";
import { BanniereSection } from "./accueil-tab/BanniereSection";
import { GalerieSection } from "./accueil-tab/GalerieSection";
import { HonneursSection } from "./accueil-tab/HonneursSection";
import { ContactSection } from "./accueil-tab/ContactSection";
import { HonneurModale } from "./accueil-tab/HonneurModale";

// Onglet "Accueil" de ParametresEcole.
// Configure la page d'accueil publique de l'école (vitrine avant
// connexion) : activation, slogan/texte, bannière, galerie photos,
// tableau d'honneur, sections visibles, contact.
export function AccueilTab({
  accueil, setAccueil, chgA, handleBanniere, handlePhotoGalerie,
  honneurs, ajHonneur, modHonneur, supHonneur, formHonneur, setFormHonneur,
  modalH, setModalH, toast, inp, lbl, sec,
}) {
  return (
    <>
      <ActivationSection accueil={accueil} setAccueil={setAccueil} sec={sec} />
      <TextesSection accueil={accueil} chgA={chgA} inp={inp} lbl={lbl} sec={sec} />
      <BanniereSection accueil={accueil} setAccueil={setAccueil} handleBanniere={handleBanniere} inp={inp} lbl={lbl} sec={sec} />
      <GalerieSection accueil={accueil} setAccueil={setAccueil} handlePhotoGalerie={handlePhotoGalerie} inp={inp} sec={sec} />
      <HonneursSection accueil={accueil} chgA={chgA} honneurs={honneurs} setFormHonneur={setFormHonneur} setModalH={setModalH} supHonneur={supHonneur} sec={sec} />
      <ContactSection accueil={accueil} chgA={chgA} inp={inp} lbl={lbl} sec={sec} />
      {modalH && <HonneurModale
        modalH={modalH} setModalH={setModalH} formHonneur={formHonneur} setFormHonneur={setFormHonneur}
        ajHonneur={ajHonneur} modHonneur={modHonneur} toast={toast} inp={inp} lbl={lbl}
      />}
    </>
  );
}
