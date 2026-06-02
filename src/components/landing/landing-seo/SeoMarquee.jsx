import { MODULES } from "../landing-content";

// Bandeau défilant des modules (boucle continue).
export function SeoMarquee() {
  return (
    <div className="landing-marquee" aria-hidden="true">
      <div className="landing-marquee-track">
        {[...MODULES, ...MODULES].map((module, idx) => (
          <span key={`${module.title}-${idx}`} className="landing-marquee-item">
            <span className="landing-marquee-dot" />
            {module.title}
          </span>
        ))}
      </div>
    </div>
  );
}
