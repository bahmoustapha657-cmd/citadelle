import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Btn } from "../../ui";
import { elevesDeClasse, estRedoublant, statistiquesRentree } from "../../../dgecs";
import { imprimerStatistiquesRentree } from "../../../reports/dgecs-print";

const cellule = { padding: "7px 10px", borderBottom: "1px solid var(--lc-border-soft)", fontSize: 12.5, textAlign: "center" };
const entete = { padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--sc1)", textAlign: "center" };
const champ = { border: "1px solid var(--lc-border)", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "var(--lc-input-bg)", color: "var(--lc-text)" };

// Redoublants de l'année, cochés classe par classe : aucun autre écran ne
// les connaît (la promotion laisse le redoublant dans sa classe sans rien
// noter). Le repère porte l'année : il ne suit pas l'élève l'an prochain.
function RedoublantsPanneau({ eleves, classesUniq, annee, modifierChamp, toast }) {
  const { t } = useTranslation();
  const [choix, setClasse] = useState("");
  // Liste des classes arrivée après l'ouverture : la première, celle que le
  // menu déroulant affiche.
  const classe = classesUniq.includes(choix) ? choix : classesUniq[0] || "";
  const [enCours, setEnCours] = useState({});
  // Case cochée tout de suite, sans attendre l'enregistrement ; décochée de
  // nouveau s'il échoue.
  const [voulu, setVoulu] = useState({});
  const liste = useMemo(() => elevesDeClasse(eleves, classe), [eleves, classe]);
  const basculer = async (eleve, coche) => {
    const id = eleve._id;
    setVoulu((p) => ({ ...p, [id]: coche }));
    setEnCours((p) => ({ ...p, [id]: true }));
    try {
      await modifierChamp(id, { redoublantAnnee: coche ? annee : "" });
    } catch (e) {
      setVoulu((p) => { const reste = { ...p }; delete reste[id]; return reste; });
      toast?.(t("dgecs.stats.repeaterError", { error: e?.message || e }), "error");
    } finally {
      setEnCours((p) => ({ ...p, [id]: false }));
    }
  };
  return (
    <div style={{ marginTop: 14, padding: 12, border: "1px solid var(--lc-border)", borderRadius: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{t("dgecs.stats.markRepeaters")}</strong>
        <select value={classe} onChange={(e) => setClasse(e.target.value)} style={champ} aria-label={t("dgecs.class")}>
          {classesUniq.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 4 }}>
        {liste.map((e) => (
          <label key={e._id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "3px 4px" }}>
            <input type="checkbox" checked={voulu[e._id] ?? estRedoublant(e, annee)} disabled={!!enCours[e._id]}
              onChange={(ev) => basculer(e, ev.target.checked)} />
            {`${e.nom || ""} ${e.prenom || ""}`.trim()}
          </label>
        ))}
      </div>
    </div>
  );
}

export function StatistiquesVue({
  eleves = [], classes = [], ens = [], section = "primaire", schoolInfo = {}, annee = "", classesUniq = [],
  canEdit = false, modChampE = null, toast,
}) {
  const { t } = useTranslation();
  const [cocher, setCocher] = useState(false);
  const stats = useMemo(
    () => statistiquesRentree({ eleves, classes, enseignants: ens, section, schoolInfo, annee }),
    [eleves, classes, ens, section, schoolInfo, annee],
  );
  const sexes = [t("dgecs.stats.colBoys"), t("dgecs.stats.colGirls"), t("dgecs.stats.colTotal")];
  const trois = (x, gras) => [x.garcons, x.filles, x.total].map((v, i) => (
    <td key={i} style={{ ...cellule, fontWeight: gras || i === 2 ? 800 : 400 }}>{v}</td>
  ));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ fontSize: 14, flex: 1 }}>{t("dgecs.stats.title")} — {annee}</strong>
        {canEdit && modChampE && classesUniq.length > 0 && (
          <Btn sm v={cocher ? "blue" : "ghost"} onClick={() => setCocher((v) => !v)}>{t("dgecs.stats.markRepeaters")}</Btn>
        )}
        <Btn sm v="ghost" onClick={() => imprimerStatistiquesRentree(stats, { schoolInfo, annee })}>{t("dgecs.print")}</Btn>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid var(--lc-border)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...entete, textAlign: "start" }}>{t("dgecs.stats.colLevel")}</th>
              <th rowSpan={2} style={entete}>{t("dgecs.stats.colClasses")}</th>
              <th colSpan={3} style={entete}>{t("dgecs.stats.enrolled")}</th>
              <th colSpan={3} style={entete}>{t("dgecs.stats.repeaters")}</th>
            </tr>
            <tr>{[...sexes, ...sexes].map((s, i) => <th key={i} style={entete}>{s}</th>)}</tr>
          </thead>
          <tbody>
            {stats.lignes.map((l) => (
              <tr key={l.niveau}>
                <td style={{ ...cellule, textAlign: "start", fontWeight: 700 }}>{l.niveau}</td>
                <td style={cellule}>{l.classes}</td>
                {trois(l)}{trois(l.redoublants)}
              </tr>
            ))}
            <tr style={{ background: "var(--lc-surface-2, rgba(148,163,184,0.12))" }}>
              <td style={{ ...cellule, textAlign: "start", fontWeight: 800 }}>{t("dgecs.stats.total")}</td>
              <td style={{ ...cellule, fontWeight: 800 }}>{stats.total.classes}</td>
              {trois(stats.total, true)}{trois(stats.total.redoublants, true)}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <Badge color="blue">{t("dgecs.stats.teachers", { total: stats.enseignants.total, men: stats.enseignants.hommes, women: stats.enseignants.femmes })}</Badge>
        {stats.enseignants.sansCivilite > 0 && <Badge color="amber">{t("dgecs.stats.teachersUnknown", { count: stats.enseignants.sansCivilite })}</Badge>}
        {stats.total.sansSexe > 0 && <Badge color="amber">{t("dgecs.stats.noSex", { count: stats.total.sansSexe })}</Badge>}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--lc-text-faint)", margin: "8px 0 0" }}>{t("dgecs.stats.repeatersHint", { annee })}</p>
      {cocher && canEdit && modChampE && (
        <RedoublantsPanneau eleves={eleves} classesUniq={classesUniq} annee={annee} modifierChamp={modChampE} toast={toast} />
      )}
    </div>
  );
}
