// Messages de diffusion SuperAdmin, côté école : lecture et accusé de lecture.
// Façade sans logique depuis le retrait du chemin Vercel/Firestore
// (liquidation Firebase, lot 5) — le module Supabase renvoie toujours un
// tableau, et l'accusé de lecture reste best-effort.
export { fetchSuperadminMessages, enregistrerLecture } from "../../backend/superadmin-messages-supabase";
