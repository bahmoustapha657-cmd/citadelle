import { useEffect } from "react";

// Style de carte réutilisé par toutes les sections de la landing.
export function cardStyle(borderColor = "rgba(255,255,255,0.08)", background = "rgba(255,255,255,0.04)") {
  return {
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    padding: "20px 18px",
  };
}

// Révèle les sections [data-landing-reveal] quand elles entrent dans le viewport.
export function useLandingReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-landing-reveal]"));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("landing-in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -40px 0px" });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}
