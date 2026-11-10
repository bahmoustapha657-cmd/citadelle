import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { urlVocal } from "../../backend/messagerie-supabase";
import { formatChrono } from "./messagerie-logic";
import { ETATS_ERREUR, raisonLecture, telechargerAvecReprises } from "./lecteur-vocal-logic";

// Lecteur de message vocal : téléchargé au premier appui (bucket privé),
// puis lu depuis la mémoire. Un échec dit sa raison et, sauf format illisible,
// se rattrape d'un toucher (lecteur-vocal-logic.js).
export function LecteurVocal({ chemin, duree, clair = false }) {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  // repos | chargement | lecture | pause | reseau | geste | format | inconnue
  const [etat, setEtat] = useState("repos");
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(duree || 0);

  useEffect(() => () => audioRef.current?.pause(), []);

  const lire = async (audio) => {
    try {
      await audio.play();
    } catch (e) {
      const raison = raisonLecture(e, audio);
      // Format illisible : l'élément ne servira plus, un autre essai repartirait de zéro.
      if (raison === "format") audioRef.current = null;
      setEtat(raison);
    }
  };

  const basculer = async (e) => {
    e.stopPropagation();
    if (etat === "lecture") { audioRef.current?.pause(); return; }
    if (etat === "format") return;
    // Déjà téléchargé (pause, ou lecture refusée faute de toucher récent).
    if (audioRef.current) { lire(audioRef.current); return; }
    setEtat("chargement");
    let url;
    try {
      url = await telechargerAvecReprises(() => urlVocal(chemin));
    } catch {
      setEtat("reseau");
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.ontimeupdate = () => setPosition(audio.currentTime);
    audio.onloadedmetadata = () => { if (Number.isFinite(audio.duration)) setTotal(audio.duration); };
    audio.onplay = () => setEtat("lecture");
    audio.onpause = () => setEtat("pause");
    audio.onended = () => { setEtat("pause"); setPosition(0); };
    await lire(audio);
  };

  const erreur = ETATS_ERREUR[etat];
  const avance = total ? Math.min(100, (position / total) * 100) : 0;
  // clair : sur la bulle « moi », couleur de l'école → écriture assortie.
  const couleur = clair ? "var(--msg-encre, #fff)" : "var(--msg-accent, var(--sc1))";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 190 }}>
      <button type="button" onClick={basculer} disabled={etat === "chargement" || etat === "format"}
        aria-label={etat === "lecture" ? t("msg.voice.pause") : t("msg.voice.listen")}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: "none", cursor: etat === "format" ? "default" : "pointer", flexShrink: 0,
          background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 22%, transparent)" : "var(--msg-surbrillance, var(--sc1-lt))", color: couleur, fontSize: 14,
        }}>
        {etat === "chargement" ? "…" : etat === "lecture" ? "❚❚" : erreur ? erreur.icone : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 30%, transparent)" : "var(--lc-border)", overflow: "hidden" }}>
          <div style={{ width: `${avance}%`, height: "100%", background: couleur, transition: "width .2s linear" }} />
        </div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
          {erreur ? t(erreur.cle) : etat === "chargement" ? t("msg.voice.loading") : `🎤 ${formatChrono(position || total)}`}
        </div>
      </div>
    </div>
  );
}
