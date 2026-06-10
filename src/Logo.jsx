/**
 * Logo EduGest — badge d'application moderne : carré arrondi en dégradé vert,
 * livre ouvert surmonté d'une toque de diplômé (tassel doré), wordmark épuré.
 * variant="light" → "Edu" en blanc  (pour fonds sombres : sidebar, gradient)
 * variant="dark"  → "Edu" en navy   (pour fonds clairs : page blanche)
 */
export default function Logo({ width = 130, height = 42, variant = "light" }) {
  const eduColor = variant === "dark" ? "#0A1628" : "#F8FAF9";
  const uid = `lg-${variant}`; // ids de defs uniques par variant

  return (
    <svg
      viewBox="0 0 500 160"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="EduGest"
    >
      <defs>
        <linearGradient id={`${uid}-badge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00DC9C" />
          <stop offset="1" stopColor="#00916B" />
        </linearGradient>
        <linearGradient id={`${uid}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D2EFE3" />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#022C1F" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* ── Badge carré arrondi ── */}
      <rect x="20" y="20" width="120" height="120" rx="30" fill={`url(#${uid}-badge)`} filter={`url(#${uid}-shadow)`} />
      {/* Liseré lumineux + reflet haut (relief) */}
      <rect x="21" y="21" width="118" height="118" rx="29" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M24 78 L24 50 Q24 24 50 24 L110 24 Q136 24 136 50 L136 78 Q80 64 24 78 Z" fill="#FFFFFF" opacity="0.07" />

      {/* ── Ombre portée du livre ── */}
      <ellipse cx="80" cy="118" rx="31" ry="4.5" fill="#022C1F" opacity="0.22" />

      {/* ── Livre ouvert ── */}
      <path d="M80 79 C72 71 60 68 47 71 L47 107 C60 104 72 107 80 115 Z" fill={`url(#${uid}-page)`} />
      <path d="M80 79 C88 71 100 68 113 71 L113 107 C100 104 88 107 80 115 Z" fill={`url(#${uid}-page)`} />
      {/* Ombre de pliure côté droit (profondeur) */}
      <path d="M80 79 C88 71 100 68 113 71 L113 107 C100 104 88 107 80 115 Z" fill="#0A1628" opacity="0.05" />
      {/* Lignes de texte suggérées */}
      <path d="M53 79 C61 77.5 69 79 75 83" stroke="#0A1628" strokeOpacity="0.16" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M53 87 C61 85.5 69 87 75 91" stroke="#0A1628" strokeOpacity="0.12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M107 79 C99 77.5 91 79 85 83" stroke="#0A1628" strokeOpacity="0.16" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M107 87 C99 85.5 91 87 85 91" stroke="#0A1628" strokeOpacity="0.12" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Reliure centrale */}
      <path d="M80 79 L80 115" stroke="#04321F" strokeOpacity="0.30" strokeWidth="2.5" strokeLinecap="round" />

      {/* ── Toque de diplômé ── */}
      {/* Coiffe (bandeau) */}
      <path d="M67 56 L93 56 L93 68 C93 72.5 67 72.5 67 68 Z" fill="#0A1C36" />
      {/* Plateau (mortier) */}
      <path d="M80 35 L118 50 L80 65 L42 50 Z" fill="#0F2440" />
      <path d="M80 38.5 L112.5 50 L80 61.5 L47.5 50 Z" fill="#FFFFFF" opacity="0.06" />
      {/* Bouton central */}
      <circle cx="80" cy="50" r="3" fill="#FFB547" />
      {/* Tassel doré */}
      <path d="M118 50 C119.5 56 119.5 61 118.5 66" stroke="#FFB547" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="118.5" cy="69.5" r="4.5" fill="#FFB547" />
      <path d="M116.5 72.5 L116.5 76 M118.5 73.5 L118.5 77 M120.5 72.5 L120.5 76" stroke="#E89A2B" strokeWidth="1.6" strokeLinecap="round" />

      {/* ── Wordmark EduGest ── */}
      <text
        y="101"
        fontFamily="'Segoe UI', 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif"
        fontWeight="800"
        fontSize="56"
        letterSpacing="-1.5"
      >
        <tspan x="158" fill={eduColor}>Edu</tspan>
        <tspan fill="#00C48C">Gest</tspan>
      </text>
      <text
        x="161"
        y="124"
        fontFamily="'Segoe UI', 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif"
        fontWeight="600"
        fontSize="15.5"
        letterSpacing="5.2"
        fill={eduColor}
        opacity="0.55"
      >
        GESTION SCOLAIRE
      </text>
    </svg>
  );
}
