import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, fmt } from "../../constants";
import { localeCourante } from "../../i18n";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Badge, Btn, Card, Stat, TD, THead, TR, Vide } from "../ui";
import {
  SOURCES,
  collecterMouvements, decalerPeriode, filtrerPeriode, formatJour,
  libellePeriode, periodesCaisse, serieParJour, serieParMois, totauxMouvements,
} from "./caisse/caisse-utils";
import { affichageFinancesClassique, montantAxe } from "./finances-claires";
import { StatClair } from "./StatClair";

// Journal de caisse : ce qui est réellement entré et sorti sur une journée,
// une semaine ou un mois. Complète le Bilan, qui raisonne par période
// scolaire (T1/T2…) et ne répond pas à « combien a-t-on encaissé aujourd'hui ».
// La période « Année » donne l'aperçu général de l'année scolaire, mois par
// mois (masquée pour certaines écoles, voir periodesCaisse). Elle reprend TOUT
// ce qui est enregistré dans l'année consultée dans l'en-tête de la
// Comptabilité, sans filtre de date (voir serieParMois) ; ← → changent cette
// année consultée, seul chemin qui charge les données d'une autre année.
export function CaisseTab({
  recettes, depenses, versements, eleves, moisAnnee, tarifsClasses, paiements = [],
  enModeArchive, anneeConsultee, setAnneeConsultee, anneesDispo = [],
}) {
  const { t } = useTranslation();
  const { schoolId } = useContext(SchoolContext);
  const periodes = periodesCaisse(schoolId);
  // La Citadelle garde l'affichage d'origine (voir finances-claires.js).
  const classique = affichageFinancesClassique(schoolId);
  const [periode, setPeriode] = useState("jour");
  const [reference, setReference] = useState(() => new Date());

  const mouvements = useMemo(
    () => collecterMouvements({
      recettes, depenses, versements, eleves, moisAnnee, tarifsClasses,
      paiements, annee: anneeConsultee,
    }),
    [recettes, depenses, versements, eleves, moisAnnee, tarifsClasses, paiements, anneeConsultee],
  );
  const duJour = useMemo(
    () => (periode === "annee" ? mouvements : filtrerPeriode(mouvements, reference, periode)),
    [mouvements, reference, periode],
  );
  const totaux = useMemo(() => totauxMouvements(duJour), [duJour]);
  const serie = useMemo(
    () => (periode === "annee" ? serieParMois(duJour, anneeConsultee) : serieParJour(duJour, reference, periode)),
    [duJour, reference, periode, anneeConsultee],
  );

  // Année : ← → changent l'année consultée (liste du plus récent au plus
  // ancien ou l'inverse — on ne présuppose pas l'ordre).
  const anneesTriees = [...anneesDispo].sort();
  const rangAnnee = anneesTriees.indexOf(anneeConsultee);
  const anneeVoisine = (sens) => (rangAnnee >= 0 ? anneesTriees[rangAnnee + sens] : undefined);
  const naviguer = (sens) => {
    if (periode === "annee") { const a = anneeVoisine(sens); if (a && setAnneeConsultee) setAnneeConsultee(a); return; }
    setReference((d) => decalerPeriode(d, periode, sens));
  };
  const inputValue = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(reference.getDate()).padStart(2, "0")}`;

  return (
    <div>
      {/* ── Sélecteur de période ── */}
      <Card><div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 3, background: "var(--lc-surface-hov)", padding: 4, borderRadius: 10 }}>
          {periodes.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriode(p.id)}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                background: periode === p.id ? `linear-gradient(135deg,${C.greenDk},${C.green})` : "transparent",
                color: periode === p.id ? "#fff" : "var(--lc-text)" }}>
              {p.label}
            </button>
          ))}
        </div>
        {periode === "annee" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Btn sm v="ghost" disabled={!anneeVoisine(-1)} onClick={() => naviguer(-1)}>←</Btn>
          <Btn sm v="ghost" disabled={!anneeVoisine(1)} onClick={() => naviguer(1)}>→</Btn>
        </div>
        ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Btn sm v="ghost" onClick={() => naviguer(-1)}>←</Btn>
          <input type="date" value={inputValue}
            onChange={(e) => { const [a, m, j] = e.target.value.split("-").map(Number); if (a) setReference(new Date(a, m - 1, j)); }}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} />
          <Btn sm v="ghost" onClick={() => naviguer(1)}>→</Btn>
          <Btn sm v="ghost" onClick={() => setReference(new Date())}>{t("accounting.cash.today")}</Btn>
        </div>
        )}
        <strong style={{ fontSize: 13, color: C.blueDark, marginInlineStart: "auto" }}>{periode === "annee" ? t("accounting.cash.schoolYear", { year: anneeConsultee }) : libellePeriode(reference, periode)}</strong>
      </div></Card>

      {enModeArchive && (
        <p style={{ margin: "10px 0 0", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
          📚 {t("accounting.cash.archiveNote", { year: anneeConsultee })}
        </p>
      )}

      {/* ── Totaux de la période ── */}
      {classique ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "12px 0 16px" }}>
        <Stat label={t("accounting.cash.in")} value={fmt(totaux.entrees)} sub={t("accounting.cash.operations", { count: duJour.filter((m) => m.sens === "entree").length })} bg="#eaf4e0" />
        <Stat label={t("accounting.cash.out")} value={fmt(totaux.sorties)} sub={t("accounting.cash.operations", { count: duJour.filter((m) => m.sens === "sortie").length })} bg="#fce8e8" />
        <Stat label={t("accounting.cash.periodBalance")} value={fmt(totaux.solde)} sub={totaux.solde >= 0 ? t("accounting.cash.surplus") : t("accounting.cash.deficit")} bg={totaux.solde >= 0 ? "#eaf4e0" : "#fce8e8"} />
        <Stat label={t("accounting.cash.movements")} value={totaux.nb} sub={periodes.find((p) => p.id === periode)?.label} bg="#e0ebf8" />
      </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10, margin: "12px 0 16px" }}>
        <StatClair label={t("accounting.cash.moneyIn")} value={fmt(totaux.entrees)} couleur="#15803d" valeurCouleur="#15803d"
          sub={t("accounting.cash.moneyInSub", { count: duJour.filter((m) => m.sens === "entree").length })} />
        <StatClair label={t("accounting.cash.moneyOut")} value={fmt(totaux.sorties)} couleur="#b91c1c" valeurCouleur="#b91c1c"
          sub={t("accounting.cash.moneyOutSub", { count: duJour.filter((m) => m.sens === "sortie").length })} />
        <StatClair label={t("accounting.cash.periodBalance")} value={`${totaux.solde < 0 ? "− " : ""}${fmt(Math.abs(totaux.solde))}`}
          couleur={totaux.solde >= 0 ? "#15803d" : "#b91c1c"} valeurCouleur={totaux.solde >= 0 ? "#15803d" : "#b91c1c"}
          sub={totaux.solde >= 0 ? t("accounting.cash.surplusHint") : t("accounting.cash.deficitHint")} />
        <StatClair label={t("accounting.cash.operationsCount")} value={totaux.nb} couleur="#0ea5e9"
          sub={t("accounting.cash.allKinds", { period: periodes.find((p) => p.id === periode)?.label })} />
      </div>
      )}

      {duJour.length === 0 ? (
        <Vide icone="🧾" msg={t("accounting.cash.noMovement")} />
      ) : (
        <>
          {/* ── Répartition par nature ── */}
          <Card><div style={{ padding: "14px 16px" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>{t("accounting.cash.byKind")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
              {Object.entries(SOURCES).map(([id, src]) => {
                const ligne = totaux.parSource[id];
                if (!ligne) return null;
                return (
                  <div key={id} style={{ border: "1px solid var(--lc-border)", borderRadius: 10, padding: "10px 12px", borderInlineStartWidth: 4, borderInlineStartColor: src.couleur, borderInlineStartStyle: "solid" }}>
                    <p style={{ margin: "0 0 3px", fontSize: classique ? 11 : 13, fontWeight: 700, color: classique ? "var(--lc-text-muted)" : "var(--lc-text)" }}>{src.label}</p>
                    {src.sens === "neutre" ? (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#64748b" }}>
                        {ligne.montant < 0 ? `− ${fmt(-ligne.montant)}` : t("accounting.cash.notCounted")}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: src.sens === "sortie" ? "#b91c1c" : C.greenDk }}>
                        {src.sens === "sortie" ? "− " : "+ "}{fmt(ligne.montant)}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: classique ? 11 : 12, color: classique ? "var(--lc-text-faint)" : "var(--lc-text-muted)" }}>{t("accounting.cash.operations", { count: ligne.nb })}</p>
                  </div>
                );
              })}
            </div>
          </div></Card>

          {/* ── Courbe jour par jour (semaine / mois) ou mois par mois (année) ── */}
          {periode !== "jour" && (
            <Card style={{ marginTop: 14 }}><div style={{ padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>{periode === "annee" ? t("accounting.cash.monthByMonth") : t("accounting.cash.dayByDay")}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serie.map((j) => ({
                  jour: j.date.toLocaleDateString(localeCourante(),
                    periode === "annee" ? { month: "short", year: "2-digit" } : periode === "mois" ? { day: "numeric" } : { weekday: "short" }),
                  entrees: j.entrees,
                  sorties: j.sorties,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
                  <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
                  {classique
                    ? <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    : <YAxis tick={{ fontSize: 12 }} tickFormatter={montantAxe} width={56} />}
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entrees" name={t("accounting.cash.in")} fill={C.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sorties" name={t("accounting.cash.out")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div></Card>
          )}

          {/* ── Détail des mouvements ── */}
          <Card style={{ marginTop: 14 }}><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={[t("accounting.cash.colDate"), t("accounting.cash.colKind"), t("accounting.cash.colLabel"), t("accounting.cash.colDetail"), t("accounting.cash.colIn"), t("accounting.cash.colOut")]} />
            <tbody>{duJour.map((m) => (
              <TR key={m.id}>
                <TD>{formatJour(m.date)}</TD>
                <TD><Badge color={m.source === "correction" ? "gray" : m.sens === "sortie" ? "red" : "vert"}>{SOURCES[m.source]?.label || m.source}</Badge></TD>
                <TD bold>{m.libelle}</TD>
                <TD>{m.detail}</TD>
                <TD>{m.sens === "neutre"
                  ? <span title={t("accounting.cash.typoNotCounted")} style={{ color: "#94a3b8", textDecoration: "line-through" }}>{fmt(m.montant)}</span>
                  : m.sens === "entree" ? <span style={{ color: m.montant < 0 ? "#b45309" : C.greenDk, fontWeight: 700 }}>{fmt(m.montant)}</span> : ""}</TD>
                <TD>{m.sens === "sortie" ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>{fmt(m.montant)}</span> : ""}</TD>
              </TR>
            ))}</tbody>
          </table></div></Card>
        </>
      )}

      <p style={classique
        ? { margin: "12px 0 0", fontSize: 11, color: "var(--lc-text-faint)" }
        : { margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--lc-text-muted)" }}>
        {t("accounting.cash.footer")}
      </p>
    </div>
  );
}
