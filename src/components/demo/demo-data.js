// Données fictives de la démo publique EduGest.
// Extraites de DemoEduGest.jsx (découpage 2026-05-29).

export const kpis = [
  { label: "Élèves actifs", value: "842", sub: "Primaire, collège et lycée" },
  { label: "Paiements du mois", value: "178,5 M GNF", sub: "Encaissés en mai" },
  { label: "Salaires prêts", value: "46", sub: "Fiches générées" },
  { label: "Messages parents", value: "19", sub: "Annonces & rappels" },
  { label: "Taux de présence", value: "94,2 %", sub: "Moyenne école" },
  { label: "Bulletins prêts", value: "812", sub: "2e trimestre" },
];

export const repartitionSections = [
  { name: "Primaire", value: 320, color: "#00C48C" },
  { name: "Collège", value: 358, color: "#0A1628" },
  { name: "Lycée", value: 164, color: "#f59e0b" },
];

export const evolPaiements = [
  { mois: "Oct", revenus: 142, depenses: 98 },
  { mois: "Nov", revenus: 156, depenses: 102 },
  { mois: "Déc", revenus: 168, depenses: 115 },
  { mois: "Jan", revenus: 172, depenses: 108 },
  { mois: "Fév", revenus: 165, depenses: 112 },
  { mois: "Mar", revenus: 180, depenses: 118 },
  { mois: "Avr", revenus: 175, depenses: 110 },
  { mois: "Mai", revenus: 178, depenses: 105 },
];

export const paiements = [
  { eleve: "Aïssatou Diallo",  classe: "6e A",   montant: "450 000 GNF", statut: "À jour" },
  { eleve: "Mamadou Bah",       classe: "CM2",    montant: "320 000 GNF", statut: "Partiel" },
  { eleve: "Mariama Barry",     classe: "2nde S", montant: "600 000 GNF", statut: "À jour" },
  { eleve: "Ibrahima Condé",    classe: "4e B",   montant: "450 000 GNF", statut: "À jour" },
  { eleve: "Fatou Camara",      classe: "Tle A",  montant: "650 000 GNF", statut: "À jour" },
  { eleve: "Sékou Touré",       classe: "CM1",    montant: "320 000 GNF", statut: "Impayé" },
  { eleve: "Kadiatou Sylla",    classe: "3e A",   montant: "500 000 GNF", statut: "À jour" },
  { eleve: "Aminata Bangoura",  classe: "CP",     montant: "280 000 GNF", statut: "Partiel" },
  { eleve: "Mohamed Soumah",    classe: "1ere D", montant: "600 000 GNF", statut: "À jour" },
  { eleve: "Hadja Keita",       classe: "5e A",   montant: "450 000 GNF", statut: "À jour" },
];

export const notes = [
  { eleve: "Fatou Camara",    matiere: "Mathématiques", moyenne: 15.33, rang: 5,  effectif: 32 },
  { eleve: "Ibrahima Condé",  matiere: "SVT",           moyenne: 13.67, rang: 9,  effectif: 28 },
  { eleve: "Kadiatou Sylla",  matiere: "Français",      moyenne: 16.00, rang: 3,  effectif: 30 },
  { eleve: "Mariama Barry",   matiere: "Physique",      moyenne: 14.25, rang: 7,  effectif: 26 },
  { eleve: "Mohamed Soumah",  matiere: "Anglais",       moyenne: 17.50, rang: 1,  effectif: 24 },
  { eleve: "Aïssatou Diallo", matiere: "Histoire-Géo",  moyenne: 12.90, rang: 14, effectif: 32 },
  { eleve: "Sékou Touré",     matiere: "Mathématiques", moyenne: 11.20, rang: 18, effectif: 30 },
  { eleve: "Hadja Keita",     matiere: "Philosophie",   moyenne: 15.80, rang: 4,  effectif: 22 },
];

export const salaires = [
  { nom: "M. Touré",       role: "Enseignant collège",     montant: "2 450 000", bon: "300 000", net: "2 150 000" },
  { nom: "Mme Diallo",     role: "Titulaire CM2",           montant: "1 800 000", bon: "0",       net: "1 800 000" },
  { nom: "M. Barry",       role: "Surveillant général",     montant: "1 250 000", bon: "150 000", net: "1 100 000" },
  { nom: "Mme Camara",     role: "Titulaire CP",             montant: "1 600 000", bon: "0",       net: "1 600 000" },
  { nom: "M. Bangoura",    role: "Enseignant lycée",         montant: "2 800 000", bon: "200 000", net: "2 600 000" },
  { nom: "Mme Soumah",     role: "Comptable",                montant: "1 900 000", bon: "0",       net: "1 900 000" },
  { nom: "M. Sylla",       role: "Enseignant philo (Tle)",   montant: "2 100 000", bon: "100 000", net: "2 000 000" },
  { nom: "Mme Keita",      role: "Bibliothécaire",            montant: "950 000",   bon: "0",       net: "950 000"   },
];

export const edt = [
  { jour: "Lundi",    creneau: "08h-10h", classe: "6e A",   matiere: "Mathématiques", prof: "M. Touré" },
  { jour: "Lundi",    creneau: "10h-12h", classe: "4e B",   matiere: "SVT",            prof: "Mme Diallo" },
  { jour: "Mardi",    creneau: "08h-09h", classe: "2nde S", matiere: "Physique",       prof: "M. Bangoura" },
  { jour: "Mardi",    creneau: "10h-12h", classe: "Tle A",  matiere: "Philosophie",    prof: "M. Sylla" },
  { jour: "Mercredi", creneau: "08h-10h", classe: "5e A",   matiere: "Français",       prof: "Mme Camara" },
  { jour: "Jeudi",    creneau: "14h-16h", classe: "1ere D", matiere: "Anglais",        prof: "Mme Soumah" },
  { jour: "Vendredi", creneau: "08h-10h", classe: "3e A",   matiere: "Histoire-Géo",   prof: "M. Touré" },
];

export const discipline = [
  { date: "2026-05-12", eleve: "Sékou Touré",     classe: "CM1",   type: "Absence",  motif: "Maladie",                  statut: "Justifiée" },
  { date: "2026-05-10", eleve: "Mamadou Bah",     classe: "CM2",   type: "Retard",   motif: "Transport",                statut: "Justifiée" },
  { date: "2026-05-08", eleve: "Ibrahima Condé",  classe: "4e B",  type: "Sanction", motif: "Indiscipline en classe",   statut: "Avertissement" },
  { date: "2026-05-05", eleve: "Aïssatou Diallo", classe: "6e A",  type: "Absence",  motif: "Non précisé",              statut: "Non justifiée" },
  { date: "2026-05-03", eleve: "Fatou Camara",    classe: "Tle A", type: "Retard",   motif: "Embouteillage",            statut: "Justifiée" },
];

export const parentFeed = [
  { titre: "Bulletin disponible", detail: "Le bulletin du 2e trimestre est prêt dans le portail parent." },
  { titre: "Rappel de paiement", detail: "Le solde du mois de mai peut être régularisé en caisse." },
  { titre: "Annonce école", detail: "Composition blanche prévue la semaine prochaine pour les classes d'examen." },
  { titre: "Convocation réunion", detail: "Réunion parents-professeurs samedi 24 mai à 9h, salle polyvalente." },
];

// Bulletin mock pour aperçu modal
export const bulletinDemo = {
  eleve: { nom: "Camara", prenom: "Fatou", matricule: "EDG-2024-0142", classe: "Terminale A", dateNaissance: "2007-03-14" },
  periode: "2e trimestre",
  annee: "2025-2026",
  ecole: "Groupe scolaire Djoma Démo",
  matieres: [
    { nom: "Mathématiques",   coef: 4, devoirs: 15.5, compo: 16.0, moyenne: 15.83, appreciation: "Très bon trimestre" },
    { nom: "Physique-Chimie", coef: 4, devoirs: 14.0, compo: 13.5, moyenne: 13.67, appreciation: "Travail régulier" },
    { nom: "SVT",             coef: 3, devoirs: 16.0, compo: 17.0, moyenne: 16.67, appreciation: "Excellent" },
    { nom: "Français",        coef: 3, devoirs: 14.5, compo: 15.0, moyenne: 14.83, appreciation: "Bien" },
    { nom: "Anglais",         coef: 2, devoirs: 17.0, compo: 17.5, moyenne: 17.33, appreciation: "Remarquable" },
    { nom: "Histoire-Géo",    coef: 3, devoirs: 13.0, compo: 12.5, moyenne: 12.67, appreciation: "Peut mieux faire" },
    { nom: "Philosophie",     coef: 4, devoirs: 15.0, compo: 15.5, moyenne: 15.33, appreciation: "Bonne réflexion" },
  ],
};

export const tabs = [
  { id: "direction",  label: "📊 Direction" },
  { id: "notes",      label: "📝 Notes" },
  { id: "edt",        label: "🗓️ Emploi du temps" },
  { id: "discipline", label: "⚠️ Discipline" },
  { id: "compta",     label: "💰 Comptabilité" },
  { id: "enseignant", label: "👨‍🏫 Enseignant" },
  { id: "parents",    label: "👨‍👩‍👧 Parents" },
];
