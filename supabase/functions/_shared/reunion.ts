// ── Règles de l'Edge Function `reunion` (appels de groupe, SFU Cloudflare) ──
// Fonctions pures, testées côté Node (tests/reunion-regles.test.js) : ce sont
// elles qui garantissent qu'un participant ne publie que SES pistes et ne
// reçoit que celles des participants de SA réunion.

export const PISTES_VALIDES = ["audio", "video"] as const;
export type NomPiste = (typeof PISTES_VALIDES)[number];

export type PistePubliee = { trackName: string; kind: string };
export type Participant = {
  compte_id: string;
  session_id: string | null;
  pistes: PistePubliee[] | null;
  quitte_at: string | null;
};

// Publication : uniquement « audio » / « video », mid fourni, sans doublon.
export function pistesAPublier(tracks: unknown): { mid: string; trackName: NomPiste }[] {
  if (!Array.isArray(tracks) || tracks.length === 0 || tracks.length > 2) {
    throw new Error("Pistes à publier invalides.");
  }
  const vues = new Set<string>();
  return tracks.map((t) => {
    const mid = String((t as { mid?: unknown })?.mid ?? "");
    const trackName = String((t as { trackName?: unknown })?.trackName ?? "") as NomPiste;
    if (!mid || !PISTES_VALIDES.includes(trackName) || vues.has(trackName)) {
      throw new Error("Pistes à publier invalides.");
    }
    vues.add(trackName);
    return { mid, trackName };
  });
}

// Pistes connues d'un participant après publication (fusion sans doublon).
export function fusionnerPistes(existantes: PistePubliee[] | null, publiees: string[]): PistePubliee[] {
  const parNom = new Map((existantes || []).map((p) => [p.trackName, p]));
  for (const nom of publiees) parNom.set(nom, { trackName: nom, kind: nom === "video" ? "video" : "audio" });
  return [...parNom.values()];
}

// Réception : chaque demande { compteId, trackName } doit viser un AUTRE
// participant présent de la même réunion, qui a publié cette piste. Les
// demandes invalides sont ignorées (pas d'erreur : un participant peut être
// parti entre-temps).
export function pistesARecevoir(
  demandes: unknown,
  participants: Participant[],
  moi: string,
): { location: "remote"; sessionId: string; trackName: string; compteId: string }[] {
  if (!Array.isArray(demandes)) return [];
  const parCompte = new Map(participants.map((p) => [p.compte_id, p]));
  const resultat: { location: "remote"; sessionId: string; trackName: string; compteId: string }[] = [];
  const vues = new Set<string>();
  for (const d of demandes.slice(0, 60)) {
    const compteId = String((d as { compteId?: unknown })?.compteId ?? "");
    const trackName = String((d as { trackName?: unknown })?.trackName ?? "");
    const p = parCompte.get(compteId);
    if (!p || compteId === moi || p.quitte_at || !p.session_id) continue;
    if (!(p.pistes || []).some((x) => x.trackName === trackName)) continue;
    const cle = `${compteId}:${trackName}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultat.push({ location: "remote", sessionId: p.session_id, trackName, compteId });
  }
  return resultat;
}
