import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtN, getMonnaie, getSectionLabelForClasse } from "../../../constants";
import { majReglagesCompta } from "../../../backend/data-supabase";
import { Btn, Input, Modale } from "../../ui";
import { exportExcel, imprimerAlerteMensualites } from "../../../reports";
import { JOUR_ECHEANCE_MAX, SEUIL_MOIS_MAX, elevesEnRetard, reglagesAlerte } from "./alerte-mensualites";

// Alertes des élèves en retard sur des mois DÉJÀ ÉCHUS (jour d'échéance et
// seuil réglés par la comptabilité). Repliées derrière un bouton cliquable ;
// suivent le filtre cycle + classe (via `eleves`, déjà filtré).
// `annee` : année scolaire affichée — les mois d'après un départ ne comptent pas.
// `perimetre` : section / classe affichées, reprises sur la fiche imprimée.
export function AlertesCritiques({ eleves, moisAnnee, annee, tarifsClasses, schoolInfo, canEdit, toast, perimetre }) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);
  const [reglant, setReglant] = useState(false);
  const { jourEcheance, seuilMois } = reglagesAlerte(schoolInfo);
  const reglages = useMemo(() => ({ jourEcheance, seuilMois }), [jourEcheance, seuilMois]);
  const retards = useMemo(
    () => elevesEnRetard(eleves, { moisAnnee, annee, tarifsClasses, reglages }),
    [eleves, moisAnnee, annee, tarifsClasses, reglages],
  );
  const monnaie = schoolInfo?.monnaie || getMonnaie();
  const total = retards.reduce((s, r) => s + r.montant, 0);

  const enregistrer = async (r) => {
    try {
      await majReglagesCompta({ alerteMensualites: r });
      toast?.("Réglages de l'alerte enregistrés.", "success");
      setReglant(false);
    } catch (e) {
      toast?.(`Réglages non enregistrés : ${e.message}`, "error");
    }
  };

  const modale = reglant && <ReglagesAlerteModale reglages={reglages} fermer={() => setReglant(false)} enregistrer={enregistrer} />;
  const boutonReglages = canEdit && <Btn sm v="ghost" onClick={() => setReglant(true)}>⚙️ Réglages</Btn>;
  const regle = `retard compté à partir du ${reglages.jourEcheance === 1 ? "1er" : reglages.jourEcheance} du mois · alerte dès ${reglages.seuilMois} mois`;

  if (retards.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap",
        background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "8px 14px" }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <strong style={{ fontSize: 13, color: "#065f46" }}>Alertes mensualités — aucun élève en retard</strong>
        <span style={{ fontSize: 11.5, color: "#047857" }}>({regle})</span>
        <span style={{ marginInlineStart: "auto" }}>{boutonReglages}</span>
        {modale}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" onClick={() => setOuvert((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer", flexWrap: "wrap",
          background: "#fce8e8", border: "1px solid #f5c1c1",
          borderRadius: ouvert ? "10px 10px 0 0" : 10, padding: "10px 14px", textAlign: "start" }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <strong style={{ fontSize: 13, color: "#9b2020" }}>
          Alertes mensualités — {retards.length} élève(s) en retard · {fmtN(total)} {monnaie} dû(s)
        </strong>
        <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 700, color: "#9b2020" }}>
          {ouvert ? "▾ Masquer" : "▸ Afficher"}
        </span>
      </button>

      {ouvert && (
        <div style={{ background: "#fff", border: "1px solid #f5c1c1", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: "#6b7280", flex: 1, minWidth: 180 }}>Règle : {regle}.</span>
            {boutonReglages}
            <Btn sm v="ghost" onClick={() => imprimerAlerteMensualites(retards, { schoolInfo, annee, perimetre, reglages })}>
              🖨️ Imprimer
            </Btn>
            <Btn sm v="ghost" onClick={() => exportExcel(
              t("reports.excel.files.paymentAlerts"),
              [t("reports.excel.headers.matricule"), t("reports.excel.headers.lastName"), t("reports.excel.headers.firstName"), t("reports.excel.headers.class"), t("reports.excel.headers.level"), t("reports.excel.headers.unpaidMonths"), "Mois en retard", `Reste dû (${monnaie})`, t("reports.excel.headers.guardian"), t("reports.excel.headers.contact")],
              retards.map(({ eleve: e, mois, montant }) => [
                e.matricule || "", e.nom, e.prenom, e.classe, getSectionLabelForClasse(e.classe),
                mois.length, mois.join(", "), montant, e.tuteur || "", e.contactTuteur || "",
              ]),
            )}>📥 {t("common.export")}</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
            {retards.map(({ eleve: e, mois, montant }) => (
              <div key={e._id} style={{ border: "1px solid #f5c1c1", borderRadius: 7, padding: "7px 10px", fontSize: 12, lineHeight: 1.5 }}>
                <div>
                  <span style={{ fontWeight: 800, color: "#9b2020" }}>{e.nom} {e.prenom}</span>
                  <span style={{ color: "#6b7280" }}> · {e.classe}</span>
                </div>
                <div>
                  <strong>{mois.length} mois</strong> : {mois.join(", ")}
                  {montant > 0 && <strong style={{ color: "#9b2020" }}> — {fmtN(montant)} {monnaie}</strong>}
                </div>
                <div style={{ color: "#475569" }}>
                  👤 {e.tuteur || "—"}
                  {e.contactTuteur
                    ? <> · 📞 <a href={`tel:${String(e.contactTuteur).replace(/[^\d+]/g, "")}`} style={{ color: "#1d4ed8" }}>{e.contactTuteur}</a></>
                    : " · 📞 —"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {modale}
    </div>
  );
}

// Jour à partir duquel un mois non payé compte comme en retard, et nombre
// de mois de retard déclenchant l'alerte. Enregistrés dans l'école (RPC
// maj_reglages_compta), mêmes bornes que le serveur.
function ReglagesAlerteModale({ reglages, fermer, enregistrer }) {
  const [jour, setJour] = useState(reglages.jourEcheance);
  const [seuil, setSeuil] = useState(reglages.seuilMois);
  const [enCours, setEnCours] = useState(false);
  const j = Number(jour);
  const s = Number(seuil);
  const valide = Number.isInteger(j) && j >= 1 && j <= JOUR_ECHEANCE_MAX
    && Number.isInteger(s) && s >= 1 && s <= SEUIL_MOIS_MAX;
  const valider = async () => {
    setEnCours(true);
    try { await enregistrer({ jourEcheance: j, seuilMois: s }); } finally { setEnCours(false); }
  };
  return (
    <Modale titre="⚙️ Réglages de l'alerte mensualités" fermer={fermer}>
      <Input label={`Jour d'échéance du mois (1 à ${JOUR_ECHEANCE_MAX})`} type="number" min="1" max={JOUR_ECHEANCE_MAX}
        value={jour} onChange={(e) => setJour(e.target.value)} />
      <div style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 14px" }}>
        Exemple : 10 → Octobre non payé compte comme en retard à partir du 10 octobre.
      </div>
      <Input label={`Nombre de mois de retard pour déclencher l'alerte (1 à ${SEUIL_MOIS_MAX})`} type="number" min="1" max={SEUIL_MOIS_MAX}
        value={seuil} onChange={(e) => setSeuil(e.target.value)} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={!valide || enCours} onClick={valider}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
