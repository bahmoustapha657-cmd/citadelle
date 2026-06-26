// Contenu du Centre d'aide EduGest. Chaque article : { id, cat, titre, roles?,
// etapes[] }. `roles` (optionnel) restreint l'affichage à certains rôles ;
// absent = visible par tous. Le contenu est volontairement simple et orienté
// « pas à pas » pour des utilisateurs non techniques.

export const CATEGORIES = [
  { id: "demarrage", label: "🚀 Démarrage" },
  { id: "eleves", label: "🎒 Élèves & inscriptions" },
  { id: "notes", label: "📝 Notes & bulletins" },
  { id: "compta", label: "💰 Comptabilité & paiements" },
  { id: "comptes", label: "👥 Comptes & rôles" },
  { id: "portails", label: "📱 Portails parent / enseignant" },
  { id: "horsligne", label: "📶 Hors-ligne & impression" },
  { id: "securite", label: "🔒 Sécurité & vérification" },
];

export const ARTICLES = [
  {
    id: "premiers-pas",
    cat: "demarrage",
    titre: "Premiers pas : configurer mon école",
    etapes: [
      "Ouvrez Paramètres → Identité pour renseigner le nom, le logo et les couleurs de l'école.",
      "Créez vos classes dans le module Primaire ou Secondaire (onglet Classes).",
      "Ajoutez les matières et leurs coefficients (onglet Matières).",
      "Inscrivez vos élèves (onglet Élèves) ou importez-les depuis un fichier Excel.",
    ],
  },
  {
    id: "guide-demarrage",
    cat: "demarrage",
    roles: ["admin", "direction", "superadmin"],
    titre: "Où trouver le guide de démarrage ?",
    etapes: [
      "Le bouton flottant 🚀 en bas de l'écran ouvre le guide de démarrage pas à pas.",
      "Il liste les étapes recommandées pour rendre votre école opérationnelle.",
    ],
  },
  {
    id: "inscrire-eleve",
    cat: "eleves",
    titre: "Inscrire un élève",
    etapes: [
      "Module Primaire/Secondaire → onglet Élèves → « Ajouter ».",
      "Renseignez nom, prénom, sexe, classe et, si disponible, le matricule national (IEN).",
      "Le tuteur et son contact permettent de créer ensuite un compte parent.",
    ],
  },
  {
    id: "importer-eleves",
    cat: "eleves",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Importer une liste d'élèves (Excel)",
    etapes: [
      "Comptabilité → Inscriptions → « Importer ».",
      "Sélectionnez votre fichier ; EduGest détecte automatiquement les colonnes (nom, classe, sexe, IEN…).",
      "Vérifiez l'aperçu puis validez : les doublons (même IEN/matricule) sont signalés.",
    ],
  },
  {
    id: "saisir-notes",
    cat: "notes",
    titre: "Saisir les notes",
    etapes: [
      "Module Primaire/Secondaire → onglet Notes.",
      "Utilisez la « Saisie en grille » pour saisir toute une classe d'un coup.",
      "Vous pouvez saisir plusieurs périodes et plusieurs matières à la fois, puis enregistrer.",
      "La saisie est sauvegardée localement : même en cas de coupure réseau, rien n'est perdu.",
    ],
  },
  {
    id: "imprimer-bulletin",
    cat: "notes",
    titre: "Imprimer un bulletin",
    etapes: [
      "Module Primaire/Secondaire → onglet Bulletins.",
      "Choisissez la période et la classe, puis « Imprimer » (un élève) ou « Tous les bulletins ».",
      "Le bulletin porte un QR code de vérification en haut.",
      "Astuce : choisissez le modèle de bulletin dans Paramètres → Évaluations (classique, compact, moderne).",
    ],
  },
  {
    id: "resultats-evaluations",
    cat: "notes",
    titre: "Voir les résultats / le classement d'une classe",
    etapes: [
      "Onglet Bulletins → bouton « 🏆 Résultats des évaluations ».",
      "Vous obtenez le classement par moyenne, les mentions et des statistiques (dont la répartition par genre).",
    ],
  },
  {
    id: "recu-paiement",
    cat: "compta",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Encaisser un paiement et imprimer un reçu",
    etapes: [
      "Comptabilité → Mensualités : cochez les mois payés par l'élève.",
      "Cliquez sur l'icône reçu pour imprimer un reçu (avec QR de vérification).",
      "Les impayés et encaissements sont suivis automatiquement dans l'Aperçu.",
    ],
  },
  {
    id: "salaires",
    cat: "compta",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Gérer les salaires et fiches de paie",
    etapes: [
      "Comptabilité → Salaires : définissez la rémunération (forfait ou taux horaire).",
      "Imprimez les fiches de paie ; elles portent un QR de vérification.",
    ],
  },
  {
    id: "creer-compte-parent",
    cat: "comptes",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Créer un compte parent",
    etapes: [
      "Onglet Élèves → ouvrez la fiche d'un élève → « Créer un compte parent ».",
      "L'identifiant est proposé automatiquement (sans accents) ; un mot de passe est généré.",
      "Le parent changera son mot de passe à la première connexion.",
    ],
  },
  {
    id: "creer-compte-enseignant",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Créer un compte enseignant",
    etapes: [
      "Onglet Enseignants → ouvrez une fiche → « Créer un compte ».",
      "Au primaire, le titulaire saisit toutes les matières de sa classe ; au secondaire, sa matière.",
      "Vérifiez que la classe titulaire (primaire) est bien renseignée pour qu'il voie ses élèves.",
    ],
  },
  {
    id: "roles",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Comprendre les rôles et leurs droits",
    etapes: [
      "Direction : accès complet. Comptable : inscriptions, paiements, comptes parents.",
      "Enseignant : ses classes, notes et signalements. Parent : suivi de son/ses enfant(s).",
      "Les droits se règlent dans Paramètres → Rôles.",
    ],
  },
  {
    id: "portail-enseignant",
    cat: "portails",
    titre: "Le portail enseignant",
    etapes: [
      "L'enseignant se connecte avec son identifiant et voit ses classes et élèves.",
      "Il saisit les notes (grille), signale des absences et consulte ses fiches de paie.",
      "S'il ne voit aucun élève : vérifiez sa classe titulaire (primaire) ou ses affectations (EDT).",
    ],
  },
  {
    id: "portail-parent",
    cat: "portails",
    titre: "Le portail parent",
    etapes: [
      "Le parent se connecte et suit les notes, bulletins, absences et paiements de son enfant.",
      "Plusieurs enfants peuvent être rattachés à un même compte parent.",
    ],
  },
  {
    id: "hors-ligne",
    cat: "horsligne",
    titre: "Travailler hors-ligne",
    etapes: [
      "EduGest s'installe comme une application (PWA) et s'ouvre même sans connexion.",
      "La saisie de notes est conservée localement et synchronisée au retour du réseau.",
      "Un badge « notes en attente » apparaît tant que la synchronisation n'est pas faite.",
    ],
  },
  {
    id: "installer-app",
    cat: "horsligne",
    titre: "Installer EduGest sur mon téléphone",
    etapes: [
      "Ouvrez le site dans Chrome (Android) ou Safari (iPhone).",
      "Utilisez le menu du navigateur → « Ajouter à l'écran d'accueil » (ou la bannière proposée).",
      "L'icône EduGest apparaît comme une vraie application.",
    ],
  },
  {
    id: "verifier-qr",
    cat: "securite",
    roles: ["admin", "direction", "superadmin"],
    titre: "Vérifier un QR code (bulletin, reçu, fiche de paie)",
    etapes: [
      "Module Primaire/Secondaire → Aperçu → « 🔍 Vérifier un QR ».",
      "Scannez le QR avec la caméra (ou importez une photo).",
      "Les QR sont chiffrés : un lecteur QR ordinaire ne peut pas les lire, seul ce scanner le peut.",
      "Un document authentique affiche ses champs ; un faux affiche « QR non reconnu ».",
    ],
  },
  {
    id: "mot-de-passe",
    cat: "securite",
    titre: "Réinitialiser un mot de passe",
    etapes: [
      "Direction/comptable : ouvrez le compte concerné et « Réinitialiser le mot de passe ».",
      "L'utilisateur devra le changer à sa prochaine connexion.",
    ],
  },
];
