import { Stat } from "../../ui";

// Grille de statistiques en tête du bilan (recettes, dépenses, dons, solde,
// salaires du mois, impayés, total perçu).
export function BilanStats({
  t, cur, totR, totD, totVers, totNetSec, totNetPrim, totNetPers,
  impaye, pctImpaye, salairesMois, moisLabel, mensualiteOverview,
}) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
      <Stat label={t("accounting.revenuesTitle")} value={`${(totR/1e6).toFixed(2)}M`} sub={cur} bg="#eaf4e0"/>
      <Stat label={t("accounting.expensesTitle")} value={`${(totD/1e6).toFixed(2)}M`} sub={cur} bg="#fce8e8"/>
      <Stat label={t("accounting.tabs.donations")} value={`${(totVers/1e6).toFixed(2)}M`} sub={cur} bg="#e6f4ea"/>
      <Stat label={t("accounting.balanceLabel")} value={`${((totR-totD)/1e6).toFixed(2)}M`} sub={cur} bg={(totR-totD)>=0?"#eaf4e0":"#fce8e8"}/>
      <Stat label={t("accounting.totalSalaries")} value={`${((totNetSec+totNetPrim+totNetPers)/1e6).toFixed(3)}M`} sub={`${cur} — ${moisLabel} (${salairesMois.length})`} bg="#fef3e0"/>
      <Stat label={t("accounting.outstanding")} value={`${(impaye/1e6).toFixed(2)}M`} sub={`${cur} — ${pctImpaye}%`} bg="#fce8e8"/>
      <Stat label={t("accounting.totalReceived")} value={`${(mensualiteOverview.totalPercu/1e6).toFixed(2)}M`} sub={`${mensualiteOverview.totalDu>0?(100-Number(pctImpaye)).toFixed(1):0}%`} bg="#eaf4e0"/>
    </div>
  );
}
