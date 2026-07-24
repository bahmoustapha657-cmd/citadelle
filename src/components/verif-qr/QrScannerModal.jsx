import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Modale, Btn } from "../ui";
import { getCameraErrorMessage } from "../camera-capture/camera-errors";
import { decryptQrPayload, parseQrPayload, schoolSecret } from "../../reports/qr-crypto";

// Scanner de vérification des QR codes EduGest (réservé à la direction). Les QR
// des documents (bulletins, reçus, fiches de paie) sont chiffrés avec le secret
// de l'école : un lecteur grand public n'y voit que du charabia ; ce scanner les
// déchiffre et affiche les champs authentiques.
//
// Décodage en pur JS (jsQR, via canvas) plutôt que l'API native BarcodeDetector :
// celle-ci n'existe pas du tout sur Safari/iOS, et sur Android elle dépend d'un
// module Google Play Services parfois absent/désactivé — elle apparaît alors
// "supportée" (présente dans window) mais ne détecte jamais rien, silencieusement.
// jsQR fonctionne partout (caméra ou photo importée), sans dépendance externe.
export function QrScannerModal({ schoolInfo = {}, fermer }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [etat, setEtat] = useState("init"); // init | scan | resultat | erreur
  const [resultat, setResultat] = useState(null); // { ok, champs }
  const [message, setMessage] = useState("");
  const secret = schoolSecret(schoolInfo);

  const stop = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const traiter = async (raw) => {
    stop();
    const clair = await decryptQrPayload(raw, secret);
    if (!clair) {
      setResultat({ ok: false });
    } else {
      const champs = parseQrPayload(clair);
      setResultat({ ok: true, type: champs.EduGest || "Document", champs });
    }
    setEtat("resultat");
  };

  // Ouvre la caméra en dégradant les contraintes : caméra arrière SOUHAITÉE
  // (`ideal`, pas `exact`) puis n'importe quelle caméra. Un poste fixe n'a
  // souvent qu'une webcam frontale : exiger `environment` y faisait échouer
  // l'ouverture, alors que la prise de photo (même stratégie de repli)
  // fonctionnait — d'où un scanner cassé sur PC uniquement.
  const ouvrirCamera = async () => {
    const contraintes = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: true, audio: false },
    ];
    let derniereErreur = null;
    for (const config of contraintes) {
      try {
        return await navigator.mediaDevices.getUserMedia(config);
      } catch (e) {
        derniereErreur = e;
        // Refus explicite de l'utilisateur : inutile de réessayer.
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") break;
      }
    }
    throw derniereErreur;
  };

  const demarrer = async () => {
    try {
      const stream = await ouvrirCamera();
      streamRef.current = stream;
      setEtat("scan");
      // <video>/<canvas> sont montés en permanence (masqués hors scan) : leurs
      // refs sont donc déjà disponibles ici. Auparavant ils n'étaient rendus
      // que dans l'état "scan" — le code s'exécutant avant le re-rendu de
      // React, canvasRef.current valait null et `.getContext` levait
      // « Cannot read properties of null », capturé par le catch qui affichait
      // à tort « Caméra indisponible » alors que la caméra s'était bien ouverte.
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("Affichage du scanner indisponible.");
      video.srcObject = stream;
      await video.play();
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const boucle = () => {
        if (!streamRef.current || !videoRef.current) return;
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height);
          if (code) { traiter(code.data); return; }
        }
        rafRef.current = requestAnimationFrame(boucle);
      };
      rafRef.current = requestAnimationFrame(boucle);
    } catch (e) {
      setEtat("erreur");
      // Message précis (même diagnostic que la prise de photo) : « accès
      // refusé », « aucune caméra », « déjà utilisée »… Le générique
      // précédent envoyait tout le monde chercher une autorisation.
      setMessage(`${getCameraErrorMessage(e)} Vous pouvez aussi importer une photo du QR.`);
    }
  };

  const onFichier = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height);
      if (code) traiter(code.data);
      else { setResultat({ ok: false }); setEtat("resultat"); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); setMessage("Lecture de l'image impossible."); };
    img.src = url;
  };

  const fermerTout = () => { stop(); fermer(); };

  const rejouer = () => { setResultat(null); setMessage(""); setEtat("init"); };

  return (
    <Modale titre="🔍 Vérifier un QR code" fermer={fermerTout}>
      {etat === "resultat" && resultat?.ok && (
        <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <strong style={{ fontSize: 15, color: "#166534" }}>QR authentique — {resultat.type}</strong>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {Object.entries(resultat.champs).filter(([k]) => k !== "EduGest").map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "5px 8px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: "#0f172a" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Btn v="vert" onClick={rejouer}>Scanner un autre</Btn>
            <Btn v="ghost" onClick={fermerTout}>Fermer</Btn>
          </div>
        </div>
      )}

      {etat === "resultat" && !resultat?.ok && (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>⛔</span>
            <strong style={{ fontSize: 15, color: "#991b1b" }}>QR non reconnu</strong>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#7f1d1d" }}>
            Ce QR n'est pas un document EduGest de votre école, ou il a été falsifié.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="vert" onClick={rejouer}>Réessayer</Btn>
            <Btn v="ghost" onClick={fermerTout}>Fermer</Btn>
          </div>
        </div>
      )}

      {/* Toujours montés (masqués hors scan) : les refs doivent exister AVANT
          que demarrer() n'attache le flux et ne lise le contexte 2D. */}
      <div style={{ display: etat === "scan" ? "block" : "none" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "1/1", objectFit: "cover" }} />
        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 8 }}>Visez le QR code du document…</p>
        <Btn v="ghost" onClick={fermerTout}>Annuler</Btn>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {(etat === "init" || etat === "erreur") && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          {message && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{message}</p>}
          <div style={{ marginBottom: 12 }}><Btn v="vert" onClick={demarrer}>📷 Démarrer le scan</Btn></div>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#334155", border: "1px solid #b0c4d8", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
              🖼️ Importer une photo du QR
              <input type="file" accept="image/*" capture="environment" onChange={onFichier} style={{ display: "none" }} />
            </label>
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            Seuls les QR des documents EduGest de votre école sont lisibles ici.
          </p>
        </div>
      )}
    </Modale>
  );
}
