import { useEffect, useRef, useState } from "react";
import { urlVocal } from "../../backend/messagerie-supabase";
import { formatChrono } from "./messagerie-logic";

// Lecteur de message vocal : téléchargé au premier appui (bucket privé),
// puis lu depuis la mémoire.
export function LecteurVocal({ chemin, duree, clair = false }) {
  const audioRef = useRef(null);
  const [etat, setEtat] = useState("repos"); // repos | chargement | lecture | pause | erreur
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(duree || 0);

  useEffect(() => () => audioRef.current?.pause(), []);

  const basculer = async (e) => {
    e.stopPropagation();
    if (etat === "lecture") { audioRef.current?.pause(); return; }
    if (audioRef.current) { audioRef.current.play().catch(() => setEtat("erreur")); return; }
    setEtat("chargement");
    try {
      const audio = new Audio(await urlVocal(chemin));
      audioRef.current = audio;
      audio.ontimeupdate = () => setPosition(audio.currentTime);
      audio.onloadedmetadata = () => { if (Number.isFinite(audio.duration)) setTotal(audio.duration); };
      audio.onplay = () => setEtat("lecture");
      audio.onpause = () => setEtat("pause");
      audio.onended = () => { setEtat("pause"); setPosition(0); };
      await audio.play();
    } catch {
      setEtat("erreur");
    }
  };

  const avance = total ? Math.min(100, (position / total) * 100) : 0;
  const couleur = clair ? "#fff" : "var(--sc1)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 190 }}>
      <button type="button" onClick={basculer} disabled={etat === "chargement"}
        aria-label={etat === "lecture" ? "Pause" : "Écouter le message vocal"}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          background: clair ? "rgba(255,255,255,0.22)" : "var(--sc1-lt)", color: couleur, fontSize: 14,
        }}>
        {etat === "chargement" ? "…" : etat === "lecture" ? "❚❚" : etat === "erreur" ? "⚠" : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: clair ? "rgba(255,255,255,0.3)" : "var(--lc-border)", overflow: "hidden" }}>
          <div style={{ width: `${avance}%`, height: "100%", background: couleur, transition: "width .2s linear" }} />
        </div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
          {etat === "erreur" ? "Vocal indisponible" : `🎤 ${formatChrono(position || total)}`}
        </div>
      </div>
    </div>
  );
}
