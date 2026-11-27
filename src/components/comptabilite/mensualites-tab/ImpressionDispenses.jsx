import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtN, getMonnaie } from "../../../constants";
import { STATUT_REFUSEE } from "../../../demande-dispense";
import { libelleSection } from "../../../i18n/libelles";
import { imprimerSituationDispenses } from "../../../reports";
import { Btn } from "../../ui";
import { Choix } from "./ListePayesModale";
import { situationDispenses } from "./situation-dispenses";

const titreBloc = { fontSize: 13, fontWeight: 700, margin: "14px 0 6px" };
const taux = (n, sur) => (sur > 0 ? Math.round((n * 100) / sur) : 0);

// Fenêtre « Dispenses » → « 🖨️ Imprimer la situation » : la section affichée
// ou toutes les sections, la liste des élèves dispensés avec les
// statistiques ou les statistiques seules, les demandes jointes ou non —
// avec les chiffres qui seront imprimés. Calculs : situation-dispenses.js.
export function ImpressionDispenses({
  elevesParSection = {}, sections = [], section, moisAnnee = [], tarifsClasses = [], annee, schoolInfo = {}, fermer,
}) {
  const { t } = useTranslation();
  const plusieurs = sections.length > 1;
  const [toutes, setToutes] = useState(false);
  const [detail, setDetail] = useState("eleves");
  const [avecDemandes, setAvecDemandes] = useState(true);
  const choisies = useMemo(() => (toutes ? sections : [section]), [toutes, sections, section]);
  const situation = useMemo(
    () => situationDispenses(elevesParSection, choisies, { moisAnnee, annee, tarifsClasses, schoolInfo }),
    [elevesParSection, choisies, moisAnnee, annee, tarifsClasses, schoolInfo],
  );
  const { total, groupes, demandes } = situation;
  const refusees = demandes.filter((d) => d.demande.statut === STATUT_REFUSEE).length;
  const monnaie = schoolInfo?.monnaie || getMonnaie();
  const perimetre = toutes ? t("accounting.exempt.print.scopeAll") : libelleSection(section);

  const imprimer = () => {
    imprimerSituationDispenses(situation, { detail, avecDemandes, schoolInfo, annee, perimetre });
    fermer();
  };

  return (
    <div style={{ border: "1px solid #bfdbfe", background: "#f8fbff", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f4c81", textTransform: "uppercase", letterSpacing: ".06em" }}>
        🖨️ {t("accounting.exempt.print.title")}
      </p>

      {plusieurs && <>
        <div style={titreBloc}>{t("accounting.exempt.print.scope")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Choix nom="perimetre-dispenses" actif={!toutes} onChange={() => setToutes(false)}>
            {t("accounting.exempt.print.scopeCurrent", { section: libelleSection(section) })}
          </Choix>
          <Choix nom="perimetre-dispenses" actif={toutes} onChange={() => setToutes(true)}>
            {t("accounting.exempt.print.scopeAll")}
          </Choix>
        </div>
      </>}

      <div style={titreBloc}>{t("accounting.exempt.print.content")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Choix nom="detail-dispenses" actif={detail === "eleves"} onChange={() => setDetail("eleves")}>
          👤 {t("accounting.exempt.print.contentStudents")}
        </Choix>
        <Choix nom="detail-dispenses" actif={detail === "stats"} onChange={() => setDetail("stats")}>
          📊 {t("accounting.exempt.print.contentStats")}
        </Choix>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={avecDemandes} onChange={(e) => setAvecDemandes(e.target.checked)} />
        {t("accounting.exempt.print.requests", { pending: demandes.length - refusees, refused: refusees })}
      </label>

      <div style={{ fontSize: 12, color: "#334155", margin: "14px 0 4px", fontWeight: 700 }}>
        {t("accounting.exempt.print.summary", {
          n: total.dispenses, effectif: total.effectif, part: taux(total.dispenses, total.effectif),
          classes: groupes.length, amount: fmtN(total.montant), currency: monnaie,
        })}
      </div>
      <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, lineHeight: 1.6, color: "#475569" }}>
        {["mensualites", "inscription", "fraisAnnexes"].map((poste) => {
          const p = total.parPoste[poste];
          return (
            <li key={poste}>
              {t("accounting.exempt.print.postLine", {
                label: t(`accounting.exempt.post.${poste}`), n: p.eleves, full: p.totale, partial: p.partielle,
                amount: fmtN(p.montant), currency: monnaie,
              })}
            </li>
          );
        })}
      </ul>
      {total.dispenses > 0 && (
        <div style={{ fontSize: 12, color: "#334155", marginTop: 8, fontWeight: 700 }}>
          {t("accounting.exempt.print.paySummary", {
            paid: fmtN(total.paye), due: fmtN(total.aPayer), part: taux(total.paye, total.aPayer), rest: fmtN(total.reste),
            late: total.etats.retard, none: total.rienPaye, currency: monnaie,
          })}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>{t("accounting.exempt.print.note")}</div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn sm v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn sm disabled={!total.effectif} onClick={imprimer}>🖨️ {t("common.print")}</Btn>
      </div>
    </div>
  );
}
