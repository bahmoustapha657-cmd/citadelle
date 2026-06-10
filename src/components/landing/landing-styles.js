// Styles CSS-in-JS de la landing (animations sobres, hover effects, marquee,
// accordéon FAQ, footer, optimisations mobile). Sorti du composant pour
// réduire sa taille — le composant n'a qu'à injecter <style>{LANDING_STYLES}</style>.
//
// Ligne directrice : finition « SaaS premium » professionnelle — animations
// discrètes (fade/reveal), pas d'effets gadgets, hiérarchie typographique nette.

export const LANDING_STYLES = `
  /* ── Fond premium : mesh gradient sombre + grille subtile ── */
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

  /* index.css teinte h1/h2 via --text-h (sombre en mode clair) :
     la landing est toujours sur fond sombre, on force le blanc. */
  .landing-root h1,
  .landing-root h2,
  .landing-root h3 {
    color: #fff;
  }

  /* ── Animations (volontairement sobres) ── */
  @keyframes landingFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes landingFloat {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -12px, 0); }
  }

  @keyframes landingScaleIn {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes landingTickerPing {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.35); opacity: 0.55; }
  }

  @keyframes landingMarquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .landing-fade-up {
    opacity: 0;
    animation: landingFadeUp 700ms cubic-bezier(.22,.8,.36,1) forwards;
  }

  .landing-delay-1 { animation-delay: 80ms; }
  .landing-delay-2 { animation-delay: 160ms; }
  .landing-delay-3 { animation-delay: 240ms; }
  .landing-delay-4 { animation-delay: 320ms; }

  .landing-blob {
    animation: landingFloat 9s ease-in-out infinite;
    will-change: transform;
  }

  /* Accent du titre — dégradé statique, élégant et lisible */
  .landing-title-accent {
    background: linear-gradient(120deg, #4ADEAE 0%, #00C48C 55%, #4FC3F7 120%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  /* Eyebrow commun à toutes les sections (cohérence visuelle) */
  .landing-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,196,140,0.10);
    border: 1px solid rgba(0,196,140,0.28);
    color: #2BD9A5;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    padding: 5px 14px;
    border-radius: 999px;
  }

  /* Stats du hero — apparition en scale (délais inline) */
  .landing-stat-value {
    display: inline-block;
    opacity: 0;
    animation: landingScaleIn 700ms cubic-bezier(.5, 1.4, .4, 1) forwards;
  }

  /* Pastille verte (point de connexion live) */
  .landing-ticker {
    animation: landingTickerPing 2s ease-in-out infinite;
  }

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

  /* Halo subtil au survol des cards (effet premium discret) */
  .landing-card::before,
  .landing-link-card::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(0,196,140,0) 0%, rgba(0,196,140,0.32) 50%, rgba(96,165,250,0.24) 100%);
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
      transform: translateY(-4px);
      border-color: rgba(0, 196, 140, 0.30) !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.30);
    }
    .landing-card:hover::before,
    .landing-link-card:hover::before {
      opacity: 1;
    }
  }

  /* ── Boutons ── */
  .landing-cta {
    transition: transform 200ms cubic-bezier(.4,0,.2,1), box-shadow 200ms ease, opacity 200ms ease, background 200ms ease;
    min-height: 48px;
  }

  @media (hover: hover) {
    .landing-cta:hover {
      transform: translateY(-2px);
    }
  }

  .landing-cta:active {
    transform: translateY(0) scale(0.99);
  }

  /* Bouton principal — dégradé profond + reflet au survol (pas de pulsation) */
  .landing-cta-primary {
    background: linear-gradient(135deg, #00DC9C 0%, #00C48C 50%, #009E72 100%) !important;
    box-shadow:
      0 8px 28px rgba(0,196,140,0.35),
      inset 0 1px 0 rgba(255,255,255,0.22),
      inset 0 -1px 0 rgba(0,0,0,0.15) !important;
    position: relative;
    overflow: hidden;
  }
  .landing-cta-primary::after {
    content: "";
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
    transition: left 700ms ease;
  }
  @media (hover: hover) {
    .landing-cta-primary:hover::after { left: 100%; }
    .landing-cta-primary:hover {
      box-shadow:
        0 12px 36px rgba(0,196,140,0.45),
        inset 0 1px 0 rgba(255,255,255,0.22),
        inset 0 -1px 0 rgba(0,0,0,0.15) !important;
    }
  }

  /* Bouton secondaire — verre dépoli */
  .landing-cta-secondary {
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.16) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  @media (hover: hover) {
    .landing-cta-secondary:hover {
      background: rgba(255,255,255,0.09) !important;
      border-color: rgba(255,255,255,0.28) !important;
    }
  }

  /* ── Nav ── */
  .landing-nav-btn {
    transition: background 200ms ease, border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
  }
  @media (hover: hover) {
    .landing-nav-btn:hover {
      background: rgba(255,255,255,0.11) !important;
      border-color: rgba(255,255,255,0.26) !important;
    }
  }
  .landing-nav-btn-primary {
    background: linear-gradient(135deg, #00D69A, #00A87B) !important;
    border: none !important;
    box-shadow: 0 4px 14px rgba(0,196,140,0.35);
  }
  @media (hover: hover) {
    .landing-nav-btn-primary:hover {
      background: linear-gradient(135deg, #00E5A5, #00B485) !important;
      box-shadow: 0 6px 20px rgba(0,196,140,0.5);
      transform: translateY(-1px);
    }
  }

  /* ── Ligne de réassurance sous les CTA du hero ── */
  .landing-trust-row {
    display: flex;
    gap: 22px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .landing-trust-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.55);
  }
  .landing-trust-check {
    color: #00C48C;
    font-weight: 900;
    font-size: 13px;
  }

  /* ── Reveal au scroll ── */
  .landing-reveal {
    opacity: 0;
    transform: translateY(26px);
    transition: opacity 700ms ease, transform 700ms ease;
  }

  .landing-in-view {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Maquette produit (fenêtre app) ── */
  .landing-dashboard {
    position: relative;
    margin: 48px auto 0;
    max-width: 780px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.10);
    background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025));
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(0,196,140,0.06);
    overflow: hidden;
  }

  .landing-dashboard::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(0,196,140,0.07), transparent 42%, rgba(0,140,255,0.04));
    pointer-events: none;
  }

  /* Barre de fenêtre (chrome) façon navigateur */
  .landing-dashboard-chrome {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    position: relative;
  }
  .landing-chrome-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .landing-chrome-pill {
    flex: 1;
    max-width: 320px;
    margin: 0 auto;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    padding: 5px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    white-space: nowrap;
    overflow: hidden;
  }

  .landing-grid-chip {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    border-radius: 14px;
    padding: 14px;
  }

  /* Barre de progression (taux de paiement) */
  .landing-progress {
    height: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
  }
  .landing-progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #00C48C, #34E3B0);
  }

  /* ── FAQ : accordéon professionnel ── */
  .landing-faq-item {
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    background: rgba(255,255,255,0.03);
    overflow: hidden;
    transition: border-color 250ms ease, background 250ms ease;
  }
  .landing-faq-item[open] {
    border-color: rgba(0,196,140,0.30);
    background: rgba(0,196,140,0.04);
  }
  .landing-faq-item summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 18px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    user-select: none;
  }
  .landing-faq-item summary::-webkit-details-marker { display: none; }
  .landing-faq-chevron {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.18);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    color: rgba(255,255,255,0.6);
    transition: transform 250ms ease, color 250ms ease, border-color 250ms ease;
  }
  .landing-faq-item[open] .landing-faq-chevron {
    transform: rotate(45deg);
    color: #00C48C;
    border-color: rgba(0,196,140,0.4);
  }
  .landing-faq-body {
    margin: 0;
    padding: 0 18px 18px;
    font-size: 13.5px;
    color: rgba(255,255,255,0.65);
    line-height: 1.75;
    text-align: left;
  }
  .landing-faq-item summary { text-align: left; }

  /* ── CTA final : panneau à bord dégradé ── */
  .landing-final-cta {
    position: relative;
    max-width: 880px;
    margin: 0 auto;
    border-radius: 24px;
    padding: 1px;
    background: linear-gradient(135deg, rgba(0,196,140,0.5), rgba(255,255,255,0.08) 40%, rgba(96,165,250,0.35));
  }
  .landing-final-cta-inner {
    border-radius: 23px;
    background: linear-gradient(180deg, #0B1B33, #081224);
    padding: 56px 32px 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .landing-final-cta-inner::before {
    content: "";
    position: absolute;
    top: -120px;
    left: 50%;
    transform: translateX(-50%);
    width: 460px;
    height: 240px;
    background: radial-gradient(ellipse, rgba(0,196,140,0.16) 0%, transparent 70%);
    pointer-events: none;
  }
  .landing-final-cta-inner > * { position: relative; }

  .landing-login-link {
    background: none;
    border: none;
    padding: 6px 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    transition: color 200ms ease;
  }
  .landing-login-link:hover { color: #00C48C; }

  /* ── Footer ── */
  .landing-footer {
    border-top: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    padding: 56px 24px 28px;
    text-align: left;
  }
  .landing-footer-grid {
    max-width: 1060px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.4fr 0.9fr 1.2fr 1fr;
    gap: 36px;
  }
  .landing-footer h4 {
    font-size: 11px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    font-weight: 800;
    margin: 0 0 14px;
  }
  .landing-footer-link {
    display: block;
    background: none;
    border: none;
    text-align: left;
    padding: 5px 0;
    cursor: pointer;
    color: rgba(255,255,255,0.66);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: color 200ms ease;
  }
  .landing-footer-link:hover { color: #00C48C; }
  .landing-footer-bottom {
    max-width: 1060px;
    margin: 40px auto 0;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
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
    /* La démo reste accessible via le hero et le footer */
    .landing-nav-demo { display: none !important; }

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

    .landing-trust-row { gap: 12px !important; }

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
    .landing-chrome-pill { max-width: 200px; }

    /* Sections back to mobile padding */
    .landing-section {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }

    /* Marquee : items plus rapprochés */
    .landing-marquee-track { gap: 32px !important; }
    .landing-marquee-item { font-size: 12px !important; }

    /* CTA final + footer en colonne */
    .landing-final-cta-inner { padding: 40px 20px 36px !important; }
    .landing-footer-grid { grid-template-columns: 1fr !important; gap: 28px; }
    .landing-footer-bottom { flex-direction: column; align-items: flex-start; }
  }

  @media (max-width: 420px) {
    .landing-hero h1 { font-size: clamp(26px, 8vw, 36px) !important; }
    .landing-stat-value { font-size: 18px !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .landing-fade-up,
    .landing-blob,
    .landing-stat-value,
    .landing-ticker,
    .landing-stagger > *,
    .landing-marquee-track {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }

    .landing-reveal,
    .landing-in-view {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }

    .landing-card,
    .landing-link-card,
    .landing-cta,
    .landing-faq-item,
    .landing-faq-chevron {
      transition: none !important;
    }
  }
`;
