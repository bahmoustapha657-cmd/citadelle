// ══════════════════════════════════════════════════════════════
//  Attestation de niveau — Certificat de niveau au primaire
// ══════════════════════════════════════════════════════════════
// Document remis à l'élève et présenté À L'EXTÉRIEUR de l'école (autre
// établissement, administration, concours). D'où : un numéro de pièce, un QR
// de vérification comme les bulletins et reçus, et une formule administrative
// en une seule phrase continue. Au primaire, la même pièce s'intitule
// « Certificat de niveau » (titre, numéro CN-…, type du QR).
//
// Deux modèles, au choix de l'école au moment d'imprimer (onglet
// Attestations) : « Diplôme » (attestation/gabarit-diplome.js, le style du
// bulletin Prestige) et « Sobre » (attestation/gabarit-sobre.js, la mise en
// page d'origine). Ce fichier rassemble ce que la pièce CERTIFIE ; les
// gabarits ne font que la mise en page.

import { estSorti, getAnnee } from "../constants.js";
import { tr } from "./print-helpers.js";
import { signatairesDocument } from "./signatures.js";
import { qrPayload, qrSecuriseImgHtml } from "./qr.js";
import { formatMoyenneAnnuelle, getResultatsAttestation } from "./attestation/attestation-moyenne.js";
import { anneeAttesteePour, derniereClasseDeLEleve, formatDerniereClasse } from "./attestation/derniere-classe.js";
import { gabaritDiplome } from "./attestation/gabarit-diplome.js";
import { gabaritSobre } from "./attestation/gabarit-sobre.js";

// Modèles proposés, le premier par défaut.
export const MODELES_ATTESTATION = ["diplome", "sobre"];
const GABARITS = { diplome: gabaritDiplome, sobre: gabaritSobre };

// Au primaire, l'attestation de niveau s'appelle « Certificat de niveau ».
// La maternelle garde l'attestation.
export const estCertificatDeNiveau = (niveau) => niveau === "primaire";

// Numéro de pièce, même forme que le bulletin (BUL-…) : déterministe, donc
// deux impressions de la même attestation portent le même numéro.
// `prefixe` : ATT (attestation) ou CN (certificat de niveau).
export const numeroAttestation = (eleve, schoolInfo, annee, prefixe = "ATT") => {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const ref = eleve.matricule || String(eleve._id || "").slice(-6).toUpperCase();
  return `${prefixe}-${code}-${an}-${ref}`;
};

// Les dates de l'application viennent d'un <input type="date"> : elles sont
// stockées en ISO (2025-09-12). Sur une pièce administrative on écrit
// 12/09/2025. Toute valeur qui n'est pas de l'ISO est rendue telle quelle
// (saisies anciennes, imports Excel déjà au format local).
const dateFr = (valeur) => {
  const v = String(valeur ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : v;
};

// `options` : { notes, notesPrecedentes, matieres, matieresForClasse, periodes,
// maxNote, eleves, modele } — fournis par l'onglet Attestations. Absents
// (appel historique), les résultats sont simplement omis du document.
// `modele` : "diplome" (défaut) ou "sobre".
export const imprimerAttestation = async (eleve, niveau, annee, schoolInfo = {}, options = {}) => {
  const {
    notes = [], notesPrecedentes = [], matieres = [], matieresForClasse = null, periodes = [], maxNote = 20, eleves = null,
    modele = MODELES_ATTESTATION[0],
  } = options;
  // Couleurs de l'école (Paramètres → Identité), même repli que les bulletins,
  // le livret et les cartes : le document appartient à l'ÉCOLE, pas à EduGest.
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const certificat = estCertificatDeNiveau(niveau);
  const titre = tr(certificat ? "reports.attestation.titleCertificate" : "reports.attestation.title");
  const anneeScolaire = annee || getAnnee();
  const arrivee = dateFr(eleve.dateArrivee);
  const depart = dateFr(eleve.dateDepart);

  // Année scolaire que le document CERTIFIE — distincte de celle de l'écran.
  // Un élève parti en février 2026 dont on réimprime l'attestation en
  // 2026-2027 relève de 2025-2026 : c'est cette année-là qui doit figurer au
  // numéro de pièce et dans le QR, sans quoi la pièce se référence sous une
  // année où l'élève n'était plus là. Sans date de départ exploitable, on n'a
  // rien de mieux que l'année de l'écran.
  const anneeAttestee = anneeAttesteePour(eleve, anneeScolaire);
  const numero = numeroAttestation(eleve, schoolInfo, anneeAttestee, certificat ? "CN" : "ATT");
  // La classe imprimée est la DERNIÈRE CLASSE SUIVIE, celle de la dernière
  // année achevée : 8ème pour un élève de 9ème en 2026-2027, 9ème (2025-2026)
  // pour un élève promu en 10ème puis parti en 2026-2027.
  const derniere = derniereClasseDeLEleve(eleve, anneeScolaire, { moisDebut: schoolInfo.moisDebut });
  const derniereClasse = formatDerniereClasse(derniere);

  // Résultats de CETTE année-là (moyenne de chaque période + annuelle) ;
  // `resultats.annee` dit toujours à quelle année les chiffres se rapportent.
  const resultats = getResultatsAttestation({
    eleve, matieres, matieresForClasse, periodes, niveau, annee: anneeScolaire, anneeEnCours: anneeAttestee,
    derniere, notes, notesPrecedentes, eleves,
  });
  const moyenneTexte = formatMoyenneAnnuelle(resultats?.annuelle ?? null, maxNote);
  // Ce que le document CERTIFIE exactement.
  //
  // Pour un élève parti, l'année scolaire en cours est un contresens : celui
  // qui est arrivé en septembre 2025 et parti en février 2026 n'a jamais été
  // inscrit en 2026-2027, année de l'écran d'où l'on imprime. On atteste donc
  // la PÉRIODE réellement passée dans l'établissement, et l'année scolaire ne
  // sert plus que lorsqu'on ignore ces dates.
  //
  // Le passé se déclenche sur un statut de sortie autant que sur une date :
  // la date de départ est facultative, un élève « Transféré » sans date reste
  // un élève parti et ne peut pas être certifié inscrit aujourd'hui.
  // `fort` met en évidence ce que le document certifie — la période ou l'année.
  const fort = (v) => `<strong>${v}</strong>`;
  const formuleEnrolement = (() => {
    if (!estSorti(eleve)) {
      // Élève présent : la date d'arrivée devient une ancienneté, ce qui fait
      // de l'attestation une preuve de scolarité CONTINUE et non plus du seul
      // millésime en cours.
      return arrivee
        ? tr("reports.attestation.enrolledSince", { du: fort(arrivee), annee: fort(anneeScolaire) })
        : tr("reports.attestation.enrolled", { annee: fort(anneeScolaire) });
    }
    if (arrivee && depart) return tr("reports.attestation.enrolledFromTo", { du: fort(arrivee), au: fort(depart) });
    if (depart) return tr("reports.attestation.enrolledUntil", { au: fort(depart) });
    return tr("reports.attestation.enrolledPast", { annee: fort(anneeAttestee) });
  })();

  // Qui atteste. La formule d'ouverture nomme le signataire et son VRAI poste
  // — « Djiba Oury Diallo, La Principale » — au lieu du « Directeur » générique :
  // c'est le signataire principal de la matrice des signatures, le même que le
  // bloc en bas de page, les deux ne peuvent donc pas se contredire. Sans
  // responsable désigné, on retombe sur le titre générique, sans nom.
  const [signataire, visa] = signatairesDocument(schoolInfo, "attestation", { section: niveau });
  const formuleCertifie = signataire.nom
    ? tr("reports.attestation.certifiesNamed", { nom: signataire.nom, poste: signataire.titre })
    : tr("reports.attestation.certifies", { poste: signataire.titre });

  // Fenêtre ouverte AVANT l'await du QR (geste utilisateur) : sinon le
  // navigateur classe l'ouverture comme popup et la bloque.
  const w = window.open("", "_blank");
  if (!w) return;

  // QR chiffré : même scanner que les bulletins et les reçus. Il porte ce que
  // l'on peut contester sur le papier — identité, classe, année, moyenne, et
  // la période de scolarité quand elle est renseignée (qrPayload ignore les
  // champs vides, le QR ne s'alourdit donc pas pour rien).
  const qr = await qrSecuriseImgHtml(qrPayload({
    EduGest: certificat ? "Certificat de niveau" : "Attestation",
    Num: numero,
    Eleve: `${eleve.nom || ""} ${eleve.prenom || ""}`,
    IEN: eleve.ien,
    DerniereClasse: derniereClasse,
    Annee: anneeAttestee,
    Moy: moyenneTexte,
    Du: arrivee,
    Au: depart,
  }), schoolInfo, { size: 100, alt: "QR attestation" });

  const gabarit = GABARITS[modele] || GABARITS[MODELES_ATTESTATION[0]];
  w.document.write(gabarit({
    eleve, niveau, schoolInfo, c1, c2, titre, certificat, numero,
    naissance: dateFr(eleve.dateNaissance), arrivee, depart, derniereClasse, resultats, maxNote,
    formuleCertifie, formuleEnrolement, signataire, visa, qr,
  }));
  w.document.close();
};
