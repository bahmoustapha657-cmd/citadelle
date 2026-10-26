import { useContext, useMemo, useRef, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { aUnePhoto, comparerClasses, nomOfficiel } from "../../identite-enfant";
import { uploadPhotoEleve } from "../../storageUtils";
import { ChoixFond } from "../camera-capture/ChoixFond";
import { FOND_ORIGINAL, FONDS_PRETS, enregistrerFond, lireFond, normaliserCouleur } from "../camera-capture/fond-photo";
import { retoucherPhoto } from "../camera-capture/rendu-retouche";
import { finaliserRetouche, retoucheFond } from "../camera-capture/retouche";
import { Btn, Modale } from "../ui";
import { PhotoEleve } from "./PhotoEleve";

const stockage = () => {
  try { return window.localStorage; } catch { return null; }
};

const nomDuFond = (fond) => (fond === FOND_ORIGINAL
  ? "d'origine"
  : (FONDS_PRETS.find((f) => f.valeur === fond)?.nom || fond).toLowerCase());

const vignette = { width: 120, height: 160, objectFit: "cover", borderRadius: 12, border: "2px solid var(--lc-border)", background: "#0f172a" };

// Fond de toute une classe : la même couleur derrière chaque enfant qui a
// une photo, sans les reprendre. D'abord un essai sur un enfant (rien n'est
// enregistré), puis, sur accord, toute la classe — photo après photo, avec
// la progression et un bouton pour arrêter. Chaque photo garde la mémoire de
// sa retouche (retouche.js) : une autre couleur plus tard repart de la photo
// d'origine, sans la dégrader.
// `enregistrer(id, champs)` = modifierChamp de la collection des élèves.
export function FondClasseModale({ eleves = [], classeInitiale = null, schoolId, enregistrer, toast, logAction, fermer }) {
  const { schoolInfo } = useContext(SchoolContext);
  const classes = useMemo(
    () => [...new Set(eleves.filter(aUnePhoto).map((e) => e.classe).filter(Boolean))].sort(comparerClasses),
    [eleves],
  );
  const [classe, setClasse] = useState(classes.includes(classeInitiale) ? classeInitiale : classes[0] || null);
  const [fond, setFond] = useState(() => {
    const memorise = lireFond(stockage());
    return memorise === FOND_ORIGINAL ? FONDS_PRETS[0].valeur : memorise;
  });
  // Essai : { classe, fond, index, enCours, eleveId, apres, erreur }.
  const [essai, setEssai] = useState(null);
  const [phase, setPhase] = useState("choix");
  const [progression, setProgression] = useState({ fait: 0, total: 0, nom: "" });
  const [bilan, setBilan] = useState(null);
  const arret = useRef(false);

  const enfants = useMemo(
    () => eleves.filter((e) => e.classe === classe && aUnePhoto(e))
      .sort((a, b) => nomOfficiel(a).localeCompare(nomOfficiel(b), "fr", { sensitivity: "base" })),
    [eleves, classe],
  );
  const plan = useMemo(
    () => enfants.map((eleve) => ({ eleve, travail: retoucheFond(eleve.photo, eleve.photoRetouche, fond) }))
      .filter((p) => p.travail),
    [enfants, fond],
  );
  const sansPhoto = eleves.filter((e) => e.classe === classe && !aUnePhoto(e)).length;
  // Un essai ne vaut que pour la classe et le fond affichés.
  const essaiCourant = essai && essai.classe === classe && essai.fond === fond ? essai : null;
  const exemple = essaiCourant ? plan.find((p) => p.eleve._id === essaiCourant.eleveId)?.eleve : null;

  const choisirFond = (valeur) => {
    const choix = normaliserCouleur(valeur) || FOND_ORIGINAL;
    setFond(choix);
    enregistrerFond(stockage(), choix);
  };

  const essayer = async (index) => {
    if (!plan.length) return;
    const { eleve, travail } = plan[index % plan.length];
    const base = { classe, fond, index, eleveId: eleve._id };
    setEssai({ ...base, enCours: true });
    try {
      const { photo } = await retoucherPhoto(travail.source, travail.reglages);
      setEssai((e) => (e?.eleveId === eleve._id && e.fond === fond ? { ...base, apres: photo } : e));
    } catch (err) {
      setEssai((e) => (e?.eleveId === eleve._id && e.fond === fond ? { ...base, erreur: err.message } : e));
    }
  };

  const appliquer = async () => {
    const liste = plan;
    arret.current = false;
    setPhase("application");
    let modifiees = 0;
    const echecs = [];
    for (let i = 0; i < liste.length && !arret.current; i++) {
      const { eleve, travail } = liste[i];
      setProgression({ fait: i, total: liste.length, nom: nomOfficiel(eleve) });
      try {
        const { photo, retouche } = await retoucherPhoto(travail.source, travail.reglages);
        // Sans réseau, la photo part dès son retour (photos-hors-ligne).
        const url = await uploadPhotoEleve(photo, schoolId);
        await enregistrer(eleve._id, { photo: url, photoRetouche: finaliserRetouche(retouche, photo, url) });
        modifiees += 1;
      } catch {
        echecs.push(nomOfficiel(eleve));
      }
    }
    setBilan({ modifiees, echecs, arrete: arret.current, total: liste.length });
    setPhase("fini");
    if (modifiees) logAction?.("Fond des photos", `${classe} : ${modifiees} photo(s), fond ${nomDuFond(fond)}`);
    if (echecs.length) toast?.(`${echecs.length} photo(s) non modifiée(s) : photo inaccessible sur cet appareil.`, "warning");
  };

  const quitter = () => {
    if (phase === "application") {
      if (confirm("Arrêter après la photo en cours ? Les photos déjà faites restent enregistrées.")) arret.current = true;
      return;
    }
    fermer();
  };

  return (
    <Modale titre="🎨 Fond des photos de la classe" fermer={quitter}>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1e3a8a", marginBottom: 12 }}>
        La même couleur derrière chaque enfant, sans reprendre les photos. Essayez d'abord sur un enfant :
        rien n'est enregistré avant « Appliquer ».
      </div>

      {!classes.length && <div style={{ textAlign: "center", padding: 20, fontSize: 13, color: "var(--lc-text-muted)" }}>Aucune photo d'élève dans cette liste.</div>}

      {classes.length > 0 && phase === "choix" && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={classe || ""} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"
              style={{ border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "var(--lc-input-bg)", color: "var(--lc-text)" }}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "var(--lc-text)" }}>
              <strong>{plan.length}</strong> photo{plan.length > 1 ? "s" : ""} à changer
              {enfants.length > plan.length && ` · ${enfants.length - plan.length} déjà avec ce fond`}
              {sansPhoto > 0 && ` · ${sansPhoto} enfant${sansPhoto > 1 ? "s" : ""} sans photo`}
            </span>
          </div>

          <ChoixFond fond={fond} choisirFond={choisirFond} couleurEcole={schoolInfo?.couleur1}/>
          {fond === FOND_ORIGINAL && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              « Fond d'origine » rend leur décor aux photos dont le fond a été changé ici ou par « Modifier la photo ».
            </p>
          )}

          {plan.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, border: "1px solid var(--lc-border)", borderRadius: 12 }}>
              {essaiCourant && exemple ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--lc-text-muted)" }}>
                    <PhotoEleve eleve={exemple} largeur={120}/>
                    <div>Avant</div>
                  </div>
                  <span style={{ fontSize: 20 }}>→</span>
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--lc-text-muted)" }}>
                    {essaiCourant.apres
                      ? <img src={essaiCourant.apres} alt="Après" style={vignette}/>
                      : <div style={{ ...vignette, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, padding: 8, boxSizing: "border-box" }}>
                          {essaiCourant.erreur ? "⚠️ Photo inaccessible" : "⏳ Changement du fond…"}
                        </div>}
                    <div>Après</div>
                  </div>
                  <div style={{ flexBasis: "100%", textAlign: "center", fontSize: 13, fontWeight: 800, color: "var(--lc-text)" }}>{nomOfficiel(exemple)}</div>
                </div>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--lc-text-muted)" }}>Voyez le résultat sur un enfant avant d'appliquer à toute la classe.</div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                {essaiCourant
                  ? <Btn sm v="ghost" disabled={essaiCourant.enCours} onClick={() => essayer(essaiCourant.index + 1)}>Autre enfant ▶</Btn>
                  : <Btn sm v="blue" onClick={() => essayer(0)}>🔍 Essayer sur un enfant</Btn>}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
            <Btn v="ghost" onClick={fermer}>Annuler</Btn>
            <Btn onClick={appliquer} disabled={!plan.length || !essaiCourant?.apres}
              title={essaiCourant?.apres ? "" : "Essayez d'abord sur un enfant"}>
              ✅ Appliquer à {plan.length} photo{plan.length > 1 ? "s" : ""}
            </Btn>
          </div>
        </>
      )}

      {phase === "application" && (
        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--lc-text)", marginBottom: 8 }}>
            Photo {Math.min(progression.fait + 1, progression.total)} / {progression.total} — {progression.nom}
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--lc-border)", overflow: "hidden" }}>
            <div style={{ width: `${(progression.fait / Math.max(1, progression.total)) * 100}%`, height: "100%", background: "var(--sc2)", transition: "width .2s" }}/>
          </div>
          <p style={{ fontSize: 11, color: "var(--lc-text-muted)", marginTop: 8 }}>Gardez cette fenêtre ouverte jusqu'à la fin.</p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn v="ghost" onClick={quitter}>⏹ Arrêter</Btn>
          </div>
        </div>
      )}

      {phase === "fini" && bilan && (
        <div style={{ textAlign: "center", padding: "16px 6px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>
            ✅ {bilan.modifiees} photo{bilan.modifiees > 1 ? "s" : ""} modifiée{bilan.modifiees > 1 ? "s" : ""} en {classe}
            {bilan.arrete && ` (arrêt demandé, ${bilan.total} prévues)`}
          </div>
          {bilan.echecs.length > 0 && (
            <div style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "8px 10px", marginTop: 10, textAlign: "left" }}>
              Non modifiées (photo inaccessible sur cet appareil, réessayez avec le réseau) : {bilan.echecs.join(", ")}.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <Btn onClick={fermer}>Fermer</Btn>
          </div>
        </div>
      )}
    </Modale>
  );
}
