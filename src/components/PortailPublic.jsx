import { useState, useEffect, useContext } from "react";
import { fetchAnnoncesPubliques } from "../backend/portail-public-supabase";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { GlobalStyles } from "../styles";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HeroSection } from "./portail-public/HeroSection";
import { AnnoncesSection } from "./portail-public/AnnoncesSection";
import { HonneursSection } from "./portail-public/HonneursSection";
import { GalerieSection } from "./portail-public/GalerieSection";
import { ContactSection } from "./portail-public/ContactSection";
import { PublicFooter } from "./portail-public/PublicFooter";

// Portail public d'une école : page d'accueil en sections (hero, annonces,
// honneurs, galerie, contact). Aiguille les données vers chaque section.
function PortailPublic({ onConnexion }) {
  const { schoolId, schoolInfo } = useContext(SchoolContext);
  const { items: honneurs } = useFirestore("honneurs");

  // Annonces : le visiteur n'est pas authentifié, il ne peut donc lire aucune
  // table (la RLS des annonces est réservée au personnel — et c'est voulu, les
  // annonces aux parents ne doivent pas fuiter). La RPC ne renvoie que celles
  // marquées « publique ». Lisait FIRESTORE jusqu'ici, donc ne ramenait plus
  // rien depuis la migration (liquidation Firebase, lot 4).
  const [annonces, setAnnonces] = useState([]);
  useEffect(() => {
    if (!schoolId) return undefined;
    let actif = true;
    fetchAnnoncesPubliques(schoolId).then((liste) => { if (actif) setAnnonces(liste); });
    return () => { actif = false; };
  }, [schoolId]);

  const acc = schoolInfo.accueil || {};
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const [galIndex, setGalIndex] = useState(null); // lightbox
  const photos = acc.photos || [];
  const annoncesPub = annonces.filter(a => a.date).sort((a, b) => b.date - a.date).slice(0, 4);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#0A1628" }}>
      <GlobalStyles />
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50 }}>
        <LanguageSwitcher compact />
      </div>

      <HeroSection schoolInfo={schoolInfo} acc={acc} c1={c1} c2={c2} onConnexion={onConnexion} />
      <AnnoncesSection acc={acc} c1={c1} c2={c2} annoncesPub={annoncesPub} />
      <HonneursSection acc={acc} c1={c1} c2={c2} honneurs={honneurs} />
      <GalerieSection photos={photos} c2={c2} galIndex={galIndex} setGalIndex={setGalIndex} />
      <ContactSection acc={acc} c1={c1} c2={c2} />
      <PublicFooter schoolInfo={schoolInfo} c2={c2} />
    </div>
  );
}

export { PortailPublic };
