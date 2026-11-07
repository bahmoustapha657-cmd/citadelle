import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, fmt } from "../../../constants";
import { Card, Chargement } from "../../ui";
import { BilanBlocage } from "./BilanBlocage";
import { montantAxe, syntheseFinances } from "../finances-claires";
import { collecterMouvements, serieParMois } from "../caisse/caisse-utils";

// Bilan lisible : le solde réel de l'année, l'argent entré et sorti ligne
// par ligne, puis ce qui reste à encaisser. Montants complets partout, une
// phrase sous chaque chiffre pour dire ce qu'il contient. Les écoles listées
// dans finances-claires.js gardent l'ancien Bilan (BilanTab).

const VERT = "#15803d";
const ROUGE = "#b91c1c";

const titre = { margin: "0 0 4px", fontWeight: 900, fontSize: 15, color: "var(--lc-text)" };
const aideTexte = { margin: 0, fontSize: 12, color: "var(--lc-text-muted)", lineHeight: 1.4 };
const nombre = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function Ligne({ label, aide, montant, couleur, signe }) {
  const vide = !montant;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--lc-border-soft)", flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 160px" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--lc-text)" }}>{label}</p>
        {aide && <p style={aideTexte}>{aide}</p>}
      </div>
      <span style={{ ...nombre, fontSize: 15, fontWeight: 800, color: vide ? "var(--lc-text-muted)" : couleur }}>
        {vide ? fmt(0) : `${signe} ${fmt(montant)}`}
      </span>
    </div>
  );
}

function Colonne({ icone, intitule, sousTitre, lignes, totalLabel, totalMontant, couleur, signe }) {
  return (
    <Card><div style={{ padding: "16px 18px", borderTop: `4px solid ${couleur}`, borderRadius: "inherit" }}>
      <p style={titre}>{icone} {intitule}</p>
      <p style={aideTexte}>{sousTitre}</p>
      <div style={{ marginTop: 6 }}>
        {lignes.map((l) => <Ligne key={l.id} {...l} couleur={couleur} signe={signe} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, padding: "12px 14px", borderRadius: 10, border: `2px solid ${couleur}`, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, color: "var(--lc-text)" }}>{totalLabel}</strong>
        <strong style={{ ...nombre, fontSize: 17, color: couleur }}>{fmt(totalMontant)}</strong>
      </div>
    </div></Card>
  );
}

export function BilanClair({
  schoolInfo, canCreate, toggleBlocage, cR, cD,
  recettes, depenses, versements, mensualiteOverview,
  salairesMois = [], moisLabel, totNetSec = 0, totNetPrim = 0, totNetPers = 0,
  eleves = [], moisAnnee = [], tarifsClasses = [], paiements = [], anneeConsultee = "",
}) {
  const s = syntheseFinances({ overview: mensualiteOverview, recettes, depenses, versements });
  const r = s.recouvrement;
  const positif = s.solde >= 0;
  const masseSalariale = totNetSec + totNetPrim + totNetPers;

  // Même série que la vue « Année » de la Caisse : encaissements datés.
  const serie = useMemo(() => serieParMois(
    collecterMouvements({ recettes, depenses, versements, eleves, moisAnnee, tarifsClasses, paiements, annee: anneeConsultee }),
    anneeConsultee,
  ), [recettes, depenses, versements, eleves, moisAnnee, tarifsClasses, paiements, anneeConsultee]);

  if (cR || cD) return <Chargement />;

  return (
    <div style={{ display: "grid", gap: 14, textAlign: "start" }}>
      {/* ── 1. Le solde, en une phrase ── */}
      <Card><div style={{ padding: "18px 20px", borderInlineStart: `6px solid ${positif ? VERT : ROUGE}`, borderRadius: "inherit" }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 800, color: "var(--lc-text-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Solde réel de l'année {anneeConsultee}
        </p>
        <p style={{ ...nombre, margin: "2px 0 8px", fontSize: "clamp(26px,5vw,36px)", fontWeight: 900, color: positif ? VERT : ROUGE, whiteSpace: "normal" }}>
          {positif ? "" : "− "}{fmt(Math.abs(s.solde))}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--lc-text)", lineHeight: 1.6 }}>
          <span style={{ ...nombre, color: VERT, fontWeight: 800 }}>{fmt(s.totalEntrees)}</span> entrés
          {" "}−{" "}
          <span style={{ ...nombre, color: ROUGE, fontWeight: 800 }}>{fmt(s.totalSorties)}</span> sortis
          {" "}= <strong>{positif ? "excédent" : "déficit"}</strong>
        </p>
      </div></Card>

      {/* ── 2. D'où vient l'argent, où il est parti ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14 }}>
        <Colonne icone="⬇️" intitule="Argent entré" sousTitre="Tout ce qui a été encaissé cette année."
          lignes={s.entrees} totalLabel="Total entré" totalMontant={s.totalEntrees} couleur={VERT} signe="+" />
        <Colonne icone="⬆️" intitule="Argent sorti" sousTitre="Tout ce qui a quitté la caisse cette année."
          lignes={s.sorties} totalLabel="Total sorti" totalMontant={s.totalSorties} couleur={ROUGE} signe="−" />
      </div>

      {/* ── 3. Salaires : affichés, pas déduits ── */}
      <Card><div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <p style={titre}>📋 Salaires de {moisLabel || "ce mois"}</p>
          <p style={aideTexte}>
            {salairesMois.length} fiche(s) de paie. <strong>Non déduits du solde</strong> : une fiche de paie n'est pas
            un décaissement daté. Pour qu'un salaire versé compte, saisissez-le dans Dépenses (catégorie « Salaires »).
          </p>
        </div>
        <span style={{ ...nombre, fontSize: 18, fontWeight: 900, color: "#b45309" }}>{fmt(masseSalariale)}</span>
      </div></Card>

      {/* ── 4. Ce qui reste à encaisser ── */}
      <Card><div style={{ padding: "16px 18px" }}>
        <p style={titre}>⏳ Ce qui reste à encaisser</p>
        <p style={aideTexte}>Scolarité due par les élèves inscrits cette année, dispenses déduites.</p>

        <div style={{ margin: "14px 0 6px", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 14, color: "var(--lc-text)" }}>
          <span>Encaissé <strong style={{ ...nombre, color: VERT }}>{fmt(r.encaisse)}</strong> sur <strong style={nombre}>{fmt(r.attendu)}</strong> attendus</span>
          <strong style={{ ...nombre, color: r.taux >= 70 ? VERT : r.taux >= 40 ? "#b45309" : ROUGE }}>{r.taux.toFixed(1).replace(".", ",")} %</strong>
        </div>
        <div role="progressbar" aria-valuenow={Math.round(r.taux)} aria-valuemin={0} aria-valuemax={100}
          style={{ height: 14, borderRadius: 8, background: "#fecaca", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, r.taux)}%`, height: "100%", background: VERT }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${ROUGE}` }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--lc-text)" }}>Reste à encaisser</p>
            <p style={{ ...nombre, margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: ROUGE }}>{fmt(r.reste)}</p>
          </div>
          {r.detailReste.map((d) => (
            <div key={d.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--lc-border)" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--lc-text-muted)" }}>dont {d.label.toLowerCase()}</p>
              <p style={{ ...nombre, margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: d.montant ? ROUGE : "var(--lc-text-muted)" }}>{fmt(d.montant)}</p>
            </div>
          ))}
        </div>

        <p style={{ ...aideTexte, marginTop: 12, fontSize: 13, color: "var(--lc-text)" }}>
          Mois de mensualité : <strong style={{ color: VERT }}>{r.moisPayes} payés</strong> · <strong style={{ color: ROUGE }}>{r.moisImpayes} impayés</strong>
          {r.moisEntames > 0 && <> (dont {r.moisEntames} entamés par un acompte)</>}
          {r.elevesExoneres > 0 && <> · <strong style={{ color: "#b45309" }}>{r.elevesExoneres} élève(s) dispensé(s)</strong>, soit {fmt(r.exonere)} auxquels l'école renonce (ni encaissé, ni impayé)</>}
        </p>
      </div></Card>

      <BilanBlocage blocage={!!schoolInfo.blocageParentImpaye} canCreate={canCreate} toggleBlocage={toggleBlocage} />

      {/* ── 5. Mois par mois ── */}
      {serie.some((m) => m.entrees || m.sorties) && (
        <Card><div style={{ padding: "16px 18px" }}>
          <p style={titre}>📅 Mois par mois</p>
          <p style={aideTexte}>Encaissements et sorties datés, comme dans l'onglet Caisse. Survolez une barre pour le montant exact.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie.map((m) => ({
              mois: m.date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
              Entré: m.entrees, Sorti: m.sorties,
            }))} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={montantAxe} width={56} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Entré" fill={C.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sorti" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div></Card>
      )}

      <p style={{ ...aideTexte, padding: "0 4px" }}>
        <strong>Comment lire ces chiffres.</strong> L'argent entré vient des fiches élèves (mensualités, inscriptions,
        frais annexes, nets des remboursements) et de l'onglet Recettes. L'argent sorti vient des onglets Dépenses et
        Versements. Le graphique mois par mois, comme la Caisse, ne montre que les paiements datés : un ancien paiement
        sans date compte dans le solde mais n'a pas de barre.
      </p>
    </div>
  );
}
