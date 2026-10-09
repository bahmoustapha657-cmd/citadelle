import * as sbTransferts from "../../backend/transferts-supabase";

// Transferts d'élèves entre écoles. Chaque fonction renvoie le JSON décodé ;
// la gestion d'état et des toasts reste dans useTransferts.

export function apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination }) {
  return sbTransferts.apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination });
}

// Transferts déjà émis par l'école.
export function apiListerTransferts() {
  return sbTransferts.apiListerTransferts();
}

export function apiVerifierToken(token) {
  return sbTransferts.apiVerifierToken(token);
}

// `classe`, `matricule` : choisis par l'école d'accueil.
export function apiAccepterTransfert({ token, classe, matricule }) {
  return sbTransferts.apiAccepterTransfert({ token, classe, matricule });
}
