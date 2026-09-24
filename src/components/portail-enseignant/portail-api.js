// Chargement des données du portail enseignant. Simple façade depuis le
// retrait du chemin Vercel/Firebase (liquidation Firebase, lot 3) : le module
// Supabase renvoie le portalData complet, tableaux garantis, ou lève.
//
// Note : l'ancien chemin passait un en-tête X-Account-Scope pour que le
// service worker isole la réponse en cache par enseignant (appareil partagé).
// Sans requête HTTP, il n'y a plus de réponse à mettre en cache ici — c'est
// PowerSync qui porte le hors-ligne.
export { fetchTeacherPortal } from "../../backend/teacher-portal-supabase";
