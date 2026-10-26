import { useMemo, useRef, useState } from "react";
import {
  champsSeancePhoto, comparerClasses, couleurClasse, fileSeancePhoto, nettoyerSurnom, nomAppel, nomOfficiel, SURNOM_MAX,
} from "../../identite-enfant";
import { uploadPhotoEleve } from "../../storageUtils";
import { CameraCapture } from "../CameraCapture";
import { RetouchePhoto } from "../RetouchePhoto";
import { lireImageNormalisee } from "../camera-capture/photo-capture";
import { finaliserRetouche } from "../camera-capture/retouche";
import { Btn, Modale } from "../ui";
import { FondClasseModale } from "./FondClasseModale";
import { PhotoEleve } from "./PhotoEleve";

// Séance photo de classe : les enfants défilent l'un après l'autre — photo
// (caméra ou galerie) et surnom, « Enregistrer et suivant », sans rouvrir
// chaque fiche. Par défaut, seulement ceux qui n'ont pas encore de photo.
// La photo part comme à l'inscription (uploadPhotoEleve) : sans réseau, la
// fiche est enregistrée tout de suite et la photo suit au retour du réseau.
// Une photo déjà prise se retouche (« ✏️ Modifier », RetouchePhoto) ; le fond
// de toute la classe se change d'un coup (FondClasseModale).
// `enregistrer(id, champs)` = modifierChamp de la collection des élèves.
export function SeancePhotoModale({
  eleves = [], classeInitiale = null, eleveInitial = null,
  schoolId, enregistrer, toast, logAction, fermer,
}) {
  const classes = useMemo(
    () => [...new Set(eleves.map((e) => e.classe).filter(Boolean))].sort(comparerClasses),
    [eleves],
  );
  const parId = useMemo(() => new Map(eleves.map((e) => [e._id, e])), [eleves]);
  const [classe, setClasse] = useState(classeInitiale || classes[0] || null);
  const [seulementSansPhoto, setSeulementSansPhoto] = useState(true);
  const [file, setFile] = useState(() => fileSeancePhoto(eleves, {
    classe: classeInitiale || classes[0] || null, seulementSansPhoto: true, inclure: eleveInitial,
  }));
  const [index, setIndex] = useState(() => Math.max(0, file.indexOf(eleveInitial)));
  const [brouillon, setBrouillon] = useState({ id: null, surnom: "", photo: "", photoRetouche: null });
  const [camera, setCamera] = useState(false);
  const [retouche, setRetouche] = useState(false);
  const [fondClasse, setFondClasse] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState({ photos: 0, surnoms: 0 });
  // Double toucher sur « Enregistrer » : le second partirait avant que le
  // bouton ne soit désactivé (même précaution qu'à l'inscription).
  const verrou = useRef(false);

  const courant = index < file.length ? parId.get(file[index]) : null;
  // Brouillon de l'enfant affiché ; un autre enfant repart de sa fiche.
  const valeurs = courant && brouillon.id === courant._id
    ? brouillon : { id: courant?._id || null, surnom: courant?.surnom || "", photo: "", photoRetouche: null };
  const changer = (champs) => setBrouillon({ ...valeurs, ...champs });
  const modifie = !!courant && (!!valeurs.photo || nettoyerSurnom(valeurs.surnom) !== nettoyerSurnom(courant.surnom));
  const couleur = couleurClasse(courant?.classe || classe, "#0A1628");

  const abandonnerBrouillon = () => !valeurs.photo
    || confirm(`La photo de ${nomOfficiel(courant)} n'est pas enregistrée. Continuer sans l'enregistrer ?`);

  const aller = (i) => { if (abandonnerBrouillon()) setIndex(Math.max(0, i)); };

  const refaireFile = (champs) => {
    if (!abandonnerBrouillon()) return;
    const prochain = { classe, seulementSansPhoto, ...champs };
    setClasse(prochain.classe);
    setSeulementSansPhoto(prochain.seulementSansPhoto);
    setFile(fileSeancePhoto(eleves, prochain));
    setIndex(0);
  };

  const importer = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      changer({ photo: await lireImageNormalisee(fichier), photoRetouche: null });
    } catch {
      toast?.("Image illisible : choisissez une photo JPEG ou PNG.", "warning");
    }
  };

  const enregistrerEtSuivant = async () => {
    if (!courant || verrou.current) return;
    if (!modifie) { setIndex(index + 1); return; }
    verrou.current = true;
    setEnCours(true);
    try {
      const photo = valeurs.photo ? await uploadPhotoEleve(valeurs.photo, schoolId) : "";
      const champs = champsSeancePhoto(courant, {
        surnom: valeurs.surnom, photo,
        photoRetouche: valeurs.photo ? finaliserRetouche(valeurs.photoRetouche, valeurs.photo, photo) : undefined,
      });
      if (Object.keys(champs).length) {
        await enregistrer(courant._id, champs);
        setBilan((b) => ({ photos: b.photos + (champs.photo ? 1 : 0), surnoms: b.surnoms + ("surnom" in champs ? 1 : 0) }));
      }
      setBrouillon({ id: null, surnom: "", photo: "", photoRetouche: null });
      setIndex(index + 1);
    } catch (err) {
      toast?.("Erreur à l'enregistrement : " + err.message, "error");
    } finally {
      setEnCours(false);
      verrou.current = false;
    }
  };

  const quitter = () => {
    if (enCours || !abandonnerBrouillon()) return;
    if (bilan.photos || bilan.surnoms) {
      logAction?.("Séance photo", `${classe || "Toutes les classes"} : ${bilan.photos} photo(s), ${bilan.surnoms} surnom(s)`);
    }
    fermer();
  };

  const resume = `${bilan.photos} photo${bilan.photos > 1 ? "s" : ""} et ${bilan.surnoms} surnom${bilan.surnoms > 1 ? "s" : ""} enregistré${bilan.photos + bilan.surnoms > 1 ? "s" : ""}`;

  return (
    <Modale large titre="📸 Séance photo de classe" fermer={quitter}>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1e3a8a", marginBottom: 12 }}>
        Idéal à l'arrivée ou à la sortie, avec les parents : ils confirment que c'est bien leur enfant et donnent
        le <strong>surnom</strong> auquel il répond à la maison.
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <select value={classe || ""} onChange={(e) => refaireFile({ classe: e.target.value || null })} disabled={enCours}
          style={{ border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "var(--lc-input-bg)", color: "var(--lc-text)" }}>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--lc-text)", cursor: "pointer" }}>
          <input type="checkbox" checked={seulementSansPhoto} disabled={enCours}
            onChange={(e) => refaireFile({ seulementSansPhoto: e.target.checked })}/>
          Seulement les enfants sans photo
        </label>
        <Btn sm v="ghost" onClick={() => { if (abandonnerBrouillon()) setFondClasse(true); }} disabled={enCours}
          title="La même couleur de fond derrière tous les enfants de la classe">🎨 Fond de la classe</Btn>
        <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 800, color: "var(--lc-text-muted)" }}>
          {file.length ? `${Math.min(index + 1, file.length)} / ${file.length}` : "0 / 0"}
        </span>
      </div>

      {!file.length && (
        <div style={{ textAlign: "center", padding: "26px 10px", fontSize: 14, color: "#166534" }}>
          ✅ Tous les enfants de {classe || "cette classe"} ont déjà leur photo.
          <div style={{ fontSize: 12, color: "var(--lc-text-muted)", marginTop: 6 }}>Décochez « Seulement les enfants sans photo » pour en reprendre une ou ajouter un surnom.</div>
        </div>
      )}

      {file.length > 0 && !courant && (
        <div style={{ textAlign: "center", padding: "26px 10px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>🎉 Séance terminée pour {classe}</div>
          <div style={{ fontSize: 13, color: "var(--lc-text)", marginTop: 6 }}>{resume}.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            <Btn v="ghost" onClick={() => setIndex(0)}>↺ Revoir la liste</Btn>
            <Btn onClick={quitter}>Fermer</Btn>
          </div>
        </div>
      )}

      {courant && (
        <>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {valeurs.photo
                ? <img crossOrigin="anonymous" src={valeurs.photo} alt="Nouvelle photo"
                    style={{ width: 150, height: 188, objectFit: "cover", borderRadius: 14, border: `3px solid ${couleur}` }}/>
                : <PhotoEleve eleve={courant} largeur={150}/>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                <Btn sm v="blue" onClick={() => setCamera(true)} disabled={enCours}>📸 {valeurs.photo || courant.photo ? "Reprendre" : "Prendre la photo"}</Btn>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, border: "1.5px solid var(--lc-border)", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--sc1)", background: "var(--lc-surface)" }}>
                  📁 Galerie
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={importer} disabled={enCours}/>
                </label>
                {(valeurs.photo || courant.photo) && (
                  <Btn sm v="ghost" onClick={() => setRetouche(true)} disabled={enCours}
                    title="Fond, cadrage, lumière — sans reprendre la photo">✏️ Modifier</Btn>
                )}
              </div>
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: couleur, lineHeight: 1.1 }}>{nomOfficiel(courant)}</div>
              <div><span style={{ background: couleur, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>{courant.classe}</span></div>
              {courant.filiation && <div style={{ fontSize: 13, color: "var(--lc-text)" }}><strong>Filiation :</strong> {courant.filiation}</div>}
              {courant.tuteur && <div style={{ fontSize: 13, color: "var(--lc-text)" }}><strong>Tuteur :</strong> {courant.tuteur}</div>}
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--lc-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>
                Surnom — comment on l'appelle à la maison
              </label>
              <input value={valeurs.surnom} maxLength={SURNOM_MAX} placeholder="Ex. : Néné, Bobo, Baby…"
                onChange={(e) => changer({ surnom: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") enregistrerEtSuivant(); }}
                style={{ width: "100%", border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "9px 11px", fontSize: 15, boxSizing: "border-box", background: "var(--lc-input-bg)", color: "var(--lc-text)" }}/>
              <div style={{ fontSize: 11, color: "var(--lc-text-muted)" }}>
                Écrit en gros sur le trombinoscope et le badge : <strong>{nomAppel({ ...courant, surnom: valeurs.surnom })}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--lc-text-muted)" }}>{bilan.photos + bilan.surnoms > 0 ? resume : ""}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="ghost" onClick={() => aller(index - 1)} disabled={enCours || index === 0}>◀ Précédent</Btn>
              <Btn v="ghost" onClick={() => aller(index + 1)} disabled={enCours}>Passer ▶</Btn>
              <Btn onClick={enregistrerEtSuivant} disabled={enCours}>
                {enCours ? "⏳ Enregistrement…" : modifie ? "✅ Enregistrer et suivant" : "Suivant ▶"}
              </Btn>
            </div>
          </div>
        </>
      )}

      {camera && <CameraCapture onCapture={(photo) => changer({ photo, photoRetouche: null })} onClose={() => setCamera(false)}/>}
      {/* Retouche sans effet : la photo de la fiche reste, pas de brouillon. */}
      {retouche && courant && <RetouchePhoto
        photo={valeurs.photo || courant.photo}
        retouche={valeurs.photo ? valeurs.photoRetouche : courant.photoRetouche}
        onValider={(photo, memoire) => changer(photo === courant.photo
          ? { photo: "", photoRetouche: null } : { photo, photoRetouche: memoire })}
        onClose={() => setRetouche(false)}/>}
      {fondClasse && <FondClasseModale
        eleves={eleves} classeInitiale={classe} schoolId={schoolId} enregistrer={enregistrer}
        toast={toast} logAction={logAction} fermer={() => setFondClasse(false)}/>}
    </Modale>
  );
}
