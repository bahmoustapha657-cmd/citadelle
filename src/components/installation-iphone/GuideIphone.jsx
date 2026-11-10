import { useTranslation } from "react-i18next";
import { Modale } from "../ui";
import { situationApple } from "./iphone";

// Icône « Partager » de Safari : un carré ouvert d'où sort une flèche.
function IconePartager() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-3px", margin: "0 2px" }}>
      <path d="M8 9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" />
      <path d="M12 15V3M8 7l4-4 4 4" />
    </svg>
  );
}

const ETAPES = ["step1", "step2", "step3", "step4", "step5", "step6"];

// Installer EduGest sur l'écran d'accueil, pas à pas (iOS 16.4 à iOS 26).
export function GuideIphone({ fermer }) {
  const { t } = useTranslation();
  const apple = situationApple();
  // Au-dessus de l'invitation à installer (InstallBanner, z-index 9998), qui
  // cacherait sinon le bas de la fenêtre sur un petit iPhone.
  return (
    <div style={{ position: "relative", zIndex: 10000 }}>
      <Modale titre={t("install.ios.title")} fermer={fermer}>
        {/* #root centre le texte de l'app : ici, des étapes à suivre. */}
        <div style={{ textAlign: "start" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5 }}>{t("install.ios.intro")}</p>
          {apple?.tropAncien && (
            <p style={{ margin: "0 0 14px", padding: "8px 10px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
              {t("install.ios.tooOld", { version: apple.version })}
            </p>
          )}
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {ETAPES.map((cle, i) => (
              <li key={cle} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "#0A1628", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
                <span style={{ paddingTop: 2 }}>
                  {cle === "step2" && <><IconePartager />{" "}</>}
                  {t(`install.ios.${cle}`)}
                </span>
              </li>
            ))}
          </ol>
          <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--lc-text-muted)" }}>{t("install.ios.ringtone")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" onClick={fermer}
              style={{ background: "#0A1628", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              {t("install.ios.ok")}
            </button>
          </div>
        </div>
      </Modale>
    </div>
  );
}
