// ══════════════════════════════════════════════════════════════
//  Mon cachet et ma signature — menu profil
// ══════════════════════════════════════════════════════════════
// Le comptable ou le chef de section dépose lui-même la photo de son cachet
// (tampon) et, s'il le souhaite, celle de sa signature à part. Elles ne
// s'impriment que sur les documents qu'IL imprime et qu'il signe d'après
// « Qui signe quoi » ; personne d'autre ne peut les poser, les changer ni les
// imprimer (voir src/backend/cachet-supabase.js).
// Une fois la photo prise ou choisie, des réglages (ReglagesCachet) la
// travaillent en direct : papier, lumière, couleur de l'encre, redressement.
// La taille et la position de chaque image dans le bloc de signature se
// règlent aussi, sans nouvelle photo : on fait glisser le cachet ou la
// signature sur l'aperçu, ou on choisit une disposition toute faite.
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Modale } from "../ui";
import { SchoolContext } from "../../contexts/SchoolContext";
import {
  ELEMENTS_CACHET, enregistrerMonCachet, enregistrerPlacementCachet, placementNormalise,
} from "../../backend/cachet-supabase";
import { ajusterCompteMemorise } from "../../backend/auth-supabase";
import {
  DECALAGE_CACHET, TAILLE_CACHET, normaliserDecalageCachet, normaliserTailleCachet, partDessusCachet,
} from "../../reports/signataire-session";
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
// En dessous (plus grand côté, en px), l'image manque de détail une fois
// imprimée sur 2 cm environ.
const COTE_CONSEILLE = 160;

// Les deux images d'un compte, telles que la fenêtre les nomme.
const ELEMENT = {
  cachet: {
    icone: "⭕", nom: "Cachet", le: "le cachet", du: "du cachet", mon: "mon cachet", champ: "cachetUrl",
    taille: "cachetTaille", decalage: "cachetDecalage",
    consigne: "Posez la feuille à plat, bien éclairée, et placez le cachet dans le cadre.",
    conseil: "Tamponnez sur une feuille blanche (signé ou non), puis photographiez-la à plat, bien éclairée, sans ombre et au plus près.",
    enregistre: "Cachet enregistré : il s'imprimera sur les documents que vous signez.", retire: "Cachet retiré.",
  },
  signature: {
    icone: "✍️", nom: "Signature", le: "la signature", du: "de la signature", mon: "ma signature", champ: "signatureUrl",
    taille: "signatureTaille", decalage: "signatureDecalage",
    consigne: "Posez la feuille à plat, bien éclairée, et placez la signature dans le cadre.",
    conseil: "Signez au stylo foncé sur une feuille blanche, puis photographiez-la à plat, bien éclairée, sans ombre et au plus près.",
    enregistre: "Signature enregistrée : elle s'imprimera sur les documents que vous signez.", retire: "Signature retirée.",
  },
};

// Dispositions toutes faites, quand le cachet ET la signature sont déposés :
// position de chacun, en fraction de sa propre hauteur (comme à l'impression).
const DISPOSITIONS = [
  { id: "superposes", libelle: "Superposés", cachet: { x: 0, y: 0 }, signature: { x: 0, y: 0 } },
  { id: "cachet-gauche", libelle: "Cachet à gauche, signature à droite", cachet: { x: -0.6, y: 0 }, signature: { x: 0.6, y: 0 } },
  { id: "signature-gauche", libelle: "Signature à gauche, cachet à droite", cachet: { x: 0.6, y: 0 }, signature: { x: -0.6, y: 0 } },
];

const memePlacement = (a, b) => a.taille === b.taille && a.decalage.x === b.decalage.x && a.decalage.y === b.decalage.y;

// Le bloc de signature tel qu'il s'imprime, mise en page comprise : chaque
// image n'occupe que deux lignes et déborde sur le nom et la mention du
// dessous, d'autant plus qu'elle est grande (même calcul que imagesHTML, à
// l'échelle de l'écran), puis se déplace de la position réglée. Le cadre
// s'agrandit pour garder le débordement visible.
const HAUTEUR_APERCU = 72; // px à la taille d'origine
const ESPACE_APERCU = 2 * 1.2 * 12; // deux lignes de 12 px

// `calques` : [{ id, url, taille, decalage }]. `deplacer(id, decalage)`
// (facultatif) : une image se fait glisser à la souris ou au doigt ; `peutDeplacer(id)`
// dit lesquelles. Pendant le geste, le cadre garde sa hauteur, pour que
// l'image suive exactement le pointeur. `actif` : l'image en cours de réglage,
// soulignée quand il y en a deux.
function Apercu({ identite, calques, actif = "", deplacer = null, peutDeplacer = () => true }) {
  const [geste, setGeste] = useState(null); // { id, px, py, x, y } au début du geste
  const formes = calques.map((c) => {
    const h = HAUTEUR_APERCU * normaliserTailleCachet(c.taille);
    const surplus = ESPACE_APERCU - h; // négatif
    const dessus = surplus * partDessusCachet(c.taille);
    const { x, y } = normaliserDecalageCachet(c.decalage);
    const yCadre = geste?.id === c.id ? geste.y : y;
    return { ...c, h, dessus, dessous: surplus - dessus, x, y, yCadre };
  });
  const marges = formes.length
    ? {
      paddingTop: 14 + Math.max(0, ...formes.map((f) => Math.max(0, -f.dessus - 34) + Math.max(0, -f.yCadre * f.h))),
      paddingBottom: 14 + Math.max(0, ...formes.map((f) => Math.max(0, -f.dessous - 14) + Math.max(0, f.yCadre * f.h))),
    }
    : { paddingTop: 14, paddingBottom: 14 };
  const saisir = (f) => (e) => {
    if (!deplacer || !peutDeplacer(f.id)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setGeste({ id: f.id, px: e.clientX, py: e.clientY, x: f.x, y: f.y });
  };
  const bouger = (f) => (e) => {
    if (geste?.id !== f.id || !deplacer) return;
    deplacer(f.id, normaliserDecalageCachet({ x: geste.x + (e.clientX - geste.px) / f.h, y: geste.y + (e.clientY - geste.py) / f.h }));
  };
  const lacher = () => setGeste(null);
  return (
    <div style={{ background: PAPIER, border: "1px solid #e2e8f0", borderRadius: 10, ...marges, paddingLeft: 16, paddingRight: 16, display: "flex", justifyContent: "center", overflowX: "clip" }}>
      <div style={{ width: 200, textAlign: "center", fontSize: 12, color: "#0f172a", fontFamily: "Georgia, serif" }}>
        {identite?.titre || "Signataire"}
        {identite?.nom && <div style={{ fontWeight: 800, fontSize: 13 }}>{identite.nom}</div>}
        {formes.length
          ? (
            <div style={{ position: "relative", height: ESPACE_APERCU }}>
              {formes.map((f) => {
                const mobile = deplacer && peutDeplacer(f.id);
                const souligne = geste?.id === f.id || (formes.length > 1 && f.id === actif);
                return (
                  <img key={f.id} src={f.url} crossOrigin="anonymous" alt={ELEMENT[f.id]?.nom || "Cachet"} draggable={false}
                    title={mobile ? `Faites glisser ${ELEMENT[f.id]?.le || "le cachet"} pour le placer` : undefined}
                    onPointerDown={saisir(f)} onPointerMove={bouger(f)} onPointerUp={lacher} onPointerCancel={lacher} onLostPointerCapture={lacher}
                    style={{
                      position: "absolute", left: 0, right: 0, top: f.dessus, height: f.h, maxWidth: "100%", objectFit: "contain",
                      margin: "0 auto", mixBlendMode: "multiply",
                      transform: f.x || f.y ? `translate(${f.x * f.h}px, ${f.y * f.h}px)` : undefined,
                      ...(mobile ? { cursor: geste?.id === f.id ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } : {}),
                      outline: souligne ? "1.5px dashed #2563eb" : "none", outlineOffset: 2,
                    }} />
                );
              })}
            </div>
          )
          : <div style={{ height: 72, margin: "6px 0", border: "1.5px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>signature à la main</div>}
        <div style={{ fontSize: 10, color: "#64748b" }}>Signature &amp; Cachet</div>
      </div>
    </div>
  );
}

// Choix de l'image à déposer ou à régler : cachet ou signature.
function ChoixElement({ element, choisir, deposes, verrouille }) {
  return (
    <div role="tablist" aria-label="Image à régler" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
      {ELEMENTS_CACHET.map((id) => {
        const choisi = id === element;
        return (
          <button key={id} type="button" role="tab" aria-selected={choisi} disabled={verrouille && !choisi}
            onClick={() => choisir(id)}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: choisi ? "2px solid #1e3a5f" : "1px solid #cbd5e1", background: choisi ? "#e0ebf8" : "#fff",
              color: "#1e3a5f", opacity: verrouille && !choisi ? 0.5 : 1,
            }}>
            {ELEMENT[id].icone} {ELEMENT[id].nom}
            <span style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 600, color: deposes[id] ? "#16a34a" : "#94a3b8" }}>
              {deposes[id] ? "✓ déposé" : "à ajouter"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Dispositions toutes faites du cachet et de la signature l'un par rapport à
// l'autre ; le glisser et les curseurs affinent ensuite.
function Disposition({ placements, appliquer, desactive }) {
  const courante = DISPOSITIONS.find((d) => ELEMENTS_CACHET.every((id) =>
    placements[id].decalage.x === d[id].x && placements[id].decalage.y === d[id].y))?.id;
  return (
    <div style={{ marginTop: 10 }}>
      <strong style={{ fontSize: 12, color: "#334155" }}>🧩 Disposition</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {DISPOSITIONS.map((d) => (
          <button key={d.id} type="button" disabled={desactive} onClick={() => appliquer(d)}
            style={{
              ...styleBouton, padding: "5px 10px", fontSize: 11,
              background: courante === d.id ? "#1e3a5f" : "#e0ebf8", color: courante === d.id ? "#fff" : "#1e3a5f",
            }}>
            {d.libelle}
          </button>
        ))}
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        Puis faites glisser le cachet ou la signature sur l'aperçu pour les placer exactement où vous voulez.
      </p>
    </div>
  );
}

function TailleCachet({ nom, taille, changer, desactive }) {
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
        <strong style={{ whiteSpace: "nowrap" }}>📏 Taille à l'impression</strong>
        <input type="range" min={TAILLE_CACHET.min} max={TAILLE_CACHET.max} step={TAILLE_CACHET.pas} value={taille}
          disabled={desactive} onChange={(e) => changer(normaliserTailleCachet(e.target.value))}
          aria-label={`Taille ${nom} à l'impression`} style={{ flex: 1, minWidth: 0 }} />
        <span style={{ fontSize: 11, color: "#64748b", minWidth: 42, textAlign: "end" }}>{Math.round(taille * 100)} %</span>
      </label>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        Vaut pour tous les documents que vous signez. Plus grande, l'image chevauche votre nom comme un vrai tampon ; la page ne s'allonge pas.
      </p>
    </div>
  );
}

// Position dans le bloc de signature : curseurs (clavier compris) en plus du
// glisser sur l'aperçu, et retour au centre en un clic.
const sens = (v, moins, plus) => (v ? (v < 0 ? `${moins} ${Math.round(-v * 100)} %` : `${Math.round(v * 100)} % ${plus}`) : "centré");

function PositionCachet({ nom, decalage, changer, desactive }) {
  const { x, y } = decalage;
  const centre = !x && !y;
  const curseur = (axe, symbole, libelle, valeur, affiche) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", marginTop: 6 }}>
      <span aria-hidden="true" style={{ width: 16, textAlign: "center" }}>{symbole}</span>
      <input type="range" min={-DECALAGE_CACHET[axe]} max={DECALAGE_CACHET[axe]} step={0.01} value={valeur}
        disabled={desactive} onChange={(e) => changer(normaliserDecalageCachet({ ...decalage, [axe]: e.target.value }))}
        aria-label={libelle} style={{ flex: 1, minWidth: 0 }} />
      <span style={{ fontSize: 11, color: "#64748b", minWidth: 58, textAlign: "end" }}>{affiche}</span>
    </label>
  );
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
        <strong>🎯 Position dans le bloc</strong>
        <button type="button" onClick={() => changer({ x: 0, y: 0 })} disabled={desactive || centre}
          style={{ ...styleBouton, padding: "4px 10px", fontSize: 11, marginInlineStart: "auto", opacity: desactive || centre ? 0.5 : 1 }}>
          ⊕ Centrer
        </button>
      </div>
      {curseur("x", "↔", `Position ${nom} : gauche ou droite`, x, sens(x, "←", "→"))}
      {curseur("y", "↕", `Position ${nom} : haut ou bas`, y, sens(y, "↑", "↓"))}
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        Faites glisser l'image sur l'aperçu, ou réglez-la ici. Vaut pour tous les documents que vous signez ; la page ne bouge pas.
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
        ? <img src={image} alt="Image seule" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : <span style={{ fontSize: 11, color: "#94a3b8" }}>Aucun tracé</span>}
    </div>
  );
}

// Taille et position enregistrées de chaque image du compte.
const placementsDuCompte = (u) => Object.fromEntries(ELEMENTS_CACHET.map((id) =>
  [id, placementNormalise({ taille: u[ELEMENT[id].taille], decalage: u[ELEMENT[id].decalage] })]));

// Champs de la session (et du compte mémorisé) pour ces placements.
const champsPlacements = (placements) => Object.fromEntries(Object.entries(placements).flatMap(([id, p]) =>
  [[ELEMENT[id].taille, p.taille], [ELEMENT[id].decalage, p.decalage]]));

export default function MonCachetModale({ utilisateur, setUtilisateur, fermer }) {
  const { schoolInfo, toast } = useContext(SchoolContext);
  const cle = utilisateur.posteCle || utilisateur.role;
  const urls = { cachet: utilisateur.cachetUrl || "", signature: utilisateur.signatureUrl || "" };
  const [element, setElement] = useState("cachet"); // image à déposer ou à régler
  const [source, setSource] = useState(null); // photo décodée, avant réglages
  const [reglages, setReglages] = useState(REGLAGES_CACHET);
  const [rendu, setRendu] = useState(null); // { url, largeur, hauteur }
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [camera, setCamera] = useState(false);
  const placementsActuels = placementsDuCompte(utilisateur);
  const [placements, setPlacements] = useState(() => placementsDuCompte(utilisateur));
  const champFichier = useRef(null);
  const image = rendu?.url || "";
  const el = ELEMENT[element];
  const actuel = urls[element];

  // Image de chaque élément dans l'aperçu : la nouvelle photo en cours de
  // réglage, sinon celle déjà déposée.
  const imageDe = (id) => (id === element && source ? image : urls[id]);
  const calques = ELEMENTS_CACHET.filter((id) => imageDe(id)).map((id) => ({ id, url: imageDe(id), ...placements[id] }));
  // Images déjà déposées, seules leur taille ou leur position changent : pas
  // besoin de nouvelle photo.
  const placementSeul = !source && ELEMENTS_CACHET.some((id) => urls[id] && !memePlacement(placements[id], placementsActuels[id]));

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

  const abandonnerPhoto = () => { setSource(null); setRendu(null); setErreur(""); };

  const changer = (champs) => setReglages((r) => ({ ...r, ...champs }));
  const placer = (id, champs) => setPlacements((p) => ({ ...p, [id]: { ...p[id], ...champs } }));
  const appliquerDisposition = (d) => setPlacements((p) => Object.fromEntries(ELEMENTS_CACHET.map((id) =>
    [id, { ...p[id], decalage: normaliserDecalageCachet(d[id]) }])));

  // Glisser une image sur l'aperçu la choisit aussi pour les réglages — sauf
  // pendant le réglage d'une nouvelle photo, seule déplaçable alors.
  const deplacer = (id, decalage) => {
    if (!source && id !== element) setElement(id);
    placer(id, { decalage });
  };

  // Session et compte mémorisé : les images servent dès maintenant, hors ligne
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
      compteId: utilisateur.compteDocId, schoolId: utilisateur.schoolId, element, image: nouvelle, ancienne: actuel, placements,
    });
    const enregistres = { ...placements, [element]: placementNormalise(url ? placements[element] : null) };
    memoriser({ [el.champ]: url, ...champsPlacements(enregistres) });
    toast?.(url ? el.enregistre : el.retire);
  });

  const enregistrerPlacement = () => executer(async () => {
    const deposes = Object.fromEntries(ELEMENTS_CACHET.filter((id) => urls[id]).map((id) => [id, placements[id]]));
    const enregistres = await enregistrerPlacementCachet({ compteId: utilisateur.compteDocId, placements: deposes });
    memoriser(champsPlacements(enregistres));
    toast?.("Taille et position enregistrées : elles valent pour tous les documents que vous signez.");
  });

  if (camera) {
    return (
      <Modale titre={`📷 Photographier ${el.mon}`} fermer={fermer}>
        <CameraCachet consigne={el.consigne} nomFichier={element} onPhoto={photoPrise} onAnnuler={() => setCamera(false)}
          onChoisirFichier={() => setTimeout(() => champFichier.current?.click(), 0)} />
      </Modale>
    );
  }

  const petite = rendu && Math.max(rendu.largeur, rendu.hauteur) < COTE_CONSEILLE;
  const deuxImages = calques.length > 1;
  const reglagesPlacement = (actuel || source) && (
    <>
      <TailleCachet nom={el.du} taille={placements[element].taille}
        changer={(taille) => placer(element, { taille })} desactive={occupe} />
      <PositionCachet nom={el.du} decalage={placements[element].decalage}
        changer={(decalage) => placer(element, { decalage })} desactive={occupe} />
    </>
  );
  const apercu = (
    <>
      <Apercu identite={identite} calques={calques} actif={element}
        deplacer={occupe ? null : deplacer} peutDeplacer={(id) => !source || id === element} />
      {deuxImages && <Disposition placements={placements} appliquer={appliquerDisposition} desactive={occupe} />}
    </>
  );

  return (
    <Modale titre="🖋️ Mon cachet et ma signature" fermer={fermer} large={!!source}>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
        Déposez une photo de votre cachet et, si vous le souhaitez, de votre signature à part : vous les placerez ensuite l'un par rapport à l'autre.
        Ils s'imprimeront à votre place de signataire, <strong>seulement sur les documents que vous imprimez vous-même</strong>.
        Vous seul pouvez les déposer, les changer ou les retirer.
      </p>
      {documents.length
        ? <p style={{ margin: "0 0 14px", fontSize: 12, color: "#475569" }}>Documents concernés : {documents.join(", ")}.</p>
        : <p style={{ margin: "0 0 14px", fontSize: 12, color: "#b45309" }}>⚠️ Votre poste ne signe aucun document pour l'instant (Comptes &amp; Postes → Qui signe quoi) : le cachet ne s'imprimera nulle part.</p>}

      <ChoixElement element={element} choisir={(id) => { setErreur(""); setElement(id); }} deposes={urls} verrouille={!!source || occupe} />
      {source && (
        <p style={{ margin: "-4px 0 10px", fontSize: 11, color: "#64748b" }}>
          Nouvelle image {el.du} en cours : enregistrez-la, ou{" "}
          <button type="button" onClick={abandonnerPhoto} disabled={occupe}
            style={{ background: "none", border: "none", padding: 0, color: "#1d4ed8", textDecoration: "underline", cursor: "pointer", fontSize: 11 }}>
            abandonnez-la
          </button>{" "}pour régler l'autre image.
        </p>
      )}

      {source ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <p style={styleLegende}>Sur le document</p>
            {apercu}
            {reglagesPlacement}
            <p style={{ ...styleLegende, marginTop: 12 }}>{reglages.nettoyer ? "Image détourée" : "Image"}</p>
            <ImageSeule image={image} transparente={reglages.nettoyer} />
            {rendu && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>Image : {rendu.largeur} × {rendu.hauteur} px</p>}
            {petite && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "8px 10px", borderRadius: 8 }}>
                💡 L'image est petite sur la photo : elle manquera de netteté une fois imprimée. Reprenez-la de plus près.
              </p>
            )}
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <ReglagesCachet reglages={reglages} changer={changer} desactive={occupe} />
          </div>
        </div>
      ) : (
        <>
          {apercu}
          {reglagesPlacement}
        </>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "14px 0 6px" }}>
        <button type="button" onClick={() => { setErreur(""); setCamera(true); }} disabled={occupe} style={styleBouton}>
          📷 {actuel || source ? `Reprendre ${el.le} en photo` : `Photographier ${el.mon}`}
        </button>
        <button type="button" onClick={() => champFichier.current?.click()} disabled={occupe} style={styleBouton}>
          🖼️ {source ? "Choisir une autre image" : "Choisir une image"}
        </button>
        <input ref={champFichier} type="file" accept="image/*" onChange={choisir} style={{ display: "none" }} />
      </div>
      {!source && (
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "#64748b" }}>
          Conseil : {el.conseil} Vous pourrez ensuite régler la lumière, la couleur de l'encre et redresser l'image.
        </p>
      )}

      {erreur && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{erreur}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {actuel && !source && <Btn v="ghost" disabled={occupe} onClick={() => enregistrer("")}>Retirer {el.mon}</Btn>}
        <Btn v="ghost" disabled={occupe} onClick={fermer}>Annuler</Btn>
        <Btn disabled={occupe || !(image || placementSeul)} onClick={() => (image ? enregistrer(image) : enregistrerPlacement())}>
          {occupe ? "Enregistrement…" : "Enregistrer"}
        </Btn>
      </div>
    </Modale>
  );
}
