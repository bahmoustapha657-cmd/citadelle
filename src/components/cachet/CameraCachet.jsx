// Prise de photo du cachet avec la caméra de l'appareil (webcam du PC ou
// caméra arrière du téléphone). Le champ « choisir un fichier » seul ne
// permettait pas de photographier sur ordinateur, ni dans certaines
// applications Android. Même flux caméra que la photo d'élève
// (camera-capture/use-camera-capture.js), sans le guidage du visage : on
// place la feuille tamponnée dans le cadre, et seule cette zone est gardée —
// le bureau ou la main autour ne passent pas pour de l'encre.
import { useState } from "react";
import { Btn } from "../ui";
import { useCameraCapture } from "../camera-capture/use-camera-capture";
import { figerImage, libererCanvas } from "../camera-capture/photo-capture";

// Cadre de visée, en proportion de l'image. Contrairement à la photo d'élève,
// l'aperçu n'est jamais en miroir, même avec la webcam du PC : on photographie
// un document, son texte doit se lire à l'endroit.
const CADRE = { x: 0.12, y: 0.15, l: 0.76, h: 0.7 };

// Zone du cadre dans une image de `largeur` × `hauteur` pixels.
const zoneCadre = (largeur, hauteur) => ({
  x: Math.round(largeur * CADRE.x),
  y: Math.round(hauteur * CADRE.y),
  l: Math.round(largeur * CADRE.l),
  h: Math.round(hauteur * CADRE.h),
});

export default function CameraCachet({ onPhoto, onAnnuler, onChoisirFichier }) {
  const {
    videoRef, attacherVideo, surDimensions, erreur, pret, cameras,
    demarrerCamera, basculerCamera, arreterCamera,
  } = useCameraCapture();
  const [enCours, setEnCours] = useState(false);

  const capturer = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setEnCours(true);
    const image = figerImage(video);
    const z = zoneCadre(image.width, image.height);
    const cadre = document.createElement("canvas");
    cadre.width = z.l;
    cadre.height = z.h;
    cadre.getContext("2d").drawImage(image, z.x, z.y, z.l, z.h, 0, 0, z.l, z.h);
    libererCanvas(image);
    const blob = await new Promise((r) => cadre.toBlob(r, "image/jpeg", 0.92));
    libererCanvas(cadre);
    arreterCamera();
    setEnCours(false);
    if (blob) onPhoto(new File([blob], "cachet.jpg", { type: "image/jpeg" }));
  };

  const annuler = () => { arreterCamera(); onAnnuler(); };

  return (
    <div>
      {erreur ? (
        <div style={{ background: "#fee2e2", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <p style={{ margin: "0 0 10px", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{erreur}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn sm v="ghost" onClick={() => demarrerCamera()}>Réessayer</Btn>
            <Btn sm v="ghost" onClick={() => { annuler(); onChoisirFichier(); }}>🖼️ Choisir une image à la place</Btn>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>
            Posez la feuille à plat, bien éclairée, et placez le cachet signé dans le cadre.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ position: "relative", display: "inline-block", background: "#000", borderRadius: 10, overflow: "hidden", lineHeight: 0 }}>
              <video ref={attacherVideo} autoPlay playsInline muted
                onLoadedMetadata={surDimensions} onResize={surDimensions}
                style={{ display: "block", maxWidth: "100%", maxHeight: "55vh", minWidth: 220, minHeight: 160 }} />
              <div aria-hidden="true" style={{
                position: "absolute", left: `${CADRE.x * 100}%`, top: `${CADRE.y * 100}%`,
                width: `${CADRE.l * 100}%`, height: `${CADRE.h * 100}%`,
                border: "2px dashed #fff", borderRadius: 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
              }} />
              {!pret && (
                <p style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, lineHeight: 1.4 }}>
                  Ouverture de la caméra…
                </p>
              )}
            </div>
          </div>
        </>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {!erreur && cameras.length > 1 && <Btn v="ghost" onClick={basculerCamera} disabled={enCours}>🔄 Changer de caméra</Btn>}
        <Btn v="ghost" onClick={annuler}>Annuler</Btn>
        {!erreur && <Btn onClick={capturer} disabled={!pret || enCours}>📸 Prendre la photo</Btn>}
      </div>
    </div>
  );
}
