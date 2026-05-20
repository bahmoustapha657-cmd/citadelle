// Styles CSS-in-JS de la landing (animations, hover effects, marquee,
// optimisations mobile, etc.). Sorti du composant pour réduire sa taille
// — le composant n'a qu'à injecter <style>{LANDING_STYLES}</style>.

export const LANDING_STYLES = `
  /* Background "premium" : mesh gradient sombre + grille subtile */
  .landing-root {
    background:
      radial-gradient(1200px 600px at 15% -10%, rgba(0,196,140,0.10) 0%, transparent 60%),
      radial-gradient(900px 500px at 90% 10%, rgba(96,165,250,0.08) 0%, transparent 60%),
      radial-gradient(800px 400px at 50% 110%, rgba(251,191,36,0.05) 0%, transparent 60%),
      #060F1F;
  }
  .landing-root::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%);
    z-index: 0;
  }
  .landing-root > * { position: relative; z-index: 1; }

  @keyframes landingFadeUp {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes landingFloat {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -14px, 0); }
  }

  @keyframes landingGlow {
    0%, 100% { box-shadow: 0 0 0 rgba(0, 196, 140, 0); }
    50% { box-shadow: 0 0 24px rgba(0, 196, 140, 0.22); }
  }

  @keyframes landingShimmer {
    0%   { background-position: -200% 50%; }
    100% { background-position:  200% 50%; }
  }

  @keyframes landingPulseCta {
    0%, 100% { box-shadow: 0 8px 28px rgba(0,196,140,0.35); }
    50%      { box-shadow: 0 8px 40px rgba(0,196,140,0.6), 0 0 0 6px rgba(0,196,140,0.18); }
  }

  @keyframes landingScaleIn {
    from { transform: scale(0.6); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes landingBounce {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-5px); }
  }

  @keyframes landingRise {
    0%   { transform: translate3d(0, 0, 0)   scale(1);   opacity: 0; }
    15%  { opacity: 0.8; }
    100% { transform: translate3d(0, -180px, 0) scale(1.4); opacity: 0; }
  }

  @keyframes landingScrollHint {
    0%, 100% { transform: translateY(0); opacity: 0.7; }
    50%      { transform: translateY(8px); opacity: 1; }
  }

  @keyframes landingTickerPing {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.4); opacity: 0.6; }
  }

  @keyframes landingMarquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .landing-fade-up {
    opacity: 0;
    animation: landingFadeUp 700ms ease forwards;
  }

  .landing-delay-1 { animation-delay: 80ms; }
  .landing-delay-2 { animation-delay: 160ms; }
  .landing-delay-3 { animation-delay: 240ms; }
  .landing-delay-4 { animation-delay: 320ms; }

  .landing-blob {
    animation: landingFloat 7s ease-in-out infinite;
    will-change: transform;
  }

  .landing-badge {
    animation: landingGlow 3.4s ease-in-out infinite;
  }

  /* Mots-clés du titre — gradient qui défile */
  .landing-shimmer {
    background: linear-gradient(90deg, #00C48C 0%, #60A5FA 25%, #00C48C 50%, #FBBF24 75%, #00C48C 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: landingShimmer 5s linear infinite;
  }

  /* Bouton CTA principal — pulse subtil */
  .landing-cta-primary {
    animation: landingPulseCta 2.8s ease-in-out infinite;
  }

  /* Stats du hero — apparition en scale */
  .landing-stat-value {
    display: inline-block;
    opacity: 0;
    animation: landingScaleIn 700ms cubic-bezier(.5, 1.6, .4, 1) forwards;
  }
  .landing-stat-value:nth-child(1) { animation-delay: 700ms; }
  .landing-stat-value:nth-child(2) { animation-delay: 850ms; }
  .landing-stat-value:nth-child(3) { animation-delay: 1000ms; }

  /* Indicateurs colorés du dashboard mock — bounce léger */
  .landing-bounce-1 { animation: landingBounce 2.2s ease-in-out 0s     infinite; }
  .landing-bounce-2 { animation: landingBounce 2.2s ease-in-out 0.4s  infinite; }
  .landing-bounce-3 { animation: landingBounce 2.2s ease-in-out 0.8s  infinite; }

  /* Particules flottantes en background du hero */
  .landing-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }
  .landing-particle {
    position: absolute;
    bottom: -20px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(0, 196, 140, 0.6);
    animation: landingRise 9s linear infinite;
  }
  .landing-particle.alt { background: rgba(96, 165, 250, 0.55); }
  .landing-particle.warm { background: rgba(251, 191, 36, 0.55); }

  /* Stagger — les enfants apparaissent en cascade */
  .landing-stagger > * {
    opacity: 0;
    animation: landingFadeUp 600ms ease forwards;
  }
  .landing-stagger > *:nth-child(1) { animation-delay:  60ms; }
  .landing-stagger > *:nth-child(2) { animation-delay: 140ms; }
  .landing-stagger > *:nth-child(3) { animation-delay: 220ms; }
  .landing-stagger > *:nth-child(4) { animation-delay: 300ms; }
  .landing-stagger > *:nth-child(5) { animation-delay: 380ms; }
  .landing-stagger > *:nth-child(6) { animation-delay: 460ms; }
  .landing-stagger > *:nth-child(7) { animation-delay: 540ms; }
  .landing-stagger > *:nth-child(8) { animation-delay: 620ms; }

  /* Indicateur de défilement sous le hero */
  .landing-scroll-hint {
    animation: landingScrollHint 2s ease-in-out infinite;
  }

  /* Pastille verte (point de connexion live) */
  .landing-ticker {
    animation: landingTickerPing 1.6s ease-in-out infinite;
  }

  /* Bandeau défilant (marquee) — les enfants doivent être dupliqués
     dans le markup pour que la boucle ne saute pas. */
  .landing-marquee {
    position: relative;
    overflow: hidden;
    padding: 14px 0;
    background: linear-gradient(90deg, rgba(0,196,140,0.04), rgba(96,165,250,0.04));
    border-top: 1px solid rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    mask-image: linear-gradient(90deg, transparent 0, #000 80px, #000 calc(100% - 80px), transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 80px, #000 calc(100% - 80px), transparent 100%);
  }
  .landing-marquee-track {
    display: flex;
    gap: 48px;
    width: max-content;
    align-items: center;
    animation: landingMarquee 32s linear infinite;
  }
  .landing-marquee:hover .landing-marquee-track {
    animation-play-state: paused;
  }
  .landing-marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.78);
    letter-spacing: 0.4px;
    white-space: nowrap;
  }
  .landing-marquee-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #00C48C;
    flex-shrink: 0;
  }

  .landing-card,
  .landing-link-card,
  .landing-cta {
    will-change: transform;
  }

  .landing-card,
  .landing-link-card {
    transition: transform 280ms cubic-bezier(.4,0,.2,1), border-color 280ms ease, background 280ms ease, box-shadow 280ms ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    position: relative;
  }

  /* Halo subtil au survol des cards (effet premium) */
  .landing-card::before,
  .landing-link-card::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(0,196,140,0) 0%, rgba(0,196,140,0.4) 50%, rgba(96,165,250,0.3) 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 280ms ease;
    pointer-events: none;
  }

  @media (hover: hover) {
    .landing-card:hover,
    .landing-link-card:hover {
      transform: translateY(-6px);
      border-color: rgba(0, 196, 140, 0.32) !important;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0,196,140,0.12);
    }
    .landing-card:hover::before,
    .landing-link-card:hover::before {
      opacity: 1;
    }
  }

  .landing-cta {
    transition: transform 200ms cubic-bezier(.4,0,.2,1), box-shadow 200ms ease, opacity 200ms ease;
    min-height: 48px;
  }

  @media (hover: hover) {
    .landing-cta:hover {
      transform: translateY(-2px) scale(1.015);
    }
  }

  .landing-cta:active {
    transform: translateY(0) scale(0.99);
  }

  /* Bouton CTA principal — finition premium avec lueur intérieure */
  .landing-cta-primary {
    background: linear-gradient(135deg, #00E5A3 0%, #00C48C 50%, #00956A 100%) !important;
    box-shadow:
      0 8px 32px rgba(0,196,140,0.42),
      inset 0 1px 0 rgba(255,255,255,0.25),
      inset 0 -1px 0 rgba(0,0,0,0.15) !important;
    position: relative;
    overflow: hidden;
  }
  .landing-cta-primary::after {
    content: "";
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
    transition: left 800ms ease;
  }
  @media (hover: hover) {
    .landing-cta-primary:hover::after { left: 100%; }
  }

  /* Bouton secondaire — bord lumineux */
  .landing-cta-secondary {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.18) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .landing-reveal {
    opacity: 0;
    transform: translateY(26px);
    transition: opacity 700ms ease, transform 700ms ease;
  }

  .landing-in-view {
    opacity: 1;
    transform: translateY(0);
  }

  .landing-dashboard {
    position: relative;
    margin: 44px auto 0;
    max-width: 780px;
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.09);
    background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
    overflow: hidden;
  }

  .landing-dashboard::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(0,196,140,0.08), transparent 42%, rgba(0,140,255,0.05));
    pointer-events: none;
  }

  .landing-grid-chip {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    border-radius: 14px;
    padding: 14px;
  }

  /* ─────────────────────────────────────────────────────────
     OPTIMISATIONS MOBILE
     ───────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    /* Nav plus compacte */
    .landing-nav {
      padding: 0 14px !important;
      height: 56px !important;
    }
    .landing-nav-tag { display: none !important; }
    .landing-nav button {
      padding: 7px 14px !important;
      font-size: 12px !important;
    }

    /* Hero plus aéré, moins de padding latéral */
    .landing-hero {
      padding: 56px 16px 36px !important;
    }
    .landing-hero h1 {
      letter-spacing: -0.5px !important;
    }

    /* CTA plein largeur, bien tactiles */
    .landing-cta-row {
      flex-direction: column !important;
      gap: 10px !important;
      width: 100%;
    }
    .landing-cta {
      width: 100% !important;
      justify-content: center;
    }

    /* Dashboard mock empilé en colonne */
    .landing-dashboard-grid {
      grid-template-columns: 1fr !important;
    }
    .landing-dashboard {
      margin-top: 32px !important;
    }
    .landing-dashboard-header {
      flex-direction: column;
      align-items: flex-start !important;
      gap: 8px;
    }

    /* Sections back to mobile padding */
    .landing-section {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }

    /* Marquee : items plus rapprochés */
    .landing-marquee-track { gap: 32px !important; }
    .landing-marquee-item { font-size: 12px !important; }

    /* Particules : moins nombreuses (perf) */
    .landing-particle:nth-child(n+5) { display: none; }
  }

  @media (max-width: 420px) {
    .landing-hero h1 { font-size: clamp(26px, 8vw, 36px) !important; }
    .landing-stat-value { font-size: 18px !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .landing-fade-up,
    .landing-blob,
    .landing-badge,
    .landing-shimmer,
    .landing-cta-primary,
    .landing-stat-value,
    .landing-bounce-1,
    .landing-bounce-2,
    .landing-bounce-3,
    .landing-particle,
    .landing-scroll-hint,
    .landing-ticker,
    .landing-stagger > *,
    .landing-marquee-track {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }

    .landing-shimmer {
      color: #00C48C !important;
      -webkit-text-fill-color: #00C48C !important;
      background: none !important;
    }

    .landing-reveal,
    .landing-in-view {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }

    .landing-card,
    .landing-link-card,
    .landing-cta {
      transition: none !important;
    }
  }
`;
