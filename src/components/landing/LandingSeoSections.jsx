import { SeoMarquee } from "./landing-seo/SeoMarquee";
import { SeoIntroSection } from "./landing-seo/SeoIntroSection";
import { SeoRessourcesSection } from "./landing-seo/SeoRessourcesSection";
import { SeoArticlesSection } from "./landing-seo/SeoArticlesSection";
import { SeoModulesSection } from "./landing-seo/SeoModulesSection";

export function LandingSeoSections() {
  return (
    <>
      <SeoMarquee />
      <SeoIntroSection />
      <SeoRessourcesSection />
      <SeoArticlesSection />
      <SeoModulesSection />
    </>
  );
}
