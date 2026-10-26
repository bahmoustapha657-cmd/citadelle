import { C } from "../../constants";
import { CONTOUR_MAX, CONTOUR_MIN, FONDS_PRETS, FOND_ORIGINAL, normaliserCouleur } from "./fond-photo";

const pastille = (actif) => ({
  position: "relative", width: 34, height: 34, borderRadius: "50%", padding: 0, cursor: "pointer", flexShrink: 0,
  border: "2px solid #cbd5e1", boxSizing: "border-box",
  outline: actif ? `3px solid ${C.blue}` : "none", outlineOffset: 2,
});

// Rangée de fonds sous la photo à vérifier : Original, couleurs prêtes
// (blanc, bleu clair, gris clair, couleur de l'école) et choix libre ; puis,
// fond choisi, le réglage « Contour » pour rattraper une oreille ou des
// cheveux coupés (ou un reste de décor).
export function ChoixFond({
  fond, choisirFond, couleurEcole = "", enCours = false, erreur = "", reglage = 0, choisirContour = null,
}) {
  const ecole = normaliserCouleur(couleurEcole);
  const prets = ecole && !FONDS_PRETS.some((f) => f.valeur === ecole)
    ? [...FONDS_PRETS, { valeur: ecole, nom: "Couleur de l'école" }]
    : FONDS_PRETS;
  const libre = fond !== FOND_ORIGINAL && !prets.some((f) => f.valeur === fond);
  const nom = fond === FOND_ORIGINAL ? "d'origine" : (prets.find((f) => f.valeur === fond)?.nom || "couleur choisie");

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#334155" }}>
        🎨 Fond : {nom}{enCours && <span style={{ fontWeight: 400, color: "#64748b" }}> · détourage…</span>}
      </p>
      <div role="radiogroup" aria-label="Fond de la photo" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" role="radio" aria-checked={fond === FOND_ORIGINAL} aria-label="Fond d'origine"
          title="Fond d'origine" onClick={() => choisirFond(FOND_ORIGINAL)}
          style={{ ...pastille(fond === FOND_ORIGINAL), background: "linear-gradient(135deg,#fff 44%,#ef4444 44%,#ef4444 56%,#fff 56%)" }}/>
        {prets.map((f) => (
          <button key={f.valeur} type="button" role="radio" aria-checked={fond === f.valeur} aria-label={f.nom}
            title={f.nom} onClick={() => choisirFond(f.valeur)}
            style={{ ...pastille(fond === f.valeur), background: f.valeur }}/>
        ))}
        {/* Choix libre : le sélecteur de couleur du système, invisible
            par-dessus la pastille arc-en-ciel (ou la couleur choisie). */}
        <label title="Autre couleur" role="radio" aria-checked={libre}
          style={{ ...pastille(libre), display: "inline-block", overflow: "hidden",
            background: libre ? fond : "conic-gradient(#ef4444,#f59e0b,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)" }}>
          <input type="color" aria-label="Autre couleur de fond" value={libre ? fond : "#ffffff"}
            onChange={(e) => choisirFond(e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0 }}/>
        </label>
      </div>
      {erreur
        ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "8px 10px", borderRadius: 8 }}>{erreur}</p>
        : fond !== FOND_ORIGINAL && (
          <>
            {choisirContour && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "#334155" }}>
                <strong style={{ whiteSpace: "nowrap" }}>✂️ Contour</strong>
                <span style={{ fontSize: 11, color: "#64748b" }}>serré</span>
                <input type="range" min={CONTOUR_MIN} max={CONTOUR_MAX} step={1} value={reglage}
                  onChange={(e) => choisirContour(e.target.value)}
                  aria-label="Contour de l'enfant : plus serré ou plus large" style={{ flex: 1, minWidth: 0 }}/>
                <span style={{ fontSize: 11, color: "#64748b" }}>large</span>
              </label>
            )}
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              {choisirContour && "Oreille ou cheveux coupés : poussez vers « large ». Un reste de décor : vers « serré ». "}
              Le fond choisi reste proposé pour les photos suivantes.
            </p>
          </>
        )}
    </div>
  );
}
