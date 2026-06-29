// ── Portail parent via Supabase ─────────────────────────────────────────────
// Remplace l'appel à l'API serveur /parent-portal. La RLS restreint déjà tout
// aux enfants du parent connecté (my_eleve_ids via parent_eleves) ; on renvoie
// le même payload normalisé que portail-parent-api.js.
import { getSupabase } from "../supabaseClient";
import { transformRow } from "./collection-map";

export async function fetchParentPortal() {
  const sb = getSupabase();

  // Enfants du parent (toutes sections confondues — table unifiée + RLS).
  const { data: elevesRows, error } = await sb.from("eleves").select("*");
  if (error) throw new Error(error.message || "Chargement impossible.");
  const eleves = (elevesRows || []).map((r) => transformRow("eleves", r));
  const ids = eleves.map((e) => e._id);

  const vide = { data: [] };
  const [notes, absences, tarifs, annonces, messages] = await Promise.all([
    ids.length ? sb.from("notes").select("*").in("eleve_id", ids) : vide,
    ids.length ? sb.from("absences").select("*").in("eleve_id", ids) : vide,
    sb.from("tarifs").select("*"),
    sb.from("annonces").select("*").order("created_at", { ascending: false }).limit(10),
    ids.length ? sb.from("messages").select("*").in("eleve_id", ids).order("created_at", { ascending: false }) : vide,
  ]);

  const map = (res, table) => (res.data || []).map((r) => transformRow(table, r));
  return {
    eleves,
    notes: map(notes, "notes"),
    absences: map(absences, "absences"),
    tarifs: map(tarifs, "tarifs"),
    annonces: map(annonces, "annonces"),
    messages: map(messages, "messages"),
  };
}

export async function envoyerMessageParent({ eleveId, sujet, corps }) {
  const sb = getSupabase();
  // RLS limite la lecture à ses enfants → valide aussi l'appartenance.
  const { data: el } = await sb.from("eleves").select("ecole_id, nom, prenom").eq("id", eleveId).maybeSingle();
  if (!el) throw new Error("Élève introuvable pour ce compte parent.");

  const { error } = await sb.from("messages").insert({
    ecole_id: el.ecole_id,
    eleve_id: eleveId,
    extra: {
      eleveNom: `${el.prenom || ""} ${el.nom || ""}`.trim(),
      sujet, corps, message: corps,
      role: "parent", de: "parent", lu: false,
      date: new Date().toISOString().slice(0, 10),
    },
  });
  if (error) throw new Error(error.message || "Envoi impossible.");
  return { ok: true };
}
