// ── Tables de la sauvegarde quotidienne ─────────────────────────────────────
// Lu par backup-donnees.mjs, et par tests/sauvegarde-tables.test.js qui
// vérifie que CHAQUE table créée par les migrations est ici, sauvegardée ou
// écartée avec sa raison. Sans ce garde-fou, la liste avait dérivé : du
// 2026-10-08 au 2026-11-14, dix tables créées ensuite (paiements Mobile Money,
// présences du personnel, transferts d'élèves…) n'étaient PAS sauvegardées,
// sans que rien ne le signale. Module sans effet de bord.

// Toutes les tables (et vues) de données à sauvegarder.
export const TABLES = [
  "ecoles", "ecoles_public", "comptes", "postes",
  "enseignants", "enseignant_classes", "classes", "matieres",
  "eleves", "notes", "absences", "emplois", "enseignements",
  "appreciations", "paiements", "tarifs", "salaires", "parent_eleves", "audit",
  "recettes", "depenses", "versements", "bons", "personnel", "paie_enseignants",
  "messages", "annonces", "documents", "examens", "livrets", "honneurs",
  "membres", "evenements", "historique", "push_subs",
  "messages_internes", "messages_internes_lus",
  "msg_conversations", "msg_membres", "msg_messages", "msg_appels", "msg_appels_traces",
  "msg_annonces", "msg_annonces_lus", "msg_reunions", "msg_reunion_participants", "msg_presences",
  // Ajoutées le 2026-11-14 (absentes depuis leur création).
  "paiement_config", "paiements_en_ligne", "presences", "transferts",
  "notifications_envois", "demandes_plan", "superadmin_messages", "superadmin_message_lectures",
];

// Tables volontairement NON sauvegardées, avec la raison.
export const EXCLUES = {
  // Codes de réinitialisation de mot de passe : secrets à durée de vie de
  // quelques minutes, sans valeur après une restauration.
  codes_reinitialisation: "codes de mot de passe éphémères",
};

// Tri de pagination (défaut : id). Les tables sans `id` unique sont triées
// par leur clé (une ou plusieurs colonnes) : un tri ambigu peut sauter ou
// doubler des lignes d'une page de 1000 à l'autre.
export const TRI = {
  parent_eleves: ["eleve_id"],
  enseignant_classes: ["compte_id"],
  messages_internes_lus: ["message_id"],
  msg_membres: ["conversation_id"],
  msg_annonces_lus: ["annonce_id"],
  msg_reunion_participants: ["reunion_id"],
  msg_presences: ["compte_id"],
  msg_appels_traces: ["appel_id", "compte_id"],
  paiement_config: ["ecole_id"],
  superadmin_message_lectures: ["message_id", "user_id"],
};
