import { useEffect, useState } from "react";
import { chargerEcole, compterElevesActifs } from "../backend/data-supabase";
import { subscribeTable, surveillerTable } from "../backend/realtime-supabase";
import { SCHOOL_INFO_DEFAUT } from "../contexts/SchoolContext";
import { setMonnaie } from "../constants";
import { DEFAULT_VERROUS, mergeSchoolInfo, applyBrandingColors } from "./school-data-helpers";
import { suivreCompteur } from "./suivre-compteur";

// Hook des données liées à l'école courante :
// - schoolInfo (table `ecoles`, profil légal compris) + verrous + variables
//   CSS de branding
// - totalElevesActifs (toutes sections, tenu à jour, pour vérification plan)
// - msgsNonLus, notifListe/notifNonLues : compteurs de l'ancienne version
//   Firebase, pas encore portés (valeurs neutres)
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useSchoolData({ schoolId, utilisateur }) {
  const [schoolInfoState, setSchoolInfo] = useState(SCHOOL_INFO_DEFAUT);
  const [verrous, setVerrous] = useState(DEFAULT_VERROUS);
  const [msgsNonLus] = useState(0);
  // null = pas (encore) compté : computePlanInfo ne bloque rien sur un
  // effectif inconnu, et l'écran affiche « … » plutôt qu'un faux 0.
  const [totalElevesActifs, setTotalElevesActifs] = useState(null);
  const [notifListe] = useState([]);
  const [notifNonLues, setNotifNonLues] = useState(0);

  // ── schoolInfo + verrous + branding ──────────────────────────
  useEffect(() => {
    let actif = true;
    const reinitialiserBranding = () => {
      setSchoolInfo(SCHOOL_INFO_DEFAUT);
      setMonnaie(SCHOOL_INFO_DEFAUT.monnaie);
      setVerrous(DEFAULT_VERROUS);
      applyBrandingColors("#0A1628", "#00C48C");
    };
    const appliquerDonneesEcole = (d) => {
      // `code` : identifiant immuable de l'école, garanti présent dans
      // schoolInfo (schoolId EST ce code). Il sert de secret stable au
      // chiffrement des QR des documents imprimés — cf. src/reports/qr-crypto.js.
      setSchoolInfo(mergeSchoolInfo({ ...d, code: d.code || schoolId }));
      setMonnaie(d.monnaie || SCHOOL_INFO_DEFAUT.monnaie);
      setVerrous(d.verrous || DEFAULT_VERROUS);
      applyBrandingColors(d.couleur1, d.couleur2);
    };

    reinitialiserBranding();
    if (!schoolId || schoolId === "superadmin") return;

    // Lecture initiale + abonnement temps réel.
    // Les paramètres d'école changent rarement mais concernent TOUT LE MONDE :
    // année scolaire, périodicité, jours ouvrables, verrous, branding. Sans
    // abonnement, un poste gardait l'ancien réglage jusqu'au rechargement de
    // la page — le cas le plus visible étant la bascule d'année, invisible des
    // autres écrans. La table `ecoles` est publiée sans son logo (72 ko) : on
    // ignore le contenu de l'événement et on recharge la fiche.
    const recharger = (reseau = false) => chargerEcole(schoolId, { reseau }).then((d) => {
      if (actif && d) appliquerDonneesEcole(d);
    }).catch(() => {});
    // Miroir local d'abord (affichage immédiat, hors ligne compris), PUIS
    // le serveur. Le miroir d'un appareil éteint pendant la clôture porte
    // encore l'ancienne année au lancement suivant ; aucun événement temps
    // réel ne la corrigeait ensuite, et toute la session — notes du
    // portail enseignant comprises — tournait sur l'année archivée. Les
    // deux lectures s'enchaînent : la réponse serveur passe toujours après.
    recharger().then(() => recharger(true));
    // Sur événement, relecture SERVEUR : le miroir PowerSync peut ne pas
    // avoir encore reçu la modification, et le relire à cet instant
    // ré-affichait l'ancienne valeur (un agrément tout juste enregistré
    // « revenait » jusqu'au rechargement de la page).
    const desabonner = subscribeTable(schoolId, "ecoles", () => recharger(true));
    return () => { actif = false; desabonner(); };
  }, [schoolId, utilisateur]);

  // ── Élèves actifs (vérification du plan) ─────────────────────
  // Compté au montage puis RECOMPTÉ à chaque changement de la table eleves
  // (ajout, départ, réintégration…) : la limite du plan se ferme dès qu'elle
  // est atteinte et se rouvre après un départ, sans recharger.
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return undefined;
    if (["enseignant", "parent"].includes(utilisateur.role)) return undefined;
    return suivreCompteur({
      compter: () => compterElevesActifs(schoolId),
      surveiller: (signaler) => surveillerTable(schoolId, "eleves", signaler),
      onValeur: setTotalElevesActifs,
    });
  }, [schoolId, utilisateur]);

  return {
    schoolInfoState, setSchoolInfo,
    verrous, setVerrous,
    msgsNonLus,
    totalElevesActifs,
    notifListe,
    notifNonLues, setNotifNonLues,
  };
}
