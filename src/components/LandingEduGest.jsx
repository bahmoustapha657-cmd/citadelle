import React, { useEffect } from "react";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import Logo from "../Logo";

const modules = [
  {
    title: "Primaire",
    description: "Classes, notes, bulletins, absences et emplois du temps pour la maternelle et le primaire.",
  },
  {
    title: "Secondaire",
    description: "Collège et lycée avec matières, coefficients, moyennes et bulletins trimestriels.",
  },
  {
    title: "Comptabilité",
    description: "Scolarités, salaires, personnel, recettes, dépenses et suivi des impayés.",
  },
  {
    title: "Portail enseignant",
    description: "Emploi du temps, saisie des notes et suivi des paies dans un espace dédié.",
  },
  {
    title: "Portail parent",
    description: "Notes, absences, bulletins, paiements et messages depuis un seul compte.",
  },
  {
    title: "Communication",
    description: "Annonces, messagerie et informations de l'école diffusées simplement.",
  },
];

const avantages = [
  {
    title: "Démarrage rapide",
    description: "Votre espace école peut être opérationnel le jour même, sans installation lourde.",
  },
  {
    title: "Identité personnalisée",
    description: "Logo, couleurs et informations de l'école apparaissent partout de façon cohérente.",
  },
  {
    title: "Données cloisonnées",
    description: "Chaque école reste isolée, chaque rôle ne voit que son périmètre utile.",
  },
  {
    title: "Accès mobile",
    description: "L'application fonctionne sur ordinateur, tablette et téléphone, sans installation spéciale.",
  },
];

const situations = [
  {
    situation: "Un parent réclame un reçu de l'année dernière",
    avant: "Recherche manuelle dans les cahiers et les dossiers.",
    apres: "Reçu retrouvé et imprimé en quelques secondes.",
  },
  {
    situation: "Le comptable est absent",
    avant: "La caisse reste difficile à relire ou à vérifier.",
    apres: "La direction garde une vue claire sur l'état des comptes.",
  },
  {
    situation: "Un parent veut savoir s'il est à jour",
    avant: "Discussion longue et vérification manuelle.",
    apres: "Le parent voit son historique et son solde dans son portail.",
  },
];

const seoPoints = [
  "Logiciel de gestion scolaire pour école privée en Guinée",
  "Gestion des notes, bulletins et moyennes par classe",
  "Comptabilité scolaire avec reçus, salaires et impayés",
  "Emplois du temps, examens et portail parent / enseignant",
];

const faqItems = [
  {
    question: "À qui s'adresse EduGest ?",
    answer: "EduGest s'adresse aux écoles primaires, collèges, lycées et groupes scolaires privés qui veulent gérer élèves, notes, bulletins, comptabilité et emplois du temps dans un seul outil.",
  },
  {
    question: "Est-ce adapté aux écoles en Guinée ?",
    answer: "Oui. EduGest est pensé pour les réalités des écoles en Guinée et en Afrique de l'Ouest, avec une approche simple pour la direction, la comptabilité, les enseignants et les parents.",
  },
  {
    question: "Quelles fonctions sont les plus utiles ?",
    answer: "Les écoles utilisent surtout la gestion des élèves, la saisie des notes, les bulletins, la comptabilité scolaire, les paiements, les emplois du temps et les portails parent et enseignant.",
  },
];

const seoLinks = [
  {
    title: "Logiciel de gestion scolaire en Guinée",
    href: "/logiciel-gestion-scolaire-guinee.html",
    description: "Une page dédiée pour les directions qui recherchent une solution complète pour primaire, collège et lycée.",
  },
  {
    title: "Gestion des notes et bulletins",
    href: "/gestion-des-notes-et-bulletins.html",
    description: "Une page ciblée sur la saisie des notes, les moyennes et l'impression des bulletins scolaires.",
  },
  {
    title: "Comptabilité scolaire",
    href: "/comptabilite-scolaire.html",
    description: "Une page centrée sur les reçus, paiements, impayés, salaires et suivi comptable de l'école.",
  },
];

const articleLinks = [
  {
    title: "Comment calculer un bulletin scolaire",
    href: "/comment-calculer-un-bulletin-scolaire.html",
  },
  {
    title: "Comment gérer les impayés scolaires",
    href: "/comment-gerer-les-impayes-scolaires.html",
  },
];

const offres = [
  {
    name: "Gratuit",
    price: "0 GNF / mois",
    features: ["Jusqu'à 50 élèves", "Notes et bulletins", "Une section active", "Support de base"],
    highlight: false,
  },
  {
    name: "Starter",
    price: "100 000 GNF / mois",
    features: ["Jusqu'à 200 élèves", "Primaire et collège", "Comptabilité de base", "Portail enseignant"],
    highlight: false,
  },
  {
    name: "Standard",
    price: "200 000 GNF / mois",
    features: ["Jusqu'à 500 élèves", "Toutes les sections", "Comptabilité complète", "Portail parent et enseignant"],
    highlight: true,
  },
  {
    name: "Premium",
    price: "500 000 GNF / mois",
    features: ["Élèves illimités", "Toutes les fonctions", "Personnalisation avancée", "Support prioritaire"],
    highlight: false,
  },
];

const heroStats = [
  { value: "3 min", label: "pour ouvrir une école" },
  { value: "100%", label: "des modules réunis" },
  { value: "24/7", label: "accès direction et parents" },
];

function cardStyle(borderColor = "rgba(255,255,255,0.08)", background = "rgba(255,255,255,0.04)") {
  return {
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    padding: "20px 18px",
  };
}

function LandingEduGest({ onConnexion, onInscription }) {
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

  return (
    <div style={{ minHeight: "100vh", background: "#0A1628", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff", overflowX: "hidden" }}>
      <GlobalStyles />
      <style>{`
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

        .landing-card,
        .landing-link-card,
        .landing-cta {
          will-change: transform;
        }

        .landing-card,
        .landing-link-card {
          transition: transform 220ms ease, border-color 220ms ease, background 220ms ease, box-shadow 220ms ease;
        }

        .landing-card:hover,
        .landing-link-card:hover {
          transform: translateY(-5px);
          border-color: rgba(0, 196, 140, 0.24) !important;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
        }

        .landing-cta {
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
        }

        .landing-cta:hover {
          transform: translateY(-2px) scale(1.01);
        }

        .landing-cta:active {
          transform: translateY(0) scale(0.995);
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
          .landing-stagger > * {
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
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,22,40,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo width={150} height={42} variant="light" />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>SaaS scolaire</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onConnexion} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Connexion
          </button>
          <button onClick={onInscription} style={{ background: "#00C48C", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Créer mon école
          </button>
        </div>
      </nav>

      <section style={{ padding: "84px 24px 56px", textAlign: "center", maxWidth: 920, margin: "0 auto", position: "relative" }}>
        <div className="landing-blob" style={{ position: "absolute", top: -40, left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,196,140,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div className="landing-blob" style={{ position: "absolute", top: 60, right: "5%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,140,255,0.09) 0%,transparent 70%)", pointerEvents: "none", animationDelay: "-2.8s" }} />

        {/* Particules flottantes en background — montent du bas */}
        <div className="landing-particles" aria-hidden="true">
          <span className="landing-particle"      style={{ left: "8%",  animationDelay: "0s"   }} />
          <span className="landing-particle alt"  style={{ left: "18%", animationDelay: "1.4s" }} />
          <span className="landing-particle"      style={{ left: "28%", animationDelay: "3s"   }} />
          <span className="landing-particle warm" style={{ left: "42%", animationDelay: "0.7s" }} />
          <span className="landing-particle"      style={{ left: "55%", animationDelay: "2.2s" }} />
          <span className="landing-particle alt"  style={{ left: "68%", animationDelay: "4s"   }} />
          <span className="landing-particle warm" style={{ left: "78%", animationDelay: "1s"   }} />
          <span className="landing-particle"      style={{ left: "90%", animationDelay: "2.7s" }} />
        </div>

        <div className="landing-fade-up landing-badge" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
          <span className="landing-ticker" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#00C48C", letterSpacing: "0.5px" }}>Conçu pour les écoles d'Afrique de l'Ouest</span>
        </div>

        <h1 className="landing-fade-up landing-delay-1" style={{ position: "relative", fontSize: "clamp(30px,6vw,56px)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 18px", letterSpacing: "-1px" }}>
          La gestion scolaire <span className="landing-shimmer">claire</span>, <span className="landing-shimmer">complète</span> et <span className="landing-shimmer">fiable</span>
        </h1>
        <p className="landing-fade-up landing-delay-2" style={{ position: "relative", fontSize: "clamp(14px,2.5vw,18px)", color: "rgba(255,255,255,0.62)", maxWidth: 620, margin: "0 auto 36px", lineHeight: 1.7 }}>
          EduGest est un logiciel de gestion scolaire pour les écoles en Guinée. Il aide les directions, comptables, enseignants et parents à suivre les élèves, les notes, les bulletins, les paiements et les emplois du temps dans un seul outil simple à prendre en main.
        </p>

        <div className="landing-fade-up landing-delay-3" style={{ position: "relative", display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="landing-cta landing-cta-primary" onClick={onInscription} style={{ background: "linear-gradient(135deg,#00C48C,#00a876)", border: "none", color: "#fff", padding: "15px 36px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,196,140,0.35)", letterSpacing: 0.3 }}>
            Créer mon école gratuitement
          </button>
          <button className="landing-cta" onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "15px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Se connecter
          </button>
        </div>
        <p className="landing-fade-up landing-delay-4" style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Inscription gratuite - aucune carte bancaire requise</p>

        <div className="landing-fade-up landing-delay-4 landing-dashboard" style={{ padding: "18px 18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 16, position: "relative" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1.3px", fontWeight: 800 }}>Vue direction</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Votre école, en un seul tableau clair</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="landing-bounce-1" style={{ width: 10, height: 10, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
              <span className="landing-bounce-2" style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
              <span className="landing-bounce-3" style={{ width: 10, height: 10, borderRadius: "50%", background: "#60A5FA", display: "inline-block" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, position: "relative" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="landing-grid-chip" style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.45)", fontWeight: 800 }}>Aujourd'hui</div>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                  {heroStats.map((stat, idx) => (
                    <div key={stat.label}>
                      <div className="landing-stat-value" style={{ fontSize: 22, fontWeight: 900, color: "#00C48C", animationDelay: `${700 + idx * 150}ms` }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", lineHeight: 1.5 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="landing-grid-chip" style={{ textAlign: "left", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Notes</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Bulletins prêts</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Paiements</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Suivi instantané</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>EDT</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Vue par section</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="landing-grid-chip" style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Aperçu</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.62)" }}>Encaissements</span>
                    <strong>+ 4 aujourd'hui</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.62)" }}>Salaires</span>
                    <strong>Prêts à imprimer</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.62)" }}>Parents</span>
                    <strong>Portail actif</strong>
                  </div>
                </div>
              </div>
              <div className="landing-grid-chip" style={{ textAlign: "left", background: "linear-gradient(135deg, rgba(0,196,140,0.14), rgba(96,165,250,0.09))" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Promesse EduGest</div>
                <div style={{ marginTop: 8, fontSize: 17, fontWeight: 800, lineHeight: 1.4 }}>Moins de confusion, plus de visibilité pour la direction, les enseignants et les parents.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "0 24px 46px", maxWidth: 980, margin: "0 auto" }}>
        <div className="landing-card" style={{ ...cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Logiciel de gestion scolaire pour primaire, collège et lycée
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>
            EduGest aide les écoles privées à gérer les inscriptions, les notes, les bulletins scolaires, la comptabilité, les salaires, les paiements, les absences et les emplois du temps.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 1.6 }}>
            {seoPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
        <div className="landing-card" style={{ ...cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Ressources utiles sur EduGest
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Ces pages détaillées permettent de mieux présenter les usages d'EduGest et les besoins des écoles auxquelles la plateforme s'adresse.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {seoLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="landing-link-card"
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "#fff",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: "18px 16px",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: "#00C48C", marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.65 }}>{item.description}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
        <div className="landing-card" style={{ ...cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Articles conseils pour les écoles
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Ces articles répondent à des questions très fréquentes des directions et montrent plus clairement l'expertise d'EduGest sur la gestion scolaire.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {articleLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="landing-link-card"
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "#fff",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: "18px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "0 24px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {modules.map((module) => (
            <div key={module.title} className="landing-card" style={cardStyle()}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{module.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{module.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "42px 24px 60px", background: "rgba(0,196,140,0.05)", borderTop: "1px solid rgba(0,196,140,0.12)", borderBottom: "1px solid rgba(0,196,140,0.12)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>Pourquoi choisir EduGest ?</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 34 }}>Un produit terrain, pensé pour les besoins réels des écoles.</p>
          <div className="landing-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {avantages.map((item) => (
              <div key={item.title} className="landing-card" style={cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)")}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#00C48C", marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "60px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span style={{ display: "inline-block", background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", color: "#00C48C", fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20 }}>Notre obsession</span>
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3.5vw,30px)", fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
          La transparence comptable. <span style={{ color: "#00C48C" }}>Tout est tracé.</span>
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 700, margin: "0 auto 34px", lineHeight: 1.65 }}>
          EduGest aide la direction à savoir ce qui entre, ce qui sort et qui a fait quoi, sans dépendre d'un cahier ou d'une mémoire incertaine.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {situations.map((item) => (
            <div key={item.situation} className="landing-card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px", alignItems: "start" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.5 }}>{item.situation}</div>
              <div style={{ fontSize: 12, color: "rgba(239,68,68,0.85)", lineHeight: 1.6, paddingLeft: 10, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(239,68,68,0.7)", letterSpacing: "1px", marginBottom: 4 }}>AVANT</div>
                {item.avant}
              </div>
              <div style={{ fontSize: 12, color: "rgba(0,196,140,0.95)", lineHeight: 1.6, paddingLeft: 10, borderLeft: "2px solid rgba(0,196,140,0.5)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#00C48C", letterSpacing: "1px", marginBottom: 4 }}>AVEC EDUGEST</div>
                {item.apres}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "58px 24px", maxWidth: 1060, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8 }}>Tarification transparente</h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 36 }}>Démarrez gratuitement, puis évoluez selon la taille de votre école.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {offres.map((plan) => (
            <div key={plan.name} className="landing-card" style={{ ...cardStyle(plan.highlight ? "#8b5cf6" : "rgba(255,255,255,0.12)", plan.highlight ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)"), boxShadow: plan.highlight ? "0 0 40px rgba(139,92,246,0.2)" : "none" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: plan.highlight ? "#c4b5fd" : "rgba(255,255,255,0.8)", marginBottom: 6 }}>{plan.name}</div>
              <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{plan.price}</div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "16px 0" }} />
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ color: plan.highlight ? "#c4b5fd" : "#00C48C", fontWeight: 800, marginTop: 1, flexShrink: 0 }}>-</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="landing-cta" onClick={onInscription} style={{ width: "100%", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", background: plan.highlight ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "rgba(255,255,255,0.08)", border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                Choisir {plan.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "24px 24px 70px", maxWidth: 980, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>
          Questions fréquentes sur EduGest
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 28 }}>
          Les réponses les plus utiles pour comprendre le logiciel de gestion scolaire.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {faqItems.map((item) => (
            <div key={item.question} className="landing-card" style={cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)")}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800 }}>{item.question}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section data-landing-reveal className="landing-reveal" style={{ padding: "54px 24px 80px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 900, marginBottom: 14 }}>Prêt à digitaliser votre école ?</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 30 }}>Lancez un espace propre, simple et adapté à votre réalité terrain.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="landing-cta" onClick={onInscription} style={{ background: "linear-gradient(135deg,#00C48C,#00a876)", border: "none", color: "#fff", padding: "16px 42px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,196,140,0.35)" }}>
            Créer mon école gratuitement
          </button>
          <button className="landing-cta" onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Se connecter
          </button>
        </div>
      </section>
    </div>
  );
}

export { LandingEduGest };

