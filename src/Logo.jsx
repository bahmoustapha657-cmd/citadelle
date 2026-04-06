/**
 * Logo EduGest
 * variant="light" → "Edu" en blanc  (pour fonds sombres : sidebar, gradient)
 * variant="dark"  → "Edu" en navy   (pour fonds clairs : page blanche)
 */
export default function Logo({ width = 130, height = 42, variant = "light" }) {
  const eduColor = variant === "dark" ? "#0A1628" : "#F8FAF9";
  const id = `hc-${variant}`; // id clipPath unique par variant

  return (
    <svg
      viewBox="0 0 500 160"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="EduGest"
    >
      <defs>
        <clipPath id={id}>
          <polygon points="75,20 127,50 127,110 75,140 23,110 23,50" />
        </clipPath>
      </defs>

      {/* ── Hexagone ── */}
      <polygon
        points="75,20 127,50 127,110 75,140 23,110 23,50"
        fill="#F8FAF9"
      />

      {/* ── Pages de livre (clippées dans l'hexagone) ── */}
      <g clipPath={`url(#${id})`}>
        {/* Page gauche */}
        <rect
          x="26" y="42" width="42" height="84" rx="5"
          fill="#00C48C"
          transform="rotate(-8, 47, 84)"
        />
        {/* Page droite */}
        <rect
          x="72" y="42" width="42" height="84" rx="5"
          fill="#00A876"
          transform="rotate(8, 93, 84)"
        />
        {/* Reflet central (spine) */}
        <rect x="71" y="44" width="8" height="80" fill="#F8FAF9" opacity="0.18"/>
      </g>

      {/* ── Étoile dorée ── */}
      <circle cx="108" cy="36" r="8" fill="#FFB547" />
      {/* 4 petites lignes */}
      <line x1="108" y1="18" x2="108" y2="27" stroke="#FFB547" strokeWidth="4" strokeLinecap="round" />
      <line x1="108" y1="45" x2="108" y2="54" stroke="#FFB547" strokeWidth="4" strokeLinecap="round" />
      <line x1="90"  y1="36" x2="99"  y2="36" stroke="#FFB547" strokeWidth="4" strokeLinecap="round" />
      <line x1="117" y1="36" x2="126" y2="36" stroke="#FFB547" strokeWidth="4" strokeLinecap="round" />

      {/* ── Texte EduGest ── */}
      <text
        y="113"
        fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif"
        fontWeight="900"
        fontSize="58"
      >
        <tspan x="150" fill={eduColor}>Edu</tspan>
        <tspan fill="#00C48C">Gest</tspan>
      </text>
    </svg>
  );
}
