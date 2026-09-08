// Accès réseau du portail parent : chargement des données et envoi d'un
// message. Simple façade — elle isole les composants du backend, mais ne
// contient plus de logique depuis que le chemin Vercel/Firebase a été retiré
// (liquidation Firebase, lot 3). La normalisation (tableaux garantis) et la
// levée d'erreur vivent dans le module Supabase.
export { fetchParentPortal, envoyerMessageParent } from "../../backend/parent-portal-supabase";
