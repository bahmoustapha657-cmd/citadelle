// ══════════════════════════════════════════════════════════════
//  Mon cachet et ma signature — menu profil
// ══════════════════════════════════════════════════════════════
// Le comptable ou le chef de section dépose lui-même la photo de son cachet
// signé. Elle ne s'imprime que sur les documents qu'IL imprime et qu'il
// signe d'après « Qui signe quoi » ; personne d'autre ne peut la poser, la
// changer ni l'imprimer (voir src/backend/cachet-supabase.js).
import { useContext, useMemo, useRef, useState } from "react";
import { Btn, Modale } from "../ui";
import { SchoolContext } from "../../contexts/SchoolContext";
import { enregistrerMonCachet } from "../../backend/cachet-supabase";
import { ajusterCompteMemorise } from "../../backend/auth-supabase";
import { preparerCachet } from "./preparer-cachet";
import { documentsSignesPar, identiteApercu } from "./cachet-documents";
import CameraCachet from "./CameraCachet";

const styleBouton = {
  display: "inline-block", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
  background: "#e0ebf8", color: "#1e3a5f", border: "none", cursor: "pointer",
};

const PAPIER = "#fbfaf7";

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

export default function MonCachetModale({ utilisateur, setUtilisateur, fermer }) {
  const { schoolInfo, toast } = useContext(SchoolContext);
  const cle = utilisateur.posteCle || utilisateur.role;
  const actuel = utilisateur.cachetUrl || "";
  const [fichier, setFichier] = useState(null);
  const [nettoyer, setNettoyer] = useState(true);
  const [image, setImage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [camera, setCamera] = useState(false);
  const champFichier = useRef(null);

  const documents = useMemo(() => documentsSignesPar(schoolInfo, cle), [schoolInfo, cle]);
  const identite = useMemo(() => identiteApercu(schoolInfo, cle, utilisateur.nomSignature), [schoolInfo, cle, utilisateur.nomSignature]);

  const preparer = async (f, avecNettoyage) => {
    setErreur("");
    try {
      setImage(await preparerCachet(f, { nettoyer: avecNettoyage }));
    } catch (e) {
      setImage("");
      setErreur(e.message);
    }
  };

  const utiliser = (f) => {
    setFichier(f);
    preparer(f, nettoyer);
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

  const basculerNettoyage = (valeur) => {
    setNettoyer(valeur);
    if (fichier) preparer(fichier, valeur);
  };

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

  return (
    <Modale titre="🖋️ Mon cachet et ma signature" fermer={fermer}>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
        Déposez une photo de votre cachet, signé de votre main. Il s'imprimera à votre place de signataire,
        <strong> seulement sur les documents que vous imprimez vous-même</strong>. Vous seul pouvez le déposer, le changer ou le retirer.
      </p>
      {documents.length
        ? <p style={{ margin: "0 0 14px", fontSize: 12, color: "#475569" }}>Documents concernés : {documents.join(", ")}.</p>
        : <p style={{ margin: "0 0 14px", fontSize: 12, color: "#b45309" }}>⚠️ Votre poste ne signe aucun document pour l'instant (Comptes &amp; Postes → Qui signe quoi) : le cachet ne s'imprimera nulle part.</p>}

      <Apercu identite={identite} image={image || actuel} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "14px 0 6px" }}>
        <button type="button" onClick={() => { setErreur(""); setCamera(true); }} disabled={occupe} style={styleBouton}>
          📷 {actuel || image ? "Reprendre une photo" : "Prendre une photo"}
        </button>
        <button type="button" onClick={() => champFichier.current?.click()} disabled={occupe} style={styleBouton}>
          🖼️ Choisir une image
        </button>
        <input ref={champFichier} type="file" accept="image/*" onChange={choisir} style={{ display: "none" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
          <input type="checkbox" checked={nettoyer} onChange={(e) => basculerNettoyage(e.target.checked)} disabled={occupe} />
          Effacer le papier autour du cachet
        </label>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: "#64748b" }}>
        Conseil : tamponnez et signez sur une feuille blanche, puis photographiez-la à plat, bien éclairée, sans ombre et au plus près.
      </p>

      {erreur && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{erreur}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {actuel && !image && <Btn v="ghost" disabled={occupe} onClick={() => enregistrer("")}>Retirer mon cachet</Btn>}
        <Btn v="ghost" disabled={occupe} onClick={fermer}>Annuler</Btn>
        <Btn disabled={occupe || !image} onClick={() => enregistrer(image)}>{occupe ? "Enregistrement…" : "Enregistrer"}</Btn>
      </div>
    </Modale>
  );
}
