import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Btn } from "../ui";
import { GENRES, MESSAGE_MAX, cleErreurEnvoi, contexteRetour, genreDe, verifierRetour } from "../../retours-terrain";
import { envoyerRetour, mesRetours } from "../../backend/retours-terrain-supabase";
import { VERSION_APP } from "../../version-app";
import { localeCourante } from "../../i18n";

// Brouillon gardé sur l'appareil : un texte écrit sans réseau, ou une modale
// fermée par erreur, ne se perd pas.
const CLE_BROUILLON = "edugest.retourTerrain.brouillon";
function lireBrouillon() {
  try { return JSON.parse(localStorage.getItem(CLE_BROUILLON) || "null") || {}; } catch { return {}; }
}
function ecrireBrouillon(b) {
  try {
    if (b) localStorage.setItem(CLE_BROUILLON, JSON.stringify(b));
    else localStorage.removeItem(CLE_BROUILLON);
  } catch { /* stockage indisponible (navigation privée) : tant pis */ }
}

const COULEUR_STATUT = { nouveau: "amber", lu: "blue", traite: "green" };
const date = (ms) => (ms ? new Date(ms).toLocaleDateString(localeCourante(), { day: "numeric", month: "short", year: "numeric" }) : "");

// Contexte joint automatiquement : de quoi retrouver un problème sans
// rappeler l'école (écran, version, langue, appareil).
function contexteNavigateur(ecran, langue) {
  return contexteRetour({
    ecran,
    version: VERSION_APP.court,
    langue,
    enLigne: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    largeur: typeof window !== "undefined" ? window.innerWidth : 0,
    hauteur: typeof window !== "undefined" ? window.innerHeight : 0,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    installee: typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(display-mode: standalone)").matches : undefined,
  });
}

// Panneau « Signaler un problème ou proposer une idée » du centre d'aide :
// envoi d'un retour à EduGest et suivi de SES retours (statut, réponse).
// Logique : src/retours-terrain.js ; base : src/backend/retours-terrain-supabase.js.
export function RetourTerrain({ ecran = "", genreInitial = "", messageInitial = "", onRetour }) {
  const { t, i18n } = useTranslation();
  const [genre, setGenre] = useState(() => genreInitial || lireBrouillon().genre || "probleme");
  const [message, setMessage] = useState(() => messageInitial || lireBrouillon().message || "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [merci, setMerci] = useState(false);
  const [mes, setMes] = useState(null); // null = en cours de chargement
  const [erreurListe, setErreurListe] = useState(false);

  const charger = useCallback(() => mesRetours()
    .then((l) => { setMes(l); setErreurListe(false); })
    .catch(() => { setMes((avant) => avant || []); setErreurListe(true); }), []);
  useEffect(() => { charger(); }, [charger]);

  useEffect(() => { ecrireBrouillon(message.trim() ? { genre, message } : null); }, [genre, message]);

  const envoyer = async () => {
    const cle = verifierRetour({ genre, message });
    if (cle) { setErreur(cle); return; }
    setEnvoi(true); setErreur(""); setMerci(false);
    try {
      await envoyerRetour({
        genre,
        message: message.trim(),
        contexte: contexteNavigateur(ecran, i18n.resolvedLanguage || i18n.language),
      });
      setMessage("");
      setMerci(true);
      charger();
    } catch (e) {
      setErreur(cleErreurEnvoi(e));
    } finally {
      setEnvoi(false);
    }
  };

  const n = message.trim().length;

  return (
    <div>
      <button type="button" onClick={onRetour}
        style={{ background: "none", border: "none", padding: 0, marginBottom: 12, cursor: "pointer", color: "#0a7d5a", fontWeight: 700, fontSize: 13 }}>
        {t("feedback.backToHelp")}
      </button>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{t("feedback.intro")}</p>

      <div role="radiogroup" aria-label={t("feedback.genreLabel")} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {GENRES.map((g) => {
          const choisi = genre === g.id;
          return (
            <button key={g.id} type="button" role="radio" aria-checked={choisi} onClick={() => setGenre(g.id)}
              style={{ padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: choisi ? "2px solid #0a7d5a" : "1px solid #b0c4d8", background: choisi ? "#e7f6f0" : "#fff", color: choisi ? "#065f46" : "#334155" }}>
              {g.icone} {t(`feedback.genres.${g.id}`)}
            </button>
          );
        })}
      </div>

      <label htmlFor="retour-terrain-message" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#0A1628", marginBottom: 6 }}>
        {t("feedback.messageLabel")}
      </label>
      <textarea id="retour-terrain-message" value={message} maxLength={MESSAGE_MAX} rows={5}
        onChange={(e) => { setMessage(e.target.value); setMerci(false); if (erreur) setErreur(""); }}
        placeholder={t(`feedback.placeholders.${genre}`)}
        style={{ width: "100%", border: "1px solid #b0c4d8", borderRadius: 9, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#94a3b8", margin: "4px 0 10px" }}>
        <span>{t("feedback.contextNote")}</span>
        <span style={{ whiteSpace: "nowrap" }}>{n} / {MESSAGE_MAX}</span>
      </div>

      {erreur && <p role="alert" style={{ margin: "0 0 10px", fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{t(erreur)}</p>}
      {merci && <p role="status" style={{ margin: "0 0 10px", fontSize: 13, color: "#065f46", fontWeight: 700 }}>{t("feedback.thanks")}</p>}

      <Btn v="vert" onClick={envoyer} disabled={envoi || !n}>{envoi ? t("feedback.sending") : t("feedback.send")}</Btn>

      <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0A1628", margin: "22px 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {t("feedback.mine")}
      </h3>
      {erreurListe && <p style={{ fontSize: 12, color: "#b45309", margin: "0 0 8px" }}>{t("feedback.errors.list")}</p>}
      {mes === null && <p style={{ fontSize: 13, color: "#94a3b8" }}>{t("common.loading")}</p>}
      {mes && mes.length === 0 && !erreurListe && <p style={{ fontSize: 13, color: "#94a3b8" }}>{t("feedback.none")}</p>}
      {mes && mes.map((r) => {
        const g = genreDe(r.genre);
        return (
          <div key={r._id} data-testid="mon-retour" style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "10px 13px", marginBottom: 8, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              <strong style={{ color: "#1e293b" }}>{g ? `${g.icone} ${t(`feedback.genres.${g.id}`)}` : r.genre}</strong>
              <span>{date(r.createdAt)}</span>
              <Badge color={COULEUR_STATUT[r.statut]}>{t(`feedback.statuts.${r.statut}`)}</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.message}</p>
            {r.reponse && (
              <div style={{ marginTop: 8, borderInlineStart: "3px solid #0a7d5a", background: "#f0faf5", borderRadius: 6, padding: "8px 11px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46", marginBottom: 3 }}>
                  {t("feedback.replyFrom")} {r.reponduLe ? `· ${date(r.reponduLe)}` : ""}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#1e293b", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.reponse}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
