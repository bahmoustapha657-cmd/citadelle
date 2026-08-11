import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, fmt } from "../../constants";
import { Badge, Btn, Card, Stat, TD, THead, TR, Vide } from "../ui";
import {
  PERIODES_CAISSE, SOURCES,
  collecterMouvements, decalerPeriode, filtrerPeriode, formatJour,
  libellePeriode, serieParJour, totauxMouvements,
} from "./caisse/caisse-utils";

// Journal de caisse : ce qui est réellement entré et sorti sur une journée,
// une semaine ou un mois. Complète le Bilan, qui raisonne par période
// scolaire (T1/T2…) et ne répond pas à « combien a-t-on encaissé aujourd'hui ».
export function CaisseTab({
  recettes, depenses, versements, eleves, moisAnnee, tarifsClasses,
  enModeArchive, anneeConsultee,
}) {
  const [periode, setPeriode] = useState("jour");
  const [reference, setReference] = useState(() => new Date());

  const mouvements = useMemo(
    () => collecterMouvements({ recettes, depenses, versements, eleves, moisAnnee, tarifsClasses }),
    [recettes, depenses, versements, eleves, moisAnnee, tarifsClasses],
  );
  const duJour = useMemo(() => filtrerPeriode(mouvements, reference, periode), [mouvements, reference, periode]);
  const totaux = useMemo(() => totauxMouvements(duJour), [duJour]);
  const serie = useMemo(() => serieParJour(duJour, reference, periode), [duJour, reference, periode]);

  const naviguer = (sens) => setReference((d) => decalerPeriode(d, periode, sens));
  const inputValue = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(reference.getDate()).padStart(2, "0")}`;

  return (
    <div>
      {/* ── Sélecteur de période ── */}
      <Card><div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 3, background: "var(--lc-surface-hov)", padding: 4, borderRadius: 10 }}>
          {PERIODES_CAISSE.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriode(p.id)}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                background: periode === p.id ? `linear-gradient(135deg,${C.greenDk},${C.green})` : "transparent",
                color: periode === p.id ? "#fff" : "var(--lc-text)" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Btn sm v="ghost" onClick={() => naviguer(-1)}>←</Btn>
          <input type="date" value={inputValue}
            onChange={(e) => { const [a, m, j] = e.target.value.split("-").map(Number); if (a) setReference(new Date(a, m - 1, j)); }}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} />
          <Btn sm v="ghost" onClick={() => naviguer(1)}>→</Btn>
          <Btn sm v="ghost" onClick={() => setReference(new Date())}>Aujourd'hui</Btn>
        </div>
        <strong style={{ fontSize: 13, color: C.blueDark, marginInlineStart: "auto" }}>{libellePeriode(reference, periode)}</strong>
      </div></Card>

      {enModeArchive && (
        <p style={{ margin: "10px 0 0", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
          📚 Année {anneeConsultee} : recettes, dépenses et dons sont ceux de l'archive ; les paiements de
          scolarité proviennent de l'instantané figé à la clôture de cette année. Si elle n'a jamais été
          clôturée, ce sont les fiches élèves actuelles qui s'affichent.
        </p>
      )}

      {/* ── Totaux de la période ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "12px 0 16px" }}>
        <Stat label="Encaissé" value={fmt(totaux.entrees)} sub={`${duJour.filter((m) => m.sens === "entree").length} opération(s)`} bg="#eaf4e0" />
        <Stat label="Sorti" value={fmt(totaux.sorties)} sub={`${duJour.filter((m) => m.sens === "sortie").length} opération(s)`} bg="#fce8e8" />
        <Stat label="Solde de la période" value={fmt(totaux.solde)} sub={totaux.solde >= 0 ? "Excédent" : "Déficit"} bg={totaux.solde >= 0 ? "#eaf4e0" : "#fce8e8"} />
        <Stat label="Mouvements" value={totaux.nb} sub={PERIODES_CAISSE.find((p) => p.id === periode)?.label} bg="#e0ebf8" />
      </div>

      {duJour.length === 0 ? (
        <Vide icone="🧾" msg="Aucun mouvement sur cette période" />
      ) : (
        <>
          {/* ── Répartition par nature ── */}
          <Card><div style={{ padding: "14px 16px" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>Répartition par nature</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
              {Object.entries(SOURCES).map(([id, src]) => {
                const ligne = totaux.parSource[id];
                if (!ligne) return null;
                return (
                  <div key={id} style={{ border: "1px solid var(--lc-border)", borderRadius: 10, padding: "10px 12px", borderInlineStartWidth: 4, borderInlineStartColor: src.couleur, borderInlineStartStyle: "solid" }}>
                    <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "var(--lc-text-muted)" }}>{src.label}</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: src.sens === "sortie" ? "#b91c1c" : C.greenDk }}>
                      {src.sens === "sortie" ? "− " : "+ "}{fmt(ligne.montant)}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--lc-text-faint)" }}>{ligne.nb} opération(s)</p>
                  </div>
                );
              })}
            </div>
          </div></Card>

          {/* ── Courbe jour par jour (semaine / mois) ── */}
          {periode !== "jour" && (
            <Card style={{ marginTop: 14 }}><div style={{ padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>Jour par jour</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serie.map((j) => ({
                  jour: j.date.toLocaleDateString("fr-FR", periode === "mois" ? { day: "numeric" } : { weekday: "short" }),
                  Encaissé: j.entrees,
                  Sorti: j.sorties,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
                  <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Encaissé" fill={C.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sorti" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div></Card>
          )}

          {/* ── Détail des mouvements ── */}
          <Card style={{ marginTop: 14 }}><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Date", "Nature", "Libellé", "Détail", "Entrée", "Sortie"]} />
            <tbody>{duJour.map((m) => (
              <TR key={m.id}>
                <TD>{formatJour(m.date)}</TD>
                <TD><Badge color={m.sens === "sortie" ? "red" : "vert"}>{SOURCES[m.source]?.label || m.source}</Badge></TD>
                <TD bold>{m.libelle}</TD>
                <TD>{m.detail}</TD>
                <TD>{m.sens === "entree" ? <span style={{ color: C.greenDk, fontWeight: 700 }}>{fmt(m.montant)}</span> : ""}</TD>
                <TD>{m.sens === "sortie" ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>{fmt(m.montant)}</span> : ""}</TD>
              </TR>
            ))}</tbody>
          </table></div></Card>
        </>
      )}

      <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--lc-text-faint)" }}>
        Les salaires n'apparaissent pas ici : une fiche de paie porte un mois, pas une date de décaissement.
        Un paiement de scolarité enregistré sans date (import ancien) reste également invisible dans le journal.
      </p>
    </div>
  );
}
