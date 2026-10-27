import { useState } from "react";
import { imprimerBadges } from "../../reports";
import { FORMATS_BADGE } from "../../reports/trombinoscope";
import { Btn, Modale } from "../ui";

const CLE_FORMAT = "edugest_badges_format";
const CLE_MIROIR = "edugest_badges_miroir";
const lire = (cle, parDefaut) => {
  try { return localStorage.getItem(cle) ?? parDefaut; } catch { return parDefaut; }
};
const ecrire = (cle, valeur) => {
  try { localStorage.setItem(cle, valeur); } catch { /* stockage indisponible : vaut pour cette fois */ }
};

// Dessin du format, à l'échelle, dans la carte de choix.
const Silhouette = ({ largeur, hauteur }) => (
  <span aria-hidden="true" style={{ display: "inline-block", width: largeur * 0.5, height: hauteur * 0.5, border: "2px solid currentColor", borderRadius: 4, flexShrink: 0 }}/>
);

const styleCase = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--lc-text)", cursor: "pointer", marginTop: 10 };

// Réglages avant d'imprimer des badges, pour toutes les classes : format
// (écusson de poche pour la tenue, ou badge portrait à plastifier), photo,
// impression en miroir pour le papier transfert textile. Format et miroir
// sont gardés sur l'appareil d'une impression à l'autre ; la photo est
// cochée d'office en maternelle seulement.
export function BadgesModale({ eleves = [], schoolInfo = {}, annee = "", section = "", fermer }) {
  const [format, setFormat] = useState(() => {
    const memorise = lire(CLE_FORMAT, "");
    return FORMATS_BADGE[memorise] ? memorise : section === "prescolaire" ? "portrait" : "poche";
  });
  const [photo, setPhoto] = useState(section === "prescolaire");
  const [miroir, setMiroir] = useState(() => lire(CLE_MIROIR, "0") === "1");
  const f = FORMATS_BADGE[format];
  const pages = Math.ceil(eleves.length / f.parPage);

  const choisirFormat = (valeur) => { setFormat(valeur); ecrire(CLE_FORMAT, valeur); };
  const changerMiroir = (valeur) => { setMiroir(valeur); ecrire(CLE_MIROIR, valeur ? "1" : "0"); };
  const imprimer = () => {
    imprimerBadges(eleves, { schoolInfo, annee, format, photo, miroir });
    fermer();
  };

  return (
    <Modale titre="🏷️ Badges des élèves" fermer={fermer}>
      {/* #root centre le texte de l'app : ici, des explications à lire. */}
      <div style={{ textAlign: "start" }}>
      <div role="radiogroup" aria-label="Format du badge" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {Object.entries(FORMATS_BADGE).map(([cle, valeur]) => {
          const actif = cle === format;
          return (
            <button key={cle} type="button" role="radio" aria-checked={actif} onClick={() => choisirFormat(cle)}
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "start", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: `2px solid ${actif ? "var(--sc1)" : "var(--lc-border)"}`, background: actif ? "var(--lc-surface-alt, #eff6ff)" : "var(--lc-surface)", color: actif ? "var(--sc1)" : "var(--lc-text-muted)" }}>
              <Silhouette largeur={valeur.largeur} hauteur={valeur.hauteur}/>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 13, color: "var(--lc-text)" }}>{valeur.nom}</strong>
                <span style={{ fontSize: 11 }}>
                  {cle === "poche" ? "Pour la tenue : poche ou poitrine" : "À plastifier, en collier ou sur le sac"} · {valeur.parPage} par page A4
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <label style={styleCase}>
        <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} style={{ marginTop: 2 }}/>
        <span><strong>Avec la photo de l'élève</strong><br/>
          <span style={{ fontSize: 11, color: "var(--lc-text-muted)" }}>
            {format === "portrait" ? "Sans photo, le logo de l'école prend sa place." : "Sans photo, le nom s'écrit plus grand."}
          </span>
        </span>
      </label>

      <label style={styleCase}>
        <input type="checkbox" checked={miroir} onChange={(e) => changerMiroir(e.target.checked)} style={{ marginTop: 2 }}/>
        <span><strong>Papier transfert pour tissu clair (impression en miroir)</strong><br/>
          <span style={{ fontSize: 11, color: "var(--lc-text-muted)" }}>
            Le badge sort inversé et se retrouve à l'endroit une fois repassé sur la tenue. Pour un tissu foncé, ou une
            étiquette plastifiée ou cousue : laissez décoché. Suivez la notice du papier et faites un essai sur une feuille ordinaire.
          </span>
        </span>
      </label>

      <div style={{ background: "#f8fafc", border: "1px solid var(--lc-border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--lc-text)", marginTop: 14 }}>
        Logo et nom de l'école, nom de l'élève, son IEN (ou, à défaut, son matricule), classe et année. Aucun numéro de téléphone : un badge porté se lit dans la rue.
        {!schoolInfo.logo && <span style={{ color: "#92400e" }}> L'école n'a pas encore de logo (Paramètres → Identité) : seul son nom apparaîtra.</span>}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--lc-text-muted)" }}>
          {eleves.length} badge{eleves.length > 1 ? "s" : ""} · {pages} page{pages > 1 ? "s" : ""} A4
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={fermer}>Annuler</Btn>
          <Btn onClick={imprimer} disabled={!eleves.length}>🖨️ Imprimer</Btn>
        </div>
      </div>
      </div>
    </Modale>
  );
}
