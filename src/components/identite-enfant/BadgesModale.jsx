import { useState } from "react";
import { imprimerBadges } from "../../reports";
import { FORMATS_BADGE, TAILLES_BADGE, grilleBadges } from "../../reports/trombinoscope";
import { Btn, Modale } from "../ui";

const CLE_FORMAT = "edugest_badges_format";
const CLE_MIROIR = "edugest_badges_miroir";
const CLE_TAILLE = "edugest_badges_taille";
// « 6,8 » pour 68 mm.
const cm = (mm) => (Math.round(mm) / 10).toLocaleString("fr-FR");
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
// (écusson de poche pour la tenue, ou badge portrait à plastifier), taille
// (normale, réduite, petite), photo, impression en miroir pour le papier
// transfert textile. Format, taille et miroir sont gardés sur l'appareil
// d'une impression à l'autre (taille réduite par défaut) ; la photo est
// cochée d'office en maternelle seulement.
export function BadgesModale({ eleves = [], schoolInfo = {}, annee = "", section = "", fermer }) {
  const [format, setFormat] = useState(() => {
    const memorise = lire(CLE_FORMAT, "");
    return FORMATS_BADGE[memorise] ? memorise : section === "prescolaire" ? "portrait" : "poche";
  });
  const [photo, setPhoto] = useState(section === "prescolaire");
  const [miroir, setMiroir] = useState(() => lire(CLE_MIROIR, "0") === "1");
  const [taille, setTaille] = useState(() => {
    const memorisee = lire(CLE_TAILLE, "");
    return TAILLES_BADGE[memorisee] ? memorisee : "reduite";
  });
  const g = grilleBadges(format, taille);
  const pages = Math.ceil(eleves.length / g.parPage);

  const choisirFormat = (valeur) => { setFormat(valeur); ecrire(CLE_FORMAT, valeur); };
  const choisirTaille = (valeur) => { setTaille(valeur); ecrire(CLE_TAILLE, valeur); };
  const changerMiroir = (valeur) => { setMiroir(valeur); ecrire(CLE_MIROIR, valeur ? "1" : "0"); };
  const imprimer = () => {
    imprimerBadges(eleves, { schoolInfo, annee, format, taille, photo, miroir });
    fermer();
  };

  return (
    <Modale titre="🏷️ Badges des élèves" fermer={fermer}>
      {/* #root centre le texte de l'app : ici, des explications à lire. */}
      <div style={{ textAlign: "start" }}>
      <div role="radiogroup" aria-label="Format du badge" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {Object.entries(FORMATS_BADGE).map(([cle, valeur]) => {
          const actif = cle === format;
          const grille = grilleBadges(cle, taille);
          return (
            <button key={cle} type="button" role="radio" aria-checked={actif} onClick={() => choisirFormat(cle)}
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "start", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: `2px solid ${actif ? "var(--sc1)" : "var(--lc-border)"}`, background: actif ? "var(--lc-surface-alt, #eff6ff)" : "var(--lc-surface)", color: actif ? "var(--sc1)" : "var(--lc-text-muted)" }}>
              <Silhouette largeur={valeur.largeur} hauteur={valeur.hauteur}/>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 13, color: "var(--lc-text)" }}>{valeur.nom} {cm(grille.largeur)} × {cm(grille.hauteur)} cm</strong>
                <span style={{ fontSize: 11 }}>
                  {cle === "poche" ? "Pour la tenue : poche ou poitrine" : "À plastifier, en collier ou sur le sac"} · {grille.parPage} par page A4
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "var(--lc-text)" }}>
        <strong>Taille</strong>
        <div role="radiogroup" aria-label="Taille du badge" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {Object.entries(TAILLES_BADGE).map(([cle, valeur]) => {
            const actif = cle === taille;
            const grille = grilleBadges(format, cle);
            return (
              <button key={cle} type="button" role="radio" aria-checked={actif} onClick={() => choisirTaille(cle)}
                style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, textAlign: "start",
                  border: `2px solid ${actif ? "var(--sc1)" : "var(--lc-border)"}`, background: actif ? "var(--lc-surface-alt, #eff6ff)" : "var(--lc-surface)", color: "var(--lc-text)" }}>
                <strong>{valeur.nom}</strong>
                <span style={{ display: "block", fontSize: 11, color: "var(--lc-text-muted)" }}>{cm(grille.largeur)} × {cm(grille.hauteur)} cm · {grille.parPage} par page</span>
              </button>
            );
          })}
        </div>
        {taille === "petite" && (
          <span style={{ display: "block", fontSize: 11, color: "#92400e", marginTop: 4 }}>
            Les petits textes (IEN, ligne du bas) deviennent très fins : faites d'abord un essai.
          </span>
        )}
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
