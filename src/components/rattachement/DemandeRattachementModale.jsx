import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Input, Modale } from "../ui";
import { demanderRattachement } from "../../backend/rattachement-supabase";

// L'enseignant propose de rattacher les classes de l'espace ouvert à son
// école, qui utilise désormais EduGest (étape 3). Il saisit le code de
// l'école ; la direction verra la demande et reliera ses élèves.
export function DemandeRattachementModale({ etablissement, fermer, onEnvoyee }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const envoyer = async () => {
    const saisi = code.trim();
    if (!saisi) { setErreur(t("rattachement.errCode")); return; }
    setEnCours(true);
    setErreur("");
    try {
      const r = await demanderRattachement(saisi);
      onEnvoyee(r.ecoleNom || saisi);
    } catch (err) {
      setErreur(err?.message || String(err));
      setEnCours(false);
    }
  };

  return (
    <Modale titre={`🏫 ${t("rattachement.requestTitle")}`} fermer={enCours ? () => {} : fermer}>
      <p style={{ fontSize: 13, color: "var(--lc-text)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {t("rattachement.requestIntro", { etablissement })}
      </p>
      <ul style={{ fontSize: 12.5, color: "var(--lc-text-muted, #475569)", margin: "0 0 14px", paddingInlineStart: 18, lineHeight: 1.55 }}>
        <li>{t("rattachement.requestStep1")}</li>
        <li>{t("rattachement.requestStep2")}</li>
        <li>{t("rattachement.requestStep3")}</li>
      </ul>
      <Input label={t("rattachement.schoolCode")} aria-label={t("rattachement.schoolCode")}
        value={code} onChange={(e) => setCode(e.target.value)} disabled={enCours}
        placeholder={t("auth.schoolCodePlaceholder")} autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") envoyer(); }} />
      {erreur && <p role="alert" style={{ color: "#b91c1c", fontSize: 12.5, margin: "12px 0 0" }}>{erreur}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn onClick={envoyer} disabled={enCours}>
          {enCours ? t("rattachement.sending") : `📨 ${t("rattachement.send")}`}
        </Btn>
      </div>
    </Modale>
  );
}
