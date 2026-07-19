// Contenu du Centre d'aide EduGest. Chaque article : { id, cat, titre, roles?,
// etapes[] }. `roles` (optionnel) restreint l'affichage à certaines clés de
// rôle/poste ; absent = visible par tous. Le contenu est volontairement simple
// et orienté « pas à pas » pour des utilisateurs non techniques.

export const CATEGORIES = [
  { id: "demarrage", label: "🚀 Démarrage" },
  { id: "eleves", label: "🎒 Élèves & inscriptions" },
  { id: "notes", label: "📝 Notes & bulletins" },
  { id: "compta", label: "💰 Comptabilité & paiements" },
  { id: "comptes", label: "🧩 Comptes & Postes" },
  { id: "communication", label: "💬 Communication" },
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
      "Toujours dans Identité, cochez les sections réellement ouvertes (Primaire, Collège, Lycée) : une école sans lycée ne verra plus l'onglet Lycée.",
      "Créez vos classes dans le module Primaire ou Secondaire (onglet Classes).",
      "Ajoutez les matières et leurs coefficients (onglet Matières).",
      "Inscrivez vos élèves (onglet Élèves) ou importez-les depuis un fichier Excel.",
      "Configurez vos tarifs (Comptabilité → Mensualités → Tarifs par classe) : tous les frais sont à 0 tant qu'ils ne sont pas saisis.",
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
    id: "sections-actives",
    cat: "demarrage",
    roles: ["admin", "direction", "superadmin"],
    titre: "Mon école n'a pas de lycée (ou pas de primaire)",
    etapes: [
      "Paramètres → Identité → « Sections de l'établissement ».",
      "Décochez les sections que votre école n'a pas ; il en faut au moins une.",
      "Les onglets et les listes de classes s'adaptent : plus rien d'inutile à l'écran.",
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
    id: "configurer-tarifs",
    cat: "compta",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Configurer les tarifs (mensualité, inscription, frais)",
    etapes: [
      "Comptabilité → Mensualités → dépliez « Tarifs par classe ».",
      "Tous les montants démarrent à 0 : saisissez la mensualité de base, la révision, l'inscription et la réinscription par classe.",
      "Le tableau défile horizontalement si votre écran est petit — toutes les colonnes restent accessibles.",
      "Cliquez « Enregistrer les tarifs ». La mensualité facturée = mensualité de base + révision.",
    ],
  },
  {
    id: "frais-annexes",
    cat: "compta",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Ajouter des frais annexes (tenue, cantine, transport…)",
    etapes: [
      "Comptabilité → Mensualités → « Tarifs par classe » : rangée « + Ajouter un frais ».",
      "Choisissez un frais du catalogue (tenue, fournitures, cantine, transport, examen, assurance, carte, activités, internat, APEAE) : une colonne s'ajoute.",
      "Saisissez le montant par classe (0 = désactivé pour cette classe), puis enregistrez.",
      "Dans la grille des mensualités, la colonne « Frais » montre un compteur ; cliquez pour cocher chaque frais payé par l'élève.",
      "Chaque frais payé apparaît sur le reçu et entre dans le total et le solde de l'élève.",
    ],
  },
  {
    id: "recu-paiement",
    cat: "compta",
    roles: ["admin", "direction", "comptable", "superadmin"],
    titre: "Encaisser un paiement et imprimer un reçu",
    etapes: [
      "Comptabilité → Mensualités : cochez les mois payés par l'élève.",
      "Cliquez sur l'icône reçu 🖨️ pour imprimer un reçu (avec QR de vérification).",
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
    id: "comptes-postes",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Comptes & Postes : comprendre le principe",
    etapes: [
      "Ouvrez le module « Comptes & Postes » (ancien « Gestion des Accès »).",
      "Un POSTE définit un métier (Direction, Comptabilité, Censeur…) et ses droits, module par module : invisible, 👁 lecture ou ✏️ écriture.",
      "Un COMPTE est une personne rattachée à un poste. Modifier les droits d'un poste s'applique à tous ses comptes.",
      "Le poste Direction garde toujours tous les droits (impossible de s'enfermer dehors).",
    ],
  },
  {
    id: "creer-poste",
    cat: "comptes",
    roles: ["direction", "superadmin"],
    titre: "Créer un poste sur mesure (censeur, économe…)",
    etapes: [
      "Comptes & Postes → « + Nouveau poste ».",
      "Donnez un nom au poste (ex. « Censeur des études »).",
      "Dans la matrice, cliquez chaque module pour choisir son droit : ∅ invisible → 👁 lecture → ✏️ écriture.",
      "Enregistrez le poste, puis ajoutez-lui un ou plusieurs comptes.",
    ],
  },
  {
    id: "plusieurs-comptes",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Créer plusieurs comptes pour un même poste",
    etapes: [
      "Comptes & Postes → sous le poste voulu → « + Ajouter un compte ».",
      "Saisissez le nom et l'identifiant ; le mot de passe est généré et affiché une seule fois.",
      "Vous pouvez ainsi avoir 2 comptables, 3 surveillants… chacun avec sa propre connexion.",
    ],
  },
  {
    id: "connexion-email",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Se connecter avec un e-mail (au lieu de l'identifiant)",
    etapes: [
      "Comptes & Postes → sur la ligne d'un compte → « + e-mail de connexion ».",
      "Saisissez l'adresse e-mail réelle de la personne.",
      "Elle pourra alors se connecter avec code école + e-mail + mot de passe (l'identifiant classique marche toujours).",
    ],
  },
  {
    id: "responsable-signataire",
    cat: "comptes",
    roles: ["admin", "direction", "superadmin"],
    titre: "Faire apparaître le nom du responsable sur les documents",
    etapes: [
      "Comptes & Postes → « ✏️ Droits & nom » (ou « Nom & signataire » pour la Direction).",
      "Renseignez « 🖋️ Responsable — prénom et nom ».",
      "Ce nom s'imprime sous le bloc de signature des documents (reçus pour le comptable, bulletins et attestations pour la direction…).",
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
    id: "messagerie-interne",
    cat: "communication",
    titre: "Écrire aux autres membres du personnel (messagerie interne)",
    etapes: [
      "Cliquez l'icône 💬 dans l'en-tête (en haut à droite).",
      "« ✍️ Nouveau » : choisissez le destinataire — tout le personnel, un ou plusieurs postes, ou un compte précis.",
      "Écrivez un sujet (optionnel) et votre message, puis envoyez. Le destinataire reçoit une notification.",
      "Le badge rouge indique vos messages non lus ; ils se marquent lus au clic.",
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
