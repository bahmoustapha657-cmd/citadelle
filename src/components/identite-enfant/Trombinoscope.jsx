import { useMemo, useState } from "react";
import {
  aUnePhoto, comparerClasses, correspondEnfant, couleurClasse, grouperParClasse, nomAppel, nomOfficiel,
} from "../../identite-enfant";
import { imprimerBadges, imprimerTrombinoscope } from "../../reports";
import { Btn, Vide } from "../ui";
import { EnfantAgrandi } from "./EnfantAgrandi";
import { PhotoEleve } from "./PhotoEleve";

// Trombinoscope à l'écran : les enfants en grandes photos, classe par classe,
// le nom auquel ils répondent en gros. Recherche par prénom, surnom, nom,
// tuteur ou filiation ; un toucher agrandit l'enfant. Impressions :
// trombinoscope A4 et, en maternelle, badges.
// `onSeancePhoto(classe, eleveId)` : présent seulement pour qui peut modifier
// les fiches (pas le portail enseignant).
export function Trombinoscope({ eleves = [], schoolInfo = {}, annee = "", section = "", onSeancePhoto = null }) {
  const [recherche, setRecherche] = useState("");
  const [classe, setClasse] = useState("all");
  const [agrandi, setAgrandi] = useState(null);

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
        {onSeancePhoto && <Btn sm v="blue" onClick={() => { setAgrandi(null); onSeancePhoto(enfantAgrandi.classe || null, enfantAgrandi._id); }}>
          📸 {aUnePhoto(enfantAgrandi) ? "Changer sa photo / son surnom" : "Prendre sa photo"}
        </Btn>}
      </>}/>
    </div>
  );
}
