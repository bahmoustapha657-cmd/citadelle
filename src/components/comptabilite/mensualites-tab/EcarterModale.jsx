import { useState } from "react";
import { Btn, Modale } from "../../ui";
import { estNonReinscritSansPaiement } from "../../../ecartes-non-reinscrits";

const trierClasses = (classes) => [...classes].sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));

// Choisir une classe dont on écarte les non réinscrits sans paiement, voir
// lesquels avant de confirmer, et réafficher une classe déjà écartée. Le
// réglage vaut pour toute l'école (alerte, module École, portail enseignant).
// `eleves` : élèves du périmètre de l'alerte, AVANT écartement.
// `changerClassesEcartees` : enregistre la nouvelle liste (réseau).
// `peutModifier` faux : consultation seule.
export function EcarterModale({ eleves, classesEcartees, changerClassesEcartees, classeCourante, peutModifier = true, fermer }) {
  const [enCours, setEnCours] = useState(false);
  const candidats = eleves.filter(estNonReinscritSansPaiement);
  const parClasse = (classe) => candidats.filter((e) => e.classe === classe);
  const classesVisibles = new Set(eleves.map((e) => e.classe));
  const proposables = trierClasses(new Set(candidats.map((e) => e.classe).filter((c) => c && !classesEcartees.includes(c))));
  const [choix, setClasse] = useState(classeCourante);
  // Classe juste écartée (ou plus proposable) : on passe à la suivante.
  const classe = proposables.includes(choix) ? choix : proposables[0] || "";
  const choisis = classe ? parClasse(classe) : [];
  const changer = async (classes) => {
    setEnCours(true);
    try { await changerClassesEcartees(classes); } finally { setEnCours(false); }
  };

  return (
    <Modale titre="🚫 Écarter les non réinscrits" fermer={fermer}>
      <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5, marginBottom: 12 }}>
        Élèves actifs dont l'inscription ou la réinscription n'est pas encaissée <strong>et qui n'ont rien payé</strong> de
        l'année. Une fois leur classe écartée, ils disparaissent <strong>pour toute l'école</strong> : alerte, préavis et
        listes imprimées, module École (chefs de section, Direction) et portail des enseignants. <strong>Leur fiche n'est
        pas modifiée</strong>, et un élève qui paie quoi que ce soit réapparaît partout de lui-même.
      </div>

      {peutModifier && (proposables.length ? (
        <>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Classe</label>
          <select value={classe} onChange={(e) => setClasse(e.target.value)}
            style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13, width: "100%" }}>
            {proposables.map((c) => <option key={c} value={c}>{c} — {parClasse(c).length} élève(s)</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: "#64748b", margin: "10px 0 4px" }}>Seront écartés :</div>
          <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 12.5, lineHeight: 1.6, maxHeight: 180, overflowY: "auto" }}>
            {choisis.map((e) => <li key={e._id}><strong>{e.nom} {e.prenom}</strong>{e.matricule ? ` · ${e.matricule}` : ""}</li>)}
          </ol>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <Btn disabled={!choisis.length || enCours} onClick={() => changer([...classesEcartees, classe])}>
              🚫 Écarter {choisis.length} élève(s) de {classe}
            </Btn>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
          Aucun autre non réinscrit sans paiement à écarter dans cette sélection.
        </div>
      ))}

      {classesEcartees.length > 0 && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--lc-border, #e2e8f0)", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Classes écartées (toute l'école)</div>
          {trierClasses(classesEcartees).map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ flex: 1 }}>
                <strong>{c}</strong>
                {classesVisibles.has(c) ? ` — ${parClasse(c).length} élève(s) masqué(s)` : " — autre section ou classe"}
              </span>
              {peutModifier && (
                <Btn sm v="ghost" disabled={enCours} onClick={() => changer(classesEcartees.filter((x) => x !== c))}>↺ Réafficher</Btn>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Fermer</Btn>
      </div>
    </Modale>
  );
}
