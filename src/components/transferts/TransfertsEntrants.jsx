import { C, fmt } from "../../constants";
import { Btn, Card } from "../ui";

// Sous-onglet "Entrants" : import d'un élève via token EduGest (vérification +
// acceptation) et renvoi vers l'enrôlement pour un enregistrement manuel.
export function TransfertsEntrants({ h, setTab }) {
  const { tokenInput, setTokenInput, verifierToken, loading, transfertData, accepterTransfert } = h;
  return (
    <>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
        Importez un élève transféré depuis une autre école EduGest via son token, ou créez manuellement sa fiche.
      </p>

      <Card style={{ marginBottom: 16, border: "2px solid #e0ebf8" }}>
        <div style={{ padding: "14px 18px" }}>
          <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>📥 Importer via token EduGest</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={tokenInput} onChange={e => setTokenInput(e.target.value.toUpperCase())}
              placeholder="Ex : TRF-A3K9B2"
              style={{ flex: 1, border: "1.5px solid #b0c4d8", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontFamily: "monospace", fontWeight: 700, letterSpacing: 2 }} />
            <Btn v="blue" onClick={verifierToken} disabled={loading}>{loading ? "⏳" : "🔍 Vérifier"}</Btn>
          </div>

          {transfertData && <div style={{ marginTop: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px" }}>
            <p style={{ margin: "0 0 10px", fontWeight: 800, color: "#14532d" }}>✅ Dossier trouvé — {transfertData.eleveSnapshot?.nom} {transfertData.eleveSnapshot?.prenom}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 12 }}>
              <span>Classe : <strong>{transfertData.eleveSnapshot?.classe}</strong></span>
              <span>École d'origine : <strong>{transfertData.eleveSnapshot?.schoolNom}</strong></span>
              <span>Date naissance : <strong>{transfertData.eleveSnapshot?.dateNaissance}</strong></span>
              <span>Situation : <strong style={{ color: transfertData.eleveSnapshot?.solde > 0 ? "#b91c1c" : "#15803d" }}>{transfertData.eleveSnapshot?.solde > 0 ? `Solde dû : ${fmt(transfertData.eleveSnapshot.solde)}` : "Situation apurée"}</strong></span>
            </div>
            <Btn v="success" onClick={accepterTransfert} disabled={loading}>
              {loading ? "⏳ Import en cours…" : "✅ Confirmer l'accueil — Créer la fiche élève"}
            </Btn>
          </div>}
        </div>
      </Card>

      <div style={{ textAlign: "center", padding: "10px 0", color: "#9ca3af", fontSize: 12, marginBottom: 12 }}>— ou —</div>

      <Card style={{ border: "2px dashed #b0c4d8" }}>
        <div style={{ padding: "14px 18px" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>📝 Enregistrement manuel (élève venant d'une école hors EduGest)</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>
            Créez directement la fiche élève depuis l'onglet <strong>Enrôlement</strong>, en complétant le champ "Établissement d'origine" et en sélectionnant "Réinscription" comme type d'inscription.
          </p>
          <Btn sm v="ghost" onClick={() => setTab && setTab("enrolment")}>→ Aller à l'Enrôlement</Btn>
        </div>
      </Card>
    </>
  );
}
