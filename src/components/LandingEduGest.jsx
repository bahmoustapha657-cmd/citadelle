import React from "react";
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
    description: "College et lycee avec matieres, coefficients, moyennes et bulletins trimestriels.",
  },
  {
    title: "Comptabilite",
    description: "Scolarites, salaires, personnel, recettes, depenses et suivi des impayes.",
  },
  {
    title: "Portail enseignant",
    description: "Emploi du temps, saisie des notes et suivi des paies dans un espace dedie.",
  },
  {
    title: "Portail parent",
    description: "Notes, absences, bulletins, paiements et messages depuis un seul compte.",
  },
  {
    title: "Communication",
    description: "Annonces, messagerie et informations de l'ecole diffusees simplement.",
  },
];

const avantages = [
  {
    title: "Demarrage rapide",
    description: "Votre espace ecole peut etre operationnel le jour meme, sans installation lourde.",
  },
  {
    title: "Identite personnalisee",
    description: "Logo, couleurs et informations de l'ecole apparaissent partout de facon coherente.",
  },
  {
    title: "Donnees cloisonnees",
    description: "Chaque ecole reste isolee, chaque role ne voit que son perimetre utile.",
  },
  {
    title: "Acces mobile",
    description: "L'application fonctionne sur ordinateur, tablette et telephone, sans installation speciale.",
  },
];

const situations = [
  {
    situation: "Un parent reclame un recu de l'annee derniere",
    avant: "Recherche manuelle dans les cahiers et les dossiers.",
    apres: "Recu retrouve et imprime en quelques secondes.",
  },
  {
    situation: "Le comptable est absent",
    avant: "La caisse reste difficile a relire ou a verifier.",
    apres: "La direction garde une vue claire sur l'etat des comptes.",
  },
  {
    situation: "Un parent veut savoir s'il est a jour",
    avant: "Discussion longue et verification manuelle.",
    apres: "Le parent voit son historique et son solde dans son portail.",
  },
];

const seoPoints = [
  "Logiciel de gestion scolaire pour ecole privee en Guinee",
  "Gestion des notes, bulletins et moyennes par classe",
  "Comptabilite scolaire avec recus, salaires et impayes",
  "Emplois du temps, examens et portail parent / enseignant",
];

const faqItems = [
  {
    question: "A qui s'adresse EduGest ?",
    answer: "EduGest s'adresse aux ecoles primaires, colleges, lycees et groupes scolaires prives qui veulent gerer eleves, notes, bulletins, comptabilite et emplois du temps dans un seul outil.",
  },
  {
    question: "Est-ce adapte aux ecoles en Guinee ?",
    answer: "Oui. EduGest est pense pour les realites des ecoles en Guinee et en Afrique de l'Ouest, avec une approche simple pour la direction, la comptabilite, les enseignants et les parents.",
  },
  {
    question: "Quelles fonctions sont les plus utiles ?",
    answer: "Les ecoles utilisent surtout la gestion des eleves, la saisie des notes, les bulletins, la comptabilite scolaire, les paiements, les emplois du temps et les portails parent et enseignant.",
  },
];

const seoLinks = [
  {
    title: "Logiciel de gestion scolaire en Guinee",
    href: "/logiciel-gestion-scolaire-guinee.html",
    description: "Une page dediee pour les directions qui recherchent une solution complete pour primaire, college et lycee.",
  },
  {
    title: "Gestion des notes et bulletins",
    href: "/gestion-des-notes-et-bulletins.html",
    description: "Une page ciblee sur la saisie des notes, les moyennes et l'impression des bulletins scolaires.",
  },
  {
    title: "Comptabilite scolaire",
    href: "/comptabilite-scolaire.html",
    description: "Une page centree sur les recus, paiements, impayes, salaires et suivi comptable de l'ecole.",
  },
];

const localLinks = [
  {
    title: "Logiciel pour ecole privee a Conakry",
    href: "/logiciel-ecole-privee-conakry.html",
  },
  {
    title: "Logiciel pour ecole privee a Kindia",
    href: "/logiciel-ecole-privee-kindia.html",
  },
  {
    title: "Logiciel pour ecole privee a Labe",
    href: "/logiciel-ecole-privee-labe.html",
  },
];

const offres = [
  {
    name: "Gratuit",
    price: "0 GNF / mois",
    features: ["Jusqu'a 50 eleves", "Notes et bulletins", "Une section active", "Support de base"],
    highlight: false,
  },
  {
    name: "Starter",
    price: "100 000 GNF / mois",
    features: ["Jusqu'a 200 eleves", "Primaire et college", "Comptabilite de base", "Portail enseignant"],
    highlight: false,
  },
  {
    name: "Standard",
    price: "200 000 GNF / mois",
    features: ["Jusqu'a 500 eleves", "Toutes les sections", "Comptabilite complete", "Portail parent et enseignant"],
    highlight: true,
  },
  {
    name: "Premium",
    price: "500 000 GNF / mois",
    features: ["Eleves illimites", "Toutes les fonctions", "Personnalisation avancee", "Support prioritaire"],
    highlight: false,
  },
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
  return (
    <div style={{ minHeight: "100vh", background: "#0A1628", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff", overflowX: "hidden" }}>
      <GlobalStyles />

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
            Creer mon ecole
          </button>
        </div>
      </nav>

      <section style={{ padding: "84px 24px 56px", textAlign: "center", maxWidth: 920, margin: "0 auto", position: "relative" }}>
        <div style={{ position: "absolute", top: -40, left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,196,140,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 60, right: "5%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,140,255,0.09) 0%,transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#00C48C", letterSpacing: "0.5px" }}>Concu pour les ecoles d'Afrique de l'Ouest</span>
        </div>

        <h1 style={{ fontSize: "clamp(30px,6vw,56px)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 18px", letterSpacing: "-1px" }}>
          La gestion scolaire <span style={{ color: "#00C48C" }}>claire</span>, <span style={{ color: "#00C48C" }}>complete</span> et <span style={{ color: "#00C48C" }}>fiable</span>
        </h1>
        <p style={{ fontSize: "clamp(14px,2.5vw,18px)", color: "rgba(255,255,255,0.62)", maxWidth: 620, margin: "0 auto 36px", lineHeight: 1.7 }}>
          EduGest est un logiciel de gestion scolaire pour les ecoles en Guinee. Il aide les directions, comptables, enseignants et parents a suivre les eleves, les notes, les bulletins, les paiements et les emplois du temps dans un seul outil simple a prendre en main.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onInscription} style={{ background: "linear-gradient(135deg,#00C48C,#00a876)", border: "none", color: "#fff", padding: "15px 36px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,196,140,0.35)", letterSpacing: 0.3 }}>
            Creer mon ecole gratuitement
          </button>
          <button onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "15px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Se connecter
          </button>
        </div>
        <p style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Inscription gratuite - aucune carte bancaire requise</p>
      </section>

      <section style={{ padding: "0 24px 46px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ ...cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Logiciel de gestion scolaire pour primaire, college et lycee
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>
            EduGest aide les ecoles privees a gerer les inscriptions, les notes, les bulletins scolaires, la comptabilite, les salaires, les paiements, les absences et les emplois du temps.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 1.6 }}>
            {seoPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ ...cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Ressources utiles sur EduGest
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Ces pages detaillees aident aussi Google a mieux comprendre ce que fait EduGest et a quelles ecoles la plateforme s'adresse.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {seoLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
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

      <section style={{ padding: "0 24px 52px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ ...cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)") }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800 }}>
            Pages locales pour les ecoles en Guinee
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Si une direction cherche un logiciel pour ecole privee dans une ville precise, ces pages locales aident Google a faire le lien.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {localLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 999,
                  textDecoration: "none",
                  color: "#fff",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {modules.map((module) => (
            <div key={module.title} style={cardStyle()}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{module.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{module.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "42px 24px 60px", background: "rgba(0,196,140,0.05)", borderTop: "1px solid rgba(0,196,140,0.12)", borderBottom: "1px solid rgba(0,196,140,0.12)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>Pourquoi choisir EduGest ?</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 34 }}>Un produit terrain, pense pour les besoins reels des ecoles.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {avantages.map((item) => (
              <div key={item.title} style={cardStyle("rgba(0,196,140,0.18)", "rgba(255,255,255,0.03)")}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#00C48C", marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span style={{ display: "inline-block", background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.3)", color: "#00C48C", fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20 }}>Notre obsession</span>
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3.5vw,30px)", fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
          La transparence comptable. <span style={{ color: "#00C48C" }}>Tout est trace.</span>
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 700, margin: "0 auto 34px", lineHeight: 1.65 }}>
          EduGest aide la direction a savoir ce qui entre, ce qui sort et qui a fait quoi, sans dependre d'un cahier ou d'une memoire incertaine.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {situations.map((item) => (
            <div key={item.situation} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px", alignItems: "start" }}>
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

      <section style={{ padding: "58px 24px", maxWidth: 1060, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8 }}>Tarification transparente</h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 36 }}>Demarrez gratuitement, puis evoluez selon la taille de votre ecole.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {offres.map((plan) => (
            <div key={plan.name} style={{ ...cardStyle(plan.highlight ? "#8b5cf6" : "rgba(255,255,255,0.12)", plan.highlight ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)"), boxShadow: plan.highlight ? "0 0 40px rgba(139,92,246,0.2)" : "none" }}>
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
              <button onClick={onInscription} style={{ width: "100%", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", background: plan.highlight ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "rgba(255,255,255,0.08)", border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                Choisir {plan.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px 24px 70px", maxWidth: 980, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 10 }}>
          Questions frequentes sur EduGest
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 28 }}>
          Les reponses les plus utiles pour comprendre le logiciel de gestion scolaire.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {faqItems.map((item) => (
            <div key={item.question} style={cardStyle("rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)")}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800 }}>{item.question}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "54px 24px 80px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 900, marginBottom: 14 }}>Pret a digitaliser votre ecole ?</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 30 }}>Lancez un espace propre, simple et adapte a votre realite terrain.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onInscription} style={{ background: "linear-gradient(135deg,#00C48C,#00a876)", border: "none", color: "#fff", padding: "16px 42px", borderRadius: 30, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,196,140,0.35)" }}>
            Creer mon ecole gratuitement
          </button>
          <button onClick={onConnexion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 32px", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Se connecter
          </button>
        </div>
      </section>
    </div>
  );
}

export { LandingEduGest };
