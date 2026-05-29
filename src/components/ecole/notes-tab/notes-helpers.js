export const loadXLSX = () => import("xlsx");

// Code couleur d'une note selon le barème (/maxNote) : vert ≥70 %, ambre ≥50 %, rouge sinon.
export function couleurNote(v, maxNote) {
  const n = Number(v);
  if (v === "" || isNaN(n)) return {};
  if (n >= maxNote * 0.7) return { background: "#dcfce7", color: "#166534" };
  if (n >= maxNote * 0.5) return { background: "#fef3c7", color: "#92400e" };
  return { background: "#fee2e2", color: "#991b1b" };
}
