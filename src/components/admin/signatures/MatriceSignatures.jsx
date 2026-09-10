// Tableau de la matrice « Qui signe quoi », sans état propre : il reçoit tout
// de useSignaturesCard (voir SignaturesCard). Séparé pour rester rendable et
// testable sans le backend.
import { Btn } from "../../ui";
import { getDefaultPoste } from "../../../../shared/postes-config.js";
import { DOCUMENTS_SIGNES, SECTION } from "../../../reports/signatures";

const SECTIONS_APERCU = [["primaire", "Primaire"], ["college", "Collège"]];

// Options d'un emplacement : chef de section (documents d'élève), puis les
// postes de l'école — système d'abord, puis ceux qu'elle a créés.
function OptionsPostes({ doc, postes, valeur, avecAucun }) {
  const dansLaTable = postes.some((p) => p.cle === valeur);
  // Même règle que le résolveur : un poste système existe toujours, un poste
  // créé par l'école n'existe que tant qu'il est dans la table.
  const posteSysteme = !dansLaTable && valeur && valeur !== SECTION ? getDefaultPoste(valeur) : null;
  const supprime = valeur && valeur !== SECTION && !dansLaTable && !posteSysteme;
  return (
    <>
      {avecAucun && <option value="">— Aucun —</option>}
      {doc.section && <option value={SECTION}>Chef de la section de l'élève</option>}
      {postes.map((p) => (
        <option key={p.cle} value={p.cle}>
          {p.label}{p.responsable ? ` — ${p.responsable}` : " (aucun responsable)"}{p.actif ? "" : " · désactivé"}
        </option>
      ))}
      {posteSysteme && <option value={valeur}>{posteSysteme.label}</option>}
      {supprime && <option value={valeur}>⚠️ Poste supprimé — signataire d'origine utilisé</option>}
    </>
  );
}

// « Imprimera : La Principale · Djiba Oury Diallo » — le résultat réel du
// réglage, calculé par le même résolveur que les documents.
function Apercu({ signataires }) {
  return signataires.map((s) => (
    <div key={s.role} style={{ fontSize: 11, lineHeight: 1.45, color: "#334155" }}>
      {s.role === "visa" && <span style={{ color: "#64748b" }}>visa : </span>}
      <strong>{s.titre}</strong>
      {s.nom
        ? <span> · {s.nom}</span>
        : <span style={{ color: "#b45309" }}> · ⚠️ sans nom</span>}
    </div>
  ));
}

// Tableau de la matrice, sans état propre : `s` vient de useSignaturesCard.
export function MatriceSignatures({ s, peutGererRoles }) {
  const select = { width: "100%", minWidth: 190, padding: "6px 8px", borderRadius: 7, border: "1px solid #cbd5e1",
    fontSize: 12, background: peutGererRoles ? "#fff" : "#f8fafc", color: "#1f2937" };
  const groupes = [...new Set(DOCUMENTS_SIGNES.map((d) => d.groupe))];

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#475569" }}>
              {["Document", "Signataire", "Second signataire (visa)", "Imprimera"].map((t) => (
                <th key={t} style={{ textAlign: "start", padding: "6px 8px", borderBottom: "2px solid #e2e8f0", fontSize: 11, whiteSpace: "nowrap" }}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupes.map((groupe) => [
              <tr key={`g-${groupe}`}>
                <td colSpan={4} style={{ padding: "10px 8px 4px", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em" }}>{groupe}</td>
              </tr>,
              ...DOCUMENTS_SIGNES.filter((d) => d.groupe === groupe).map((doc) => {
                const ligne = s.matrice[doc.id];
                const parSection = ligne.principal === SECTION || ligne.visa === SECTION;
                return (
                  <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                    <td style={{ padding: "8px", fontWeight: 700, color: "#1f2937", whiteSpace: "nowrap" }}>{doc.label}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <select style={select} disabled={!peutGererRoles} value={ligne.principal}
                        aria-label={`Signataire — ${doc.label}`}
                        onChange={(e) => s.choisir(doc.id, "principal", e.target.value)}>
                        <OptionsPostes doc={doc} postes={s.postes} valeur={ligne.principal} />
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select style={select} disabled={!peutGererRoles} value={ligne.visa || ""}
                        aria-label={`Second signataire — ${doc.label}`}
                        onChange={(e) => s.choisir(doc.id, "visa", e.target.value)}>
                        <OptionsPostes doc={doc} postes={s.postes} valeur={ligne.visa} avecAucun />
                      </select>
                    </td>
                    <td style={{ padding: "8px", minWidth: 200 }}>
                      {parSection
                        ? SECTIONS_APERCU.map(([section, libelle]) => (
                          <div key={section} style={{ marginBottom: 3 }}>
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{libelle}</div>
                            <Apercu signataires={s.apercu(doc.id, section)} />
                          </div>
                        ))
                        : <Apercu signataires={s.apercu(doc.id, "college")} />}
                    </td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>

      {peutGererRoles && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Btn sm v="success" disabled={!s.modifie || s.enregistrement} onClick={s.enregistrer}>
            {s.enregistrement ? "Enregistrement…" : "💾 Enregistrer"}
          </Btn>
          {s.modifie && <Btn sm v="ghost" onClick={s.annuler}>Annuler</Btn>}
          <Btn sm v="ghost" onClick={s.retablir}>Rétablir les signataires d'origine</Btn>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            « ⚠️ sans nom » : nommez un responsable sur ce poste, dans Comptes & Postes ci-dessus.
          </span>
        </div>
      )}
    </>
  );
}
