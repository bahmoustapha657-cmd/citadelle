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
  // clair : sur la bulle « moi », couleur de l'école → écriture assortie.
  const couleur = clair ? "var(--msg-encre, #fff)" : "var(--msg-accent, var(--sc1))";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 190 }}>
      <button type="button" onClick={basculer} disabled={etat === "chargement"}
        aria-label={etat === "lecture" ? "Pause" : "Écouter le message vocal"}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 22%, transparent)" : "var(--msg-surbrillance, var(--sc1-lt))", color: couleur, fontSize: 14,
        }}>
        {etat === "chargement" ? "…" : etat === "lecture" ? "❚❚" : etat === "erreur" ? "⚠" : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 30%, transparent)" : "var(--lc-border)", overflow: "hidden" }}>
          <div style={{ width: `${avance}%`, height: "100%", background: couleur, transition: "width .2s linear" }} />
        </div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
          {etat === "erreur" ? "Vocal indisponible" : `🎤 ${formatChrono(position || total)}`}
        </div>
      </div>
    </div>
  );
}
