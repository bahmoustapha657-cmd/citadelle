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
import { enregistrerMonCachet, enregistrerTailleCachet } from "../../backend/cachet-supabase";
import { ajusterCompteMemorise } from "../../backend/auth-supabase";
import { TAILLE_CACHET, normaliserTailleCachet, partDessusCachet } from "../../reports/signataire-session";
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

// Le bloc de signature tel qu'il s'imprime, mise en page comprise : le cachet
// n'occupe que deux lignes et déborde sur le nom et la mention du dessous,
// d'autant plus qu'il est grand (même calcul que cachetHTML, à l'échelle de
// l'écran). Le cadre s'agrandit pour garder le débordement visible.
const HAUTEUR_APERCU = 72; // px à la taille d'origine
const ESPACE_APERCU = 2 * 1.2 * 12; // deux lignes de 12 px

function Apercu({ identite, image, taille = 1 }) {
  const h = HAUTEUR_APERCU * normaliserTailleCachet(taille);
  const surplus = ESPACE_APERCU - h; // négatif
  const dessus = surplus * partDessusCachet(taille);
  const dessous = surplus - dessus;
  const marges = image
    ? { paddingTop: 14 + Math.max(0, -dessus - 34), paddingBottom: 14 + Math.max(0, -dessous - 14) }
    : { paddingTop: 14, paddingBottom: 14 };
  return (
    <div style={{ background: PAPIER, border: "1px solid #e2e8f0", borderRadius: 10, ...marges, paddingLeft: 16, paddingRight: 16, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: 200, textAlign: "center", fontSize: 12, color: "#0f172a", fontFamily: "Georgia, serif" }}>
        {identite?.titre || "Signataire"}
        {identite?.nom && <div style={{ fontWeight: 800, fontSize: 13 }}>{identite.nom}</div>}
        {image
          ? <img src={image} crossOrigin="anonymous" alt="Cachet" style={{ display: "block", height: h, maxWidth: "100%", objectFit: "contain", margin: `${dessus}px auto ${dessous}px`, mixBlendMode: "multiply" }} />
          : <div style={{ height: 72, margin: "6px 0", border: "1.5px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>signature à la main</div>}
        <div style={{ fontSize: 10, color: "#64748b" }}>Signature &amp; Cachet</div>
      </div>
    </div>
  );
}

function TailleCachet({ taille, changer, desactive }) {
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
        <strong style={{ whiteSpace: "nowrap" }}>📏 Taille à l'impression</strong>
        <input type="range" min={TAILLE_CACHET.min} max={TAILLE_CACHET.max} step={TAILLE_CACHET.pas} value={taille}
          disabled={desactive} onChange={(e) => changer(normaliserTailleCachet(e.target.value))}
          aria-label="Taille du cachet à l'impression" style={{ flex: 1, minWidth: 0 }} />
        <span style={{ fontSize: 11, color: "#64748b", minWidth: 42, textAlign: "end" }}>{Math.round(taille * 100)} %</span>
      </label>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        Vaut pour tous les documents que vous signez. Plus grand, le cachet chevauche votre nom comme un vrai tampon ; la page ne s'allonge pas.
      </p>
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
  const tailleActuelle = normaliserTailleCachet(utilisateur.cachetTaille);
  const [taille, setTaille] = useState(tailleActuelle);
  const champFichier = useRef(null);
  const image = rendu?.url || "";
  // Cachet déjà déposé, seule sa taille change : pas besoin de nouvelle photo.
  const tailleSeule = !source && !!actuel && taille !== tailleActuelle;

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

  // Session et compte mémorisé : le cachet sert dès maintenant, hors ligne
  // compris au prochain lancement.
  const memoriser = (champs) => {
    setUtilisateur((u) => ({ ...u, ...champs }));
    ajusterCompteMemorise(utilisateur.uid, champs);
  };

  const executer = async (action) => {
    if (!navigator.onLine) { setErreur("Connexion internet requise pour enregistrer votre cachet."); return; }
    setOccupe(true); setErreur("");
    try {
      await action();
      fermer();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  };

  const enregistrer = (nouvelle) => executer(async () => {
    const url = await enregistrerMonCachet({
      compteId: utilisateur.compteDocId, schoolId: utilisateur.schoolId, image: nouvelle, ancienne: actuel, taille,
    });
    memoriser({ cachetUrl: url, cachetTaille: url ? taille : 1 });
    toast?.(url ? "Cachet enregistré : il s'imprimera sur les documents que vous signez." : "Cachet retiré.");
  });

  const enregistrerTaille = () => executer(async () => {
    const t = await enregistrerTailleCachet({ compteId: utilisateur.compteDocId, taille });
    memoriser({ cachetTaille: t });
    toast?.(`Taille du cachet enregistrée (${Math.round(t * 100)} %) : elle vaut pour tous les documents que vous signez.`);
  });

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
            <Apercu identite={identite} image={image} taille={taille} />
            <TailleCachet taille={taille} changer={setTaille} desactive={occupe} />
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
        <>
          <Apercu identite={identite} image={actuel} taille={taille} />
          {actuel && <TailleCachet taille={taille} changer={setTaille} desactive={occupe} />}
        </>
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
        <Btn disabled={occupe || !(image || tailleSeule)} onClick={() => (image ? enregistrer(image) : enregistrerTaille())}>
          {occupe ? "Enregistrement…" : "Enregistrer"}
        </Btn>
      </div>
    </Modale>
  );
}
