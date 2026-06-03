// Fragment HTML : lignes (<tr>) du tableau des matières d'un bulletin.
import { getMention, getMentionColors } from "./bulletin-format.js";

// Construit le corps du tableau des matières à partir des lignes calculées.
export function buildLignesRows(lignes, maxNote) {
  return lignes.map((l) => {
    const moyVal = l.moy === "—" ? null : Number(l.moy);
    const mLigne = getMention(l.moy, maxNote);
    const lc = getMentionColors(mLigne);
    const pct = moyVal != null ? Math.min(100, Math.max(0, (moyVal / maxNote) * 100)) : 0;
    const compare = (moyVal != null && l.moyClasse != null)
      ? (moyVal > l.moyClasse + 0.05
          ? `<span style="color:#16a34a;font-weight:700">↑ +${(moyVal - l.moyClasse).toFixed(1)}</span>`
          : moyVal < l.moyClasse - 0.05
            ? `<span style="color:#dc2626;font-weight:700">↓ ${(moyVal - l.moyClasse).toFixed(1)}</span>`
            : `<span style="color:#6b7280">=</span>`)
      : "";
    const moyClasseDisplay = l.moyClasse != null ? l.moyClasse.toFixed(1) : "—";
    return `<tr>
      <td>${l.mat}</td>
      <td style="text-align:center">${l.coef}</td>
      <td style="text-align:center">
        <div style="display:inline-flex;align-items:center;gap:6px">
          <strong style="color:${lc.color};min-width:32px;display:inline-block;text-align:right">${l.moy}</strong>
          <div style="width:48px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${lc.color}"></div>
          </div>
        </div>
      </td>
      <td style="text-align:center">${l.moy !== "—" ? (Number(l.moy) * l.coef).toFixed(2) : "—"}</td>
      <td style="text-align:center;font-size:10px;color:#6b7280">${moyClasseDisplay} ${compare}</td>
      <td style="background:${lc.bg};color:${lc.color};font-weight:600;font-size:10.5px">${mLigne}</td>
    </tr>`;
  }).join("");
}
