import { useMemo, useState } from "react";
import {
  aUnePhoto, comparerClasses, correspondEnfant, couleurClasse, grouperParClasse, nomAppel, nomOfficiel,
} from "../../identite-enfant";
import { imprimerBadges, imprimerTrombinoscope } from "../../reports";
import { uploadPhotoEleve } from "../../storageUtils";
import { RetouchePhoto } from "../RetouchePhoto";
import { finaliserRetouche } from "../camera-capture/retouche";
import { Btn, Vide } from "../ui";
import { EnfantAgrandi } from "./EnfantAgrandi";
import { FondClasseModale } from "./FondClasseModale";
import { PhotoEleve } from "./PhotoEleve";

// Trombinoscope à l'écran : les enfants en grandes photos, classe par classe,
// le nom auquel ils répondent en gros. Recherche par prénom, surnom, nom,
// tuteur ou filiation ; un toucher agrandit l'enfant. Impressions :
// trombinoscope A4 et, en maternelle, badges.
// `onSeancePhoto(classe, eleveId)` et `enregistrer(id, champs)` (retouche
// d'une photo, fond de toute une classe) : présents seulement pour qui peut
// modifier les photos — direction, chef de section (pas le portail
// enseignant).
export function Trombinoscope({
  eleves = [], schoolInfo = {}, annee = "", section = "", onSeancePhoto = null,
  enregistrer = null, schoolId = "", toast = null, logAction = null,
}) {
  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState("all");
  const [agrandi, setAgrandi] = useState(null);
  const [retouche, setRetouche] = useState(null);
  const [fondClasse, setFondClasse] = useState(false);

  const classes = useMemo(
    () => [...new Set(eleves.map((e) => e.classe).filter(Boolean))].sort(comparerClasses),
    [eleves],
  );
  const classeActive = classes.includes(classe) ? classe : "all";
  const dansClasse = classeActive === "all" ? eleves : eleves.filter((e) => e.classe === classeActive);
  const groupes = grouperParClasse(dansClasse.filter((e) => correspondEnfant(e, recherche)));
  const nbSansPhoto = dansClasse.filter((e) => !aUnePhoto(e)).length;
  const badges = section === "prescolaire";
  const options = { schoolInfo, annee };
  // Fiche à jour (après une séance photo) plutôt que la copie prise au clic.
  const enfantAgrandi = agrandi ? eleves.find((e) => e._id === agrandi._id) || agrandi : null;

  const enregistrerRetouche = async (eleve, photo, memoire) => {
    const url = await uploadPhotoEleve(photo, schoolId);
    if (url === eleve.photo) return;
    await enregistrer(eleve._id, { photo: url, photoRetouche: finaliserRetouche(memoire, photo, url) });
    logAction?.("Photo retouchée", `${nomOfficiel(eleve)} (${eleve.classe || "?"})`);
    toast?.("Photo modifiée.", "success");
  };

  if (!eleves.length) return <Vide icone="🖼️" msg="Aucun enfant dans cette liste."/>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="🔍 Prénom, surnom, nom, parent…"
          style={{ flex: "1 1 220px", minWidth: 0, border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "8px 11px", fontSize: 13, background: "var(--lc-input-bg)", color: "var(--lc-text)" }}/>
        {classes.length > 1 && (
          <select value={classeActive} onChange={(e) => setClasse(e.target.value)}
            style={{ border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, background: "var(--lc-input-bg)", color: "var(--lc-text)" }}>
            <option value="all">Toutes les classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <Btn sm v="ghost" title="Une feuille A4 par classe, à afficher dans la classe"
          onClick={() => imprimerTrombinoscope(dansClasse, options)}>🖨️ Imprimer le trombinoscope</Btn>
        {badges && <Btn sm v="ghost" title="9 badges par page A4, à découper et plastifier"
          onClick={() => imprimerBadges(dansClasse, options)}>🏷️ Badges</Btn>}
        {onSeancePhoto && <Btn sm v="blue" title="Prendre les photos et les surnoms des enfants, l'un après l'autre"
          onClick={() => onSeancePhoto(classeActive === "all" ? null : classeActive)}>📸 Séance photo</Btn>}
        {enregistrer && <Btn sm v="ghost" title="La même couleur de fond derrière tous les enfants d'une classe"
          onClick={() => setFondClasse(true)}>🎨 Fond de la classe</Btn>}
      </div>

      {nbSansPhoto > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400e", marginBottom: 12 }}>
          📷 <strong>{nbSansPhoto}</strong> enfant{nbSansPhoto > 1 ? "s" : ""} sur {dansClasse.length} sans photo.
          {onSeancePhoto
            ? " La « Séance photo » les enchaîne l'un après l'autre."
            : " La direction ou la comptabilité peut les prendre (« Séance photo »)."}
        </div>
      )}

      {groupes.length === 0 && <Vide icone="🔍" msg="Aucun enfant ne correspond à cette recherche."/>}
      {groupes.map(([nomClasse, enfants]) => {
        const couleur = couleurClasse(nomClasse, schoolInfo.couleur1 || "#0A1628");
        return (
          <section key={nomClasse} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: couleur, color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 900 }}>{nomClasse}</span>
              <span style={{ fontSize: 12, color: "var(--lc-text-muted)" }}>{enfants.length} enfant{enfants.length > 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10 }}>
              {enfants.map((e) => (
                <button key={e._id} type="button" onClick={() => setAgrandi(e)} aria-label={`${nomAppel(e)} — ${nomOfficiel(e)}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 6px", borderRadius: 12, border: "1px solid var(--lc-border)", background: "var(--lc-surface)", cursor: "pointer", textAlign: "center", minWidth: 0 }}>
                  <PhotoEleve eleve={e} largeur={96}/>
                  <span style={{ fontSize: 15, fontWeight: 900, color: couleur, lineHeight: 1.15, overflowWrap: "anywhere" }}>{nomAppel(e)}</span>
                  <span style={{ fontSize: 10.5, color: "var(--lc-text-muted)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{nomOfficiel(e)}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <EnfantAgrandi eleve={enfantAgrandi} fermer={() => setAgrandi(null)} actions={enfantAgrandi && <>
        {badges && <Btn sm v="ghost" onClick={() => imprimerBadges([enfantAgrandi], options)}>🏷️ Imprimer son badge</Btn>}
        {enregistrer && aUnePhoto(enfantAgrandi) && <Btn sm v="ghost" title="Fond, cadrage, lumière — sans reprendre la photo"
          onClick={() => setRetouche(enfantAgrandi)}>✏️ Modifier la photo</Btn>}
        {onSeancePhoto && <Btn sm v="blue" onClick={() => { setAgrandi(null); onSeancePhoto(enfantAgrandi.classe || null, enfantAgrandi._id); }}>
          📸 {aUnePhoto(enfantAgrandi) ? "Changer sa photo / son surnom" : "Prendre sa photo"}
        </Btn>}
      </>}/>
      {retouche && <RetouchePhoto photo={retouche.photo} retouche={retouche.photoRetouche}
        onValider={(photo, memoire) => enregistrerRetouche(retouche, photo, memoire)}
        onClose={() => setRetouche(null)}/>}
      {fondClasse && <FondClasseModale
        eleves={eleves} classeInitiale={classeActive === "all" ? null : classeActive}
        schoolId={schoolId} enregistrer={enregistrer} toast={toast} logAction={logAction}
        fermer={() => setFondClasse(false)}/>}
    </div>
  );
}
