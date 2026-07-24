import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Badge, Btn, LectureSeule } from "../ui";
import { QrScannerModal } from "../verif-qr/QrScannerModal";

// En-tête du module Comptabilité : logo, titre, vérification de QR et
// sélecteur d'année. Le scanner est aussi ici (et pas seulement dans
// Primaire/Secondaire → Aperçu) : c'est la comptabilité qui reçoit les REÇUS
// de paiement présentés par les familles et doit pouvoir en vérifier
// l'authenticité.
export function ComptaHeader({ c, readOnly }) {
  const { t } = useTranslation();
  const [scanQr, setScanQr] = useState(false);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {c.schoolInfo?.logo && <img src={c.schoolInfo.logo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>{t("accounting.title")}</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.green, fontWeight: 600 }}>{t("accounting.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn sm v="ghost" onClick={() => setScanQr(true)}>🔍 Vérifier un QR</Btn>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("common.yearViewed")} :</label>
          <select value={c.anneeConsultee} onChange={(e) => c.setAnneeConsultee(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${c.enModeArchive ? "#f59e0b" : "#cbd5e1"}`, fontSize: 13, fontWeight: 700,
              background: c.enModeArchive ? "#fef3c7" : "#fff", color: c.enModeArchive ? "#92400e" : C.blueDark, cursor: "pointer" }}>
            {c.anneesDispo.map((a) => <option key={a} value={a}>{a}{a === c.anneeCourante ? ` (${t("common.current")})` : ""}</option>)}
          </select>
          {c.enModeArchive && <Badge color="orange">📚 {t("common.archive")} — {t("common.readOnly")}</Badge>}
        </div>
      </div>
      {readOnly && <LectureSeule />}
      {scanQr && <QrScannerModal schoolInfo={c.schoolInfo} fermer={() => setScanQr(false)} />}
    </>
  );
}
