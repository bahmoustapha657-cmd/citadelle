import { useContext } from "react";
import { C } from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { Btn, Card, Chargement, Tabs } from "./ui";
import { useStatistiques } from "./statistiques/use-statistiques";
import { VueAssiduite, VueEffectifs, VueEnseignants, VueFinances, VueResultats } from "./statistiques/StatsVues";

// ══════════════════════════════════════════════════════════════
//  STATISTIQUES AVANCÉES — réservé au plan Premium
// ══════════════════════════════════════════════════════════════
// Ce module croise TOUTES les sections, ce qui le distingue de l'Aperçu :
// celui-ci ne voit qu'un cycle à la fois. Les analyses de résultats
// réutilisent apercu-tab/analytics.js et les finances getMensualiteOverview,
// pour qu'un chiffre affiché ici ne puisse jamais contredire un bulletin ou
// l'écran Comptabilité.
//
// ⚠️ Le verrou premium est ici une affaire d'INTERFACE. Contrairement aux
// notifications et à l'IA, dont l'autorité est l'Edge Function côté serveur,
// ces analyses sont calculées dans le navigateur à partir de données que
// l'école possède déjà : rien de confidentiel n'est révélé par un
// contournement, seule la présentation est réservée.

const ONGLETS = [
  { id: "resultats", label: "📊 Résultats" },
  { id: "assiduite", label: "🗓️ Assiduité" },
  { id: "finances", label: "💰 Finances" },
  { id: "effectifs", label: "👥 Effectifs" },
  { id: "enseignants", label: "👨‍🏫 Enseignants" },
];

function Verrou({ planInfo }) {
  return (
    <div style={{ padding: "22px 26px" }}>
      <Card><div style={{ padding: "30px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>📈</div>
        <h2 style={{ margin: "10px 0 6px", fontSize: 20, fontWeight: 800, color: C.blueDark }}>Statistiques avancées</h2>
        <p style={{ margin: "0 auto 18px", maxWidth: 620, fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>
          Réussite par classe et par matière, matières à soutenir, évolution sur l'année,
          comparaison filles/garçons, assiduité et élèves à risque, recouvrement classe par
          classe, effectifs et motifs de départ, charge des enseignants — le tout croisé sur
          toutes les sections de l'établissement.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, maxWidth: 700, margin: "0 auto 20px" }}>
          {["Réussite par classe", "Matières en difficulté", "Élèves à risque", "Recouvrement", "Motifs de départ", "Charge enseignante"].map((t) => (
            <div key={t} style={{ background: "#f1f5f9", borderRadius: 10, padding: "12px 10px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>🔒 {t}</div>
          ))}
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#92400e" }}>
          Fonctionnalité incluse dans le plan <strong>Premium</strong>
          {planInfo?.planLabel ? ` — votre école est en plan ${planInfo.planLabel}.` : "."}
        </p>
        <Btn v="success" onClick={() => window.dispatchEvent(new CustomEvent("edugest:ouvrir-upgrade"))}>
          Passer au Premium
        </Btn>
      </div></Card>
    </div>
  );
}

function Statistiques({ annee }) {
  const { planInfo } = useContext(SchoolContext);
  const s = useStatistiques({ annee });

  if (!planInfo?.estPremium) return <Verrou planInfo={planInfo} />;

  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>📈 Statistiques avancées</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.green, fontWeight: 600 }}>
            Année {s.anneeCourante} — analyses détaillées de l'établissement
          </p>
        </div>
        <select value={s.sectionCle} onChange={(e) => s.setSectionCle(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark, fontWeight: 600 }}>
          {s.SECTIONS.map((sec) => <option key={sec.cle} value={sec.cle}>{sec.label}</option>)}
        </select>
        {s.tab === "resultats" && s.periodes.length > 0 && (
          <select value={s.periode} onChange={(e) => s.setPeriode(e.target.value)}
            style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark, fontWeight: 600 }}>
            {s.periodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Portée : ce qui suit la section choisie, et ce qui couvre l'école
          entière. Sans ce repère, un directeur peut lire un chiffre d'école
          comme un chiffre de cycle. */}
      <div style={{ background: "#e0ebf8", borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: C.blueDark }}>
        <strong>Résultats</strong>, <strong>assiduité</strong> et <strong>enseignants</strong> portent sur la section
        sélectionnée ({s.section.label}). <strong>Finances</strong> et <strong>effectifs</strong> couvrent l'école entière.
      </div>

      <Tabs items={ONGLETS} actif={s.tab} onChange={s.setTab} />

      {s.cN && s.tab === "resultats" ? <Chargement /> : (
        <>
          {s.tab === "resultats" && <VueResultats s={s} />}
          {s.tab === "assiduite" && <VueAssiduite s={s} />}
          {s.tab === "finances" && <VueFinances s={s} />}
          {s.tab === "effectifs" && <VueEffectifs s={s} />}
          {s.tab === "enseignants" && <VueEnseignants s={s} />}
        </>
      )}
    </div>
  );
}

export { Statistiques };
