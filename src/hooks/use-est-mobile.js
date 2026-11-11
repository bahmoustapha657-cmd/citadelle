import { useEffect, useState } from "react";

// Écran étroit (< 768 px), même seuil que la coquille principale
// (usePwaState) : le menu latéral s'y replie derrière le bouton ☰.
export function useEstMobile() {
  const [estMobile, setEstMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const surRedimension = () => setEstMobile(window.innerWidth < 768);
    window.addEventListener("resize", surRedimension);
    return () => window.removeEventListener("resize", surRedimension);
  }, []);
  return estMobile;
}
