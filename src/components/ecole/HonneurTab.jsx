import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Vide } from "../ui";
import { PERIODE_ANNEE, imprimerTableauxHonneur } from "../../reports";
import { getMention } from "../../reports/bulletins/bulletin-format";
import { getPeriodeLongLabel } from "../../period-utils";
import { matieresForClasse as matieresForClasseFn } from "./ecole-logic";
import { nomAffiche } from "../../ordre-eleves";
import {
  NOMBRES_HONNEUR, NOMBRE_HONNEUR_DEFAUT, SEUILS_HONNEUR, SEUIL_HONNEUR_DEFAUT,
  periodeHonneurParDefaut, tableauHonneurSection, tableauxHonneurParClasse,
} from "./honneur-tab/classement-honneur";

// Valeur du sélecteur de classe pour le palmarès de toute la section.
const SECTION = "__section__";
const MEDAILLES = ["🥇", "🥈", "🥉"];
const selectStyle = { border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff" };

// Tableau d'honneur de CHAQUE classe : les meilleurs élèves de la période
// (ou de l'année), avec les moyennes et les rangs du bulletin, et une affiche
// murale par classe à imprimer d'un coup. Le palmarès de toute la section
// reste disponible dans le sélecteur de classe.
export function HonneurTab({
  titre = "", classes = [], eleves = [], notes = [], matieres = [], periodes = [],
  section = "", maxNote = 20, schoolInfo = {}, anneeConsultee = "", chargement = false,
}) {
  const { t } = useTranslation();
  // Les périodes et la fonction des matières sont recréées à chaque rendu par
  // useEcole : on les stabilise ici pour que le classement (qui parcourt
  // toutes les notes) ne se recalcule que si les données changent.
  const clePeriodes = periodes.join("|");
  const periodesSection = useMemo(() => (clePeriodes ? clePeriodes.split("|") : []), [clePeriodes]);
  const matsFor = useCallback((cl) => matieresForClasseFn(matieres, cl), [matieres]);
  const nomsClasses = useMemo(() => classes.map((c) => c.nom).filter(Boolean), [classes]);
  // Ordre des noms réglé par l'école (Paramètres → Affichage) : l'écran et
  // l'affiche écrivent le nom de la même façon.
  const tri = schoolInfo?.triEleves;

  // Tant qu'on n'a rien choisi, la période suit les notes qui arrivent (les
  // autres périodes se chargent juste après celle des bulletins).
  const [periodeChoisie, setPeriode] = useState(null);
  const periodeDefaut = useMemo(() => periodeHonneurParDefaut(notes, periodesSection), [notes, periodesSection]);
  const periode = periodeChoisie ?? periodeDefaut;
  const [filtre, setFiltre] = useState("all");
  const [nombre, setNombre] = useState(NOMBRE_HONNEUR_DEFAUT);
  const [seuil, setSeuil] = useState(SEUIL_HONNEUR_DEFAUT);

  const parClasse = useMemo(() => tableauxHonneurParClasse({
    eleves, notes, matieresForClasse: matsFor, periode, periodes: periodesSection,
    section, maxNote, nombre, seuil, classes: nomsClasses, tri,
  }), [eleves, notes, matsFor, periode, periodesSection, section, maxNote, nombre, seuil, nomsClasses, tri]);
  const palmares = useMemo(() => (filtre === SECTION ? tableauHonneurSection({
    eleves, notes, matieresForClasse: matsFor, periode, periodes: periodesSection, section, maxNote, nombre, seuil, tri,
  }) : null), [filtre, eleves, notes, matsFor, periode, periodesSection, section, maxNote, nombre, seuil, tri]);

  const periodeLabel = periode === PERIODE_ANNEE ? "Résultats annuels" : getPeriodeLongLabel(periode);
  const optionsImpression = { periodeLabel, portee: titre, annee: anneeConsultee, maxNote };
  const affichees = filtre === "all" || filtre === SECTION ? parClasse : parClasse.filter((tb) => tb.classe === filtre);
  const aImprimer = affichees.filter((tb) => tb.laureats.length);
  const minimum = (SEUILS_HONNEUR.find((s) => s.id === seuil)?.part || 0) * maxNote;
  const imprimer = (tableaux) => imprimerTableauxHonneur(
    tableaux.map((tb) => ({ classe: tb.classe, classement: tb.laureats, evalues: tb.evalues })),
    schoolInfo, optionsImpression,
  );

  // Alignement explicite : #root centre le texte par défaut (index.css).
  return (
    <div style={{ textAlign: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, color: C.blueDark, flex: 1, minWidth: 180 }}>🏆 {t("school.tabs.honorRoll")}</strong>
        <select value={periode} onChange={(ev) => setPeriode(ev.target.value)} style={selectStyle} aria-label="Période">
          {periodes.map((p) => <option key={p} value={p}>{getPeriodeLongLabel(p)}</option>)}
          <option value={PERIODE_ANNEE}>🏁 {t("reports.annual")}</option>
        </select>
        <select value={filtre} onChange={(ev) => setFiltre(ev.target.value)} style={selectStyle} aria-label="Classe">
          <option value="all">Toutes les classes</option>
          {parClasse.map((tb) => <option key={tb.classe} value={tb.classe}>{tb.classe}</option>)}
          <option value={SECTION}>🏫 Toute la section</option>
        </select>
        <select value={nombre} onChange={(ev) => setNombre(Number(ev.target.value))} style={selectStyle} aria-label="Nombre de lauréats">
          {NOMBRES_HONNEUR.map((n) => <option key={n} value={n}>{n} premiers{filtre === SECTION ? "" : " par classe"}</option>)}
        </select>
        <select value={seuil} onChange={(ev) => setSeuil(ev.target.value)} style={selectStyle} aria-label="Moyenne minimale">
          {SEUILS_HONNEUR.map((s) => (
            <option key={s.id} value={s.id}>
              {s.part ? `Au moins ${+(s.part * maxNote).toFixed(2)}/${maxNote} (${s.libelle.toLowerCase()})` : s.libelle}
            </option>
          ))}
        </select>
        {filtre === SECTION
          ? <Btn v="amber" disabled={!palmares?.laureats.length}
              onClick={() => imprimerTableauxHonneur([{ classement: palmares.laureats, evalues: palmares.evalues }], schoolInfo, optionsImpression)}>
              🖨️ Imprimer l'affiche
            </Btn>
          : <Btn v="amber" disabled={!aImprimer.length} title="Une affiche A4 paysage par classe, prête pour le mur"
              onClick={() => imprimer(aImprimer)}>
              🖨️ Imprimer {aImprimer.length === 1 ? "l'affiche" : aImprimer.length ? `les ${aImprimer.length} affiches` : "les affiches"}
            </Btn>}
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6b7280" }}>
        {filtre === SECTION
          ? `Les ${nombre} meilleurs élèves de la section, toutes classes confondues`
          : `Les ${nombre} premiers de chaque classe`}
        {minimum ? `, avec au moins ${+minimum.toFixed(2)}/${maxNote} de moyenne` : ""}
        {" "}— {periodeLabel}. Moyennes et rangs identiques à ceux des bulletins ; deux élèves à égalité partagent le rang.
      </p>

      {chargement ? <Chargement />
        : filtre === SECTION
          ? <Card><CarteLaureats laureats={palmares?.laureats || []} avecClasse maxNote={maxNote} tri={tri}
              vide={palmares?.evalues ? `Aucun élève n'atteint ${+minimum.toFixed(2)}/${maxNote}` : "Aucune note saisie pour cette période"} /></Card>
          : affichees.length === 0
            ? <Vide icone="🏆" msg="Aucune classe dans cette section" />
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {affichees.map((tb) => (
                  <Card key={tb.classe}>
                    <div style={{ background: "linear-gradient(90deg,#d97706,#f59e0b)", color: "#fff", padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{tb.classe}</span>
                        <span style={{ fontSize: 11, opacity: 0.9, marginInlineStart: 8 }}>
                          {tb.evalues} classé{tb.evalues > 1 ? "s" : ""}{tb.effectif !== tb.evalues ? ` / ${tb.effectif}` : ""}
                        </span>
                      </span>
                      <Btn sm v="ghost" disabled={!tb.laureats.length} title={`Imprimer l'affiche de ${tb.classe}`}
                        onClick={() => imprimer([tb])}>🖨️</Btn>
                    </div>
                    <CarteLaureats laureats={tb.laureats} maxNote={maxNote} tri={tri}
                      vide={tb.evalues ? `Aucun élève n'atteint ${+minimum.toFixed(2)}/${maxNote}` : "Aucune note saisie pour cette période"} />
                  </Card>
                ))}
              </div>}
    </div>
  );
}

// Liste des lauréats d'une classe (ou de la section, avec la colonne Classe).
function CarteLaureats({ laureats, maxNote, avecClasse = false, vide, tri }) {
  if (!laureats.length) return <p style={{ margin: 0, padding: "18px 14px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>{vide}</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>{laureats.map((e) => {
        // Mention EN POURCENTAGE du barème : le primaire et le préscolaire
        // sont notés sur 10 (cf. getMention).
        const mention = getMention(e.moyenne, maxNote);
        const couleur = e.moyenne >= maxNote * 0.7 ? "vert" : e.moyenne >= maxNote * 0.5 ? "blue" : "red";
        return (
          <tr key={e._id} style={{ borderBottom: "1px solid #fde68a", background: e.rang === 1 ? "#fffbeb" : "transparent" }}>
            <td style={{ padding: "8px 10px", textAlign: "center", width: 40, fontSize: e.rang <= 3 ? 20 : 13, fontWeight: 800, color: "#92400e" }}>
              {e.rang <= 3 ? MEDAILLES[e.rang - 1] : `${e.rang}e`}
            </td>
            <td style={{ padding: "8px 6px", fontWeight: 800, color: C.blueDark, fontSize: 13 }}>
              {nomAffiche(e, tri)}
              {avecClasse && <div style={{ marginTop: 3 }}><Badge color="blue">{e.classe}</Badge></div>}
            </td>
            <td style={{ padding: "8px 6px", textAlign: "end", whiteSpace: "nowrap", fontWeight: 800, fontSize: 14, color: C.greenDk }}>
              {e.moyenne.toFixed(2)}<span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>/{maxNote}</span>
            </td>
            <td style={{ padding: "8px 10px", textAlign: "end" }}><Badge color={couleur}>{mention}</Badge></td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
