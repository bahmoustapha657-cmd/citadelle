import { GlobalStyles } from "../styles";
import { LANDING_STYLES } from "./landing/landing-styles";
import { useLandingReveal } from "./landing/landing-helpers";
import { LandingNav } from "./landing/LandingNav";
import { LandingHero } from "./landing/LandingHero";
import { LandingSeoSections } from "./landing/LandingSeoSections";
import { LandingAdaptabilite } from "./landing/LandingAdaptabilite";
import { LandingValueSections } from "./landing/LandingValueSections";
import { LandingTarifs } from "./landing/LandingTarifs";
import { LandingFaqCta } from "./landing/LandingFaqCta";
import { LandingFooter } from "./landing/LandingFooter";

// Orchestrateur de la landing : chaque section vit dans landing/Landing*.jsx,
// le contenu dans landing-content.js, les styles dans landing-styles.js.
function LandingEduGest({ onConnexion, onInscription, onDemo }) {
  useLandingReveal();

  return (
    <div className="landing-root" style={{ minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff", overflowX: "hidden", position: "relative" }}>
      <GlobalStyles />
      <style>{LANDING_STYLES}</style>

      <LandingNav onConnexion={onConnexion} onInscription={onInscription} onDemo={onDemo} />
      <LandingHero onInscription={onInscription} onDemo={onDemo} />
      <LandingSeoSections />
      <LandingAdaptabilite />
      <LandingValueSections />
      <LandingTarifs onInscription={onInscription} />
      <LandingFaqCta onConnexion={onConnexion} onInscription={onInscription} onDemo={onDemo} />
      <LandingFooter onConnexion={onConnexion} onInscription={onInscription} onDemo={onDemo} />
    </div>
  );
}

export { LandingEduGest };
