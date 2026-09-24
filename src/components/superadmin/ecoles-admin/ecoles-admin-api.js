// Onglets Écoles / Plans / Demandes du panel super-admin : chargement des
// écoles et de leurs stats, abonnement aux demandes, validation, application
// de plan, cycle de vie et création d'école.
//
// Façade sans logique depuis le retrait du chemin Firestore/Vercel
// (liquidation Firebase, lot 5). Côté Supabase, l'ensemble de ces opérations
// est arbitré par la RLS (is_superadmin), et non plus par une fonction
// serverless de confiance.
export {
  chargerEcolesAvecStats,
  souscrireDemandes,
  validerDemandeApi,
  rejeterDemandeApi,
  appliquerPlan,
  executerCycleVieApi,
  creerEcoleApi,
} from "../../../backend/superadmin-supabase";
