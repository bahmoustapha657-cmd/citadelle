import { useEffect, useRef, useState } from "react";
import { Modale, Btn, Vide } from "../ui";
import { decryptQrPayload, parseQrPayload, schoolSecret } from "../../reports/qr-crypto";

// Scanner de vérification des QR codes EduGest (réservé à la direction). Les QR
// des documents (bulletins, reçus, fiches de paie) sont chiffrés avec le secret
// de l'école : un lecteur grand public n'y voit que du charabia ; ce scanner les
// déchiffre et affiche les champs authentiques. Utilise l'API BarcodeDetector
// (Chrome/Android) ; repli par import d'une photo.
export function QrScannerModal({ schoolInfo = {}, fermer }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [etat, setEtat] = useState("init"); // init | scan | resultat | nosupport | erreur
  const [resultat, setResultat] = useState(null); // { ok, champs }
  const [message, setMessage] = useState("");
  const secret = schoolSecret(schoolInfo);
  const supporte = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stop = () => {
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

  const demarrer = async () => {
    if (!supporte) { setEtat("nosupport"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEtat("scan");
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const boucle = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) { await traiter(codes[0].rawValue); return; }
        } catch { /* erreurs de frame ignorées */ }
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    } catch {
      setEtat("erreur");
      setMessage("Caméra indisponible. Autorisez l'accès ou importez une photo du QR.");
    }
  };

  const onFichier = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supporte) { setEtat("nosupport"); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      if (codes && codes.length) await traiter(codes[0].rawValue);
      else { setResultat({ ok: false }); setEtat("resultat"); }
    } catch {
      setMessage("Lecture de l'image impossible.");
    }
  };

  const fermerTout = () => { stop(); fermer(); };

  const rejouer = () => { setResultat(null); setEtat("init"); };

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

      {etat === "scan" && (
        <div>
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "1/1", objectFit: "cover" }} />
          <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 8 }}>Visez le QR code du document…</p>
          <Btn v="ghost" onClick={fermerTout}>Annuler</Btn>
        </div>
      )}

      {etat === "nosupport" && (
        <Vide icone="📷" msg="Le scan caméra n'est pas pris en charge par ce navigateur. Utilisez Chrome sur Android, ou importez une photo du QR ci-dessous." />
      )}

      {(etat === "init" || etat === "nosupport" || etat === "erreur") && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          {message && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{message}</p>}
          {supporte && etat !== "nosupport" && (
            <div style={{ marginBottom: 12 }}><Btn v="vert" onClick={demarrer}>📷 Démarrer le scan</Btn></div>
          )}
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
