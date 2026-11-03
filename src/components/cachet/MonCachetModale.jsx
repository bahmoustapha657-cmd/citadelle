// ══════════════════════════════════════════════════════════════
//  Mon cachet et ma signature — menu profil
// ══════════════════════════════════════════════════════════════
// Le comptable ou le chef de section dépose lui-même la photo de son cachet
// signé. Elle ne s'imprime que sur les documents qu'IL imprime et qu'il
// signe d'après « Qui signe quoi » ; personne d'autre ne peut la poser, la
// changer ni l'imprimer (voir src/backend/cachet-supabase.js).
// Une fois la photo prise ou choisie, des réglages (ReglagesCachet) la
// travaillent en direct : papier, lumière, couleur de l'encre, redressement.
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Modale } from "../ui";
import { SchoolContext } from "../../contexts/SchoolContext";
import { enregistrerMonCachet } from "../../backend/cachet-supabase";
import { ajusterCompteMemorise } from "../../backend/auth-supabase";
import { REGLAGES_CACHET, chargerCachet, rendreCachet } from "./preparer-cachet";
import { documentsSignesPar, identiteApercu } from "./cachet-documents";
import CameraCachet from "./CameraCachet";
import ReglagesCachet from "./ReglagesCachet";

const styleBouton = {
  display: "inline-block", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
  background: "#e0ebf8", color: "#1e3a5f", border: "none", cursor: "pointer",
};
const styleLegende = { margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };

const PAPIER = "#fbfaf7";
const DAMIER = "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 16px 16px";
// En dessous (plus grand côté, en px), le cachet manque de détail une fois
// imprimé sur 2 cm environ.
const COTE_CONSEILLE = 160;

function Apercu({ identite, image }) {
  return (
    <div style={{ background: PAPIER, border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: 200, textAlign: "center", fontSize: 12, color: "#0f172a", fontFamily: "Georgia, serif" }}>
        {identite?.titre || "Signataire"}
        {identite?.nom && <div style={{ fontWeight: 800, fontSize: 13 }}>{identite.nom}</div>}
        {image
          ? <img src={image} crossOrigin="anonymous" alt="Cachet" style={{ display: "block", height: 72, maxWidth: "100%", objectFit: "contain", margin: "6px auto", mixBlendMode: "multiply" }} />
          : <div style={{ height: 72, margin: "6px 0", border: "1.5px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>signature à la main</div>}
        <div style={{ fontSize: 10, color: "#64748b" }}>Signature &amp; Cachet</div>
      </div>
    </div>
  );
}

// L'image seule, en grand : sur damier quand le papier est effacé, pour voir
// ce qui reste vraiment (et ce qui s'imprimera).
function ImageSeule({ image, transparente }) {
  return (
    <div style={{ background: transparente ? DAMIER : "#fff", border: "1px solid #e2e8f0", borderRadius: 10, height: 160, padding: 8, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
      {image
        ? <img src={image} alt="Image du cachet" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : <span style={{ fontSize: 11, color: "#94a3b8" }}>Aucun tracé</span>}
    </div>
  );
}

export default function MonCachetModale({ utilisateur, setUtilisateur, fermer }) {
  const { schoolInfo, toast } = useContext(SchoolContext);
  const cle = utilisateur.posteCle || utilisateur.role;
  const actuel = utilisateur.cachetUrl || "";
  const [source, setSource] = useState(null); // photo décodée, avant réglages
  const [reglages, setReglages] = useState(REGLAGES_CACHET);
  const [rendu, setRendu] = useState(null); // { url, largeur, hauteur }
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [camera, setCamera] = useState(false);
  const champFichier = useRef(null);
  const image = rendu?.url || "";

  const documents = useMemo(() => documentsSignesPar(schoolInfo, cle), [schoolInfo, cle]);
  const identite = useMemo(() => identiteApercu(schoolInfo, cle, utilisateur.nomSignature), [schoolInfo, cle, utilisateur.nomSignature]);

  // Rendu à chaque réglage, un court instant après le dernier mouvement du
  // curseur : un téléphone modeste suit sans saccades.
  useEffect(() => {
    if (!source) return undefined;
    const id = setTimeout(() => {
      try {
        setRendu(rendreCachet(source, reglages));
        setErreur("");
      } catch (e) {
        setRendu(null);
        setErreur(e.message);
      }
    }, 120);
    return () => clearTimeout(id);
  }, [source, reglages]);

  const utiliser = async (f) => {
    setErreur("");
    try {
      const s = await chargerCachet(f);
      // Nouvelle photo : les réglages de lumière et d'encre restent, le
      // redressement propre à l'ancienne photo repart de zéro.
      setReglages((r) => ({ ...r, quart: 0, inclinaison: 0 }));
      setRendu(null);
      setSource(s);
    } catch (e) {
      setSource(null);
      setRendu(null);
      setErreur(e.message);
    }
  };

  const choisir = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) utiliser(f);
  };

  const photoPrise = (f) => {
    setCamera(false);
    utiliser(f);
  };

  const changer = (champs) => setReglages((r) => ({ ...r, ...champs }));

  const enregistrer = async (nouvelle) => {
    if (!navigator.onLine) { setErreur("Connexion internet requise pour enregistrer votre cachet."); return; }
    setOccupe(true); setErreur("");
    try {
      const url = await enregistrerMonCachet({
        compteId: utilisateur.compteDocId, schoolId: utilisateur.schoolId, image: nouvelle, ancienne: actuel,
      });
      // Session et compte mémorisé : le cachet sert dès maintenant, hors ligne
      // compris au prochain lancement.
      setUtilisateur((u) => ({ ...u, cachetUrl: url }));
      ajusterCompteMemorise(utilisateur.uid, { cachetUrl: url });
      toast?.(url ? "Cachet enregistré : il s'imprimera sur les documents que vous signez." : "Cachet retiré.");
      fermer();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  };

  if (camera) {
    return (
      <Modale titre="📷 Photographier mon cachet" fermer={fermer}>
        <CameraCachet onPhoto={photoPrise} onAnnuler={() => setCamera(false)}
          onChoisirFichier={() => setTimeout(() => champFichier.current?.click(), 0)} />
      </Modale>
    );
  }

  const petite = rendu && Math.max(rendu.largeur, rendu.hauteur) < COTE_CONSEILLE;

  return (
    <Modale titre="🖋️ Mon cachet et ma signature" fermer={fermer} large={!!source}>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
        Déposez une photo de votre cachet, signé de votre main. Il s'imprimera à votre place de signataire,
        <strong> seulement sur les documents que vous imprimez vous-même</strong>. Vous seul pouvez le déposer, le changer ou le retirer.
      </p>
      {documents.length
        ? <p style={{ margin: "0 0 14px", fontSize: 12, color: "#475569" }}>Documents concernés : {documents.join(", ")}.</p>
        : <p style={{ margin: "0 0 14px", fontSize: 12, color: "#b45309" }}>⚠️ Votre poste ne signe aucun document pour l'instant (Comptes &amp; Postes → Qui signe quoi) : le cachet ne s'imprimera nulle part.</p>}

      {source ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <p style={styleLegende}>Sur le document</p>
            <Apercu identite={identite} image={image} />
            <p style={{ ...styleLegende, marginTop: 12 }}>{reglages.nettoyer ? "Image détourée" : "Image"}</p>
            <ImageSeule image={image} transparente={reglages.nettoyer} />
            {rendu && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>Image : {rendu.largeur} × {rendu.hauteur} px</p>}
            {petite && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "8px 10px", borderRadius: 8 }}>
                💡 Le cachet est petit sur la photo : il manquera de netteté une fois imprimé. Reprenez-le de plus près.
              </p>
            )}
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <ReglagesCachet reglages={reglages} changer={changer} desactive={occupe} />
          </div>
        </div>
      ) : (
        <Apercu identite={identite} image={actuel} />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "14px 0 6px" }}>
        <button type="button" onClick={() => { setErreur(""); setCamera(true); }} disabled={occupe} style={styleBouton}>
          📷 {actuel || source ? "Reprendre une photo" : "Prendre une photo"}
        </button>
        <button type="button" onClick={() => champFichier.current?.click()} disabled={occupe} style={styleBouton}>
          🖼️ {source ? "Choisir une autre image" : "Choisir une image"}
        </button>
        <input ref={champFichier} type="file" accept="image/*" onChange={choisir} style={{ display: "none" }} />
      </div>
      {!source && (
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "#64748b" }}>
          Conseil : tamponnez et signez sur une feuille blanche, puis photographiez-la à plat, bien éclairée, sans ombre et au plus près.
          Vous pourrez ensuite régler la lumière, la couleur de l'encre et redresser l'image.
        </p>
      )}

      {erreur && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{erreur}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {actuel && !source && <Btn v="ghost" disabled={occupe} onClick={() => enregistrer("")}>Retirer mon cachet</Btn>}
        <Btn v="ghost" disabled={occupe} onClick={fermer}>Annuler</Btn>
        <Btn disabled={occupe || !image} onClick={() => enregistrer(image)}>{occupe ? "Enregistrement…" : "Enregistrer"}</Btn>
      </div>
    </Modale>
  );
}
