import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Modale, Btn } from "../ui";
import { getCameraErrorMessage } from "../camera-capture/camera-errors";
import { decryptQrPayload, parseQrPayload, schoolSecretCandidates } from "../../reports/qr-crypto";

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
  const detecteurRef = useRef(null);
  const [etat, setEtat] = useState("init"); // init | scan | resultat | erreur
  const [resultat, setResultat] = useState(null); // { ok, champs }
  const [message, setMessage] = useState("");
  const [resolution, setResolution] = useState(null); // { w, h } réellement obtenus
  // Plusieurs secrets candidats plutôt qu'un seul : les documents déjà imprimés
  // l'ont été avec le secret en vigueur à l'époque (longtemps le NOM de
  // l'école). On reste ainsi lisible après un renommage. Cf. qr-crypto.js.
  const secrets = schoolSecretCandidates(schoolInfo);

  const stop = () => {
    if (rafRef.current) { clearTimeout(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const traiter = async (raw) => {
    stop();
    const clair = await decryptQrPayload(raw, secrets);
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
    // Résolution la plus haute possible : un QR de document est petit et
    // dense (le contenu est chiffré, donc long). En 640×480 — ce que la
    // plupart des navigateurs donnent par défaut — les modules du QR
    // tombent sous le seuil de détection de jsQR. On demande donc du
    // 1920×1080 en `ideal` (jamais `exact` : la caméra dégrade d'elle-même
    // si elle ne sait pas faire, plutôt que d'échouer).
    const HD = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const contraintes = [
      { video: { facingMode: { ideal: "environment" }, ...HD }, audio: false },
      { video: { ...HD }, audio: false },
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
      // Résolution réellement obtenue : la caméra peut ignorer notre demande
      // (webcam d'ordinateur portable souvent limitée à 640×480). L'afficher
      // évite de chercher au hasard quand un QR ne passe pas.
      const piste = stream.getVideoTracks()[0];
      // Mise au point CONTINUE : c'est le facteur décisif. Mesuré : à partir
      // de ~2 px de flou, un QR devient illisible quelle que soit sa taille ou
      // la définition du capteur. Beaucoup de navigateurs démarrent en mise au
      // point fixe ; on la demande explicitement (ignorée silencieusement là où
      // elle n'est pas supportée — d'où le try/catch sans message).
      try {
        const possibles = piste?.getCapabilities?.() || {};
        if (possibles.focusMode?.includes("continuous")) {
          await piste.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        }
      } catch { /* réglage non supporté : on scanne quand même */ }
      const reglages = piste?.getSettings?.() || {};
      setResolution({ w: reglages.width || 0, h: reglages.height || 0 });

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // Canvas de repli réutilisé (pas de réallocation par image).
      const plein = document.createElement("canvas");
      const pctx = plein.getContext("2d", { willReadFrequently: true });

      // Détecteur NATIF du navigateur, s'il existe : il s'appuie sur le moteur
      // du système (accéléré, tolérant au flou et aux angles) et rattrape des
      // QR que jsQR laisse passer. Il n'est pas fiable partout (absent de
      // Safari/iOS, dépendant de Google Play Services sur Android), d'où son
      // usage en PREMIÈRE tentative seulement, jsQR restant le filet.
      let detecteurNatif = null;
      try {
        if (typeof window.BarcodeDetector === "function") {
          const formats = await window.BarcodeDetector.getSupportedFormats?.();
          if (!formats || formats.includes("qr_code")) {
            detecteurNatif = new window.BarcodeDetector({ formats: ["qr_code"] });
          }
        }
      } catch { /* pas de détecteur natif : jsQR fera le travail */ }
      detecteurRef.current = detecteurNatif;

      // ⚠️ La boucle est ASYNCHRONE (le détecteur natif renvoie une promesse).
      // Toute exception non capturée y rejetterait la promesse en silence et
      // la ré-planification ne serait jamais atteinte : le scan s'arrêterait
      // sans le moindre message. D'où le try/catch enveloppant TOUT le corps
      // et la ré-planification dans le `finally` — la boucle survit à
      // n'importe quelle erreur d'une image.
      const boucle = async () => {
        if (!streamRef.current || !videoRef.current) return;
        let trouve = false;
        try {
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            // 1) Détecteur natif du navigateur (le plus tolérant au flou).
            if (detecteurRef.current) {
              try {
                const trouves = await detecteurRef.current.detect(video);
                if (trouves?.length && trouves[0].rawValue) {
                  trouve = true;
                  traiter(trouves[0].rawValue);
                }
              } catch { detecteurRef.current = null; /* défaillant : on s'en passe */ }
            }

            // 2) jsQR sur le CARRÉ CENTRAL — la zone que l'utilisateur voit
            // (vidéo affichée en 1:1 « cover ») et où il place le QR.
            if (!trouve) {
              const cote = Math.min(vw, vh);
              canvas.width = cote;
              canvas.height = cote;
              ctx.drawImage(video, (vw - cote) / 2, (vh - cote) / 2, cote, cote, 0, 0, cote, cote);
              const image = ctx.getImageData(0, 0, cote, cote);
              let code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });

              // 3) Repli : image entière réduite — rattrape un QR hors du
              // centre, et le sous-échantillonnage rend les modules plus francs.
              if (!code) {
                const ech = Math.min(1, 800 / Math.max(vw, vh));
                plein.width = Math.round(vw * ech);
                plein.height = Math.round(vh * ech);
                pctx.drawImage(video, 0, 0, plein.width, plein.height);
                const img2 = pctx.getImageData(0, 0, plein.width, plein.height);
                code = jsQR(img2.data, img2.width, img2.height, { inversionAttempts: "attemptBoth" });
              }
              if (code) { trouve = true; traiter(code.data); }
            }
          }
        } catch { /* image illisible : on retente à la suivante */ }
        finally {
          // setTimeout et NON requestAnimationFrame : rAF est SUSPENDU dès que
          // la page passe en arrière-plan (appel entrant, changement d'appli,
          // onglet masqué) et le scan ne repartait jamais. ~12 images/seconde
          // suffisent très largement pour lire un QR, et c'est plus économe en
          // batterie que les 60 fps de rAF.
          if (!trouve && streamRef.current) rafRef.current = setTimeout(boucle, 80);
        }
      };
      rafRef.current = setTimeout(boucle, 0);
    } catch (e) {
      setEtat("erreur");
      // Message précis (même diagnostic que la prise de photo) : « accès
      // refusé », « aucune caméra », « déjà utilisée »… Le générique
      // précédent envoyait tout le monde chercher une autorisation.
      setMessage(`${getCameraErrorMessage(e)} Vous pouvez aussi importer une photo du QR.`);
    }
  };

  // Capture MANUELLE : l'utilisateur cadre, attend que ce soit net, puis
  // déclenche. On analyse alors UNE image — sans la contrainte de temps réel,
  // on peut tenter plusieurs échelles et le détecteur natif. C'est la voie la
  // plus sûre quand le flux direct échoue (l'import de photo, qui fonctionne
  // déjà, repose sur le même principe : une image figée et nette).
  const capturer = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setMessage("");
    const vw = video.videoWidth, vh = video.videoHeight;
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });

    // Détecteur natif d'abord (le plus tolérant), puis jsQR à plusieurs
    // échelles : le sous-échantillonnage rend souvent les modules plus francs.
    if (detecteurRef.current) {
      try {
        const trouves = await detecteurRef.current.detect(video);
        if (trouves?.length && trouves[0].rawValue) { traiter(trouves[0].rawValue); return; }
      } catch { /* on continue avec jsQR */ }
    }
    const cote = Math.min(vw, vh);
    for (const facteur of [1, 0.6, 0.4, 1.5]) {
      const taille = Math.round(cote * facteur);
      cv.width = taille; cv.height = taille;
      cx.imageSmoothingEnabled = true;
      cx.drawImage(video, (vw - cote) / 2, (vh - cote) / 2, cote, cote, 0, 0, taille, taille);
      const img = cx.getImageData(0, 0, taille, taille);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code) { traiter(code.data); return; }
    }
    setMessage("QR non détecté sur cette image. Vérifiez que le QR est net (reculez un peu) puis réessayez.");
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
        {/* Cadre de visée : matérialise la zone réellement analysée. */}
        <div style={{ position: "relative" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
          <div aria-hidden="true" style={{
            position: "absolute", inset: "12%", border: "3px solid rgba(255,255,255,0.85)",
            borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)", pointerEvents: "none",
          }} />
        </div>
        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
          Placez le QR dans le cadre, à <strong>15–20 cm</strong> environ.<br />
          <span style={{ fontSize: 11 }}>
            Trop près, l'appareil ne fait plus la mise au point et l'image devient floue :
            reculez un peu jusqu'à ce que le QR soit net.
          </span>
        </p>
        {resolution?.w > 0 && (() => {
          // En mode PORTRAIT (téléphone), la largeur vaut 1080 et la hauteur
          // 1920 : juger sur la seule largeur qualifiait à tort une caméra
          // Full HD de « limitée ». On compare donc le plus GRAND côté.
          const grandCote = Math.max(resolution.w, resolution.h);
          const bonne = grandCote >= 1280;
          return (
            <p style={{ fontSize: 11, textAlign: "center", margin: "0 0 8px", color: bonne ? "#16a34a" : "#b45309" }}>
              Caméra : {resolution.w}×{resolution.h}{bonne ? " — définition suffisante" : " — définition limitée : approchez le document ou importez une photo."}
            </p>
          );
        })()}
        {message && <p style={{ fontSize: 12, color: "#b91c1c", textAlign: "center", margin: "0 0 8px" }}>{message}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Btn v="vert" onClick={capturer}>📸 Capturer maintenant</Btn>
          <Btn v="ghost" onClick={fermerTout}>Annuler</Btn>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {(etat === "init" || etat === "erreur") && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          {message && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{message}</p>}
          <div style={{ marginBottom: 12 }}><Btn v="vert" onClick={demarrer}>📷 Démarrer le scan</Btn></div>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#334155", border: "1px solid #b0c4d8", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
              🖼️ Importer une photo du QR
              {/* PAS d'attribut `capture` : sur téléphone il force la prise de
                  photo immédiate et empêche de choisir une image déjà prise
                  dans la galerie — c'est justement ce qu'on veut proposer en
                  secours quand le scan direct ne passe pas. */}
              <input type="file" accept="image/*" onChange={onFichier} style={{ display: "none" }} />
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
