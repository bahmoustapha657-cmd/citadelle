import { useEffect, useState } from "react";
import { chargerEcole, compterElevesActifs } from "../backend/data-supabase";
import { subscribeTable } from "../backend/realtime-supabase";
import { SCHOOL_INFO_DEFAUT } from "../contexts/SchoolContext";
import { setMonnaie } from "../constants";
import { DEFAULT_VERROUS, mergeSchoolInfo, applyBrandingColors } from "./school-data-helpers";

// Données de l'école courante :
// - schoolInfo (fiche `ecoles`, profil légal compris) + verrous + branding
// - totalElevesActifs (toutes sections, pour la vérification du plan)
//
// Trois éléments ont disparu avec la liquidation Firebase (lot 5), tous
// court-circuités en production depuis la migration — ils partaient par
// `if (isSupabase) return` et ne faisaient donc plus rien :
//   • le badge des messages parents non lus (compteur toujours à 0) ;
//   • le centre de notifications (les 10 dernières actions) ;
//   • l'abonnement au profil légal, désormais inutile : il arrive avec la
//     fiche école, déjà en temps réel.
// Les deux premiers sont à REPORTER sur Supabase si le besoin est confirmé.
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useSchoolData({ schoolId, utilisateur }) {
  const [schoolInfoState, setSchoolInfo] = useState(SCHOOL_INFO_DEFAUT);
  const [verrous, setVerrous] = useState(DEFAULT_VERROUS);
  const [totalElevesActifs, setTotalElevesActifs] = useState(0);
  // Badge messages et centre de notifications : valeurs neutres, en attendant
  // leur portage sur Supabase. L'interface les consomme déjà ; elle affichait
  // exactement ces valeurs-là en production, faute d'alimentation.
  const msgsNonLus = 0;
  const notifListe = [];
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
      // schoolInfo (Supabase le renvoie ; côté Firestore le document ne le
      // porte pas, mais schoolId EST ce code). Il sert de secret stable au
      // chiffrement des QR des documents imprimés — cf. src/reports/qr-crypto.js.
      setSchoolInfo(mergeSchoolInfo({ ...d, code: d.code || schoolId }));
      setMonnaie(d.monnaie || SCHOOL_INFO_DEFAUT.monnaie);
      setVerrous(d.verrous || DEFAULT_VERROUS);
      applyBrandingColors(d.couleur1, d.couleur2);
    };

    reinitialiserBranding();
    if (!schoolId || schoolId === "superadmin") return;

    // Lecture initiale + abonnement temps réel. Les paramètres d'école changent
    // rarement mais concernent TOUT LE MONDE : année scolaire, périodicité,
    // jours ouvrables, verrous, branding, profil légal. Sans abonnement, un
    // poste gardait l'ancien réglage jusqu'au rechargement de la page — le cas
    // le plus visible étant la bascule d'année, invisible des autres écrans.
    // La table `ecoles` est publiée sans son logo (72 ko) : on ignore le
    // contenu de l'événement et on recharge la fiche.
    const recharger = () => {
      chargerEcole(schoolId).then((d) => {
        if (actif && d) appliquerDonneesEcole(d);
      }).catch(() => {});
    };
    recharger();
    const desabonner = subscribeTable(schoolId, "ecoles", recharger);
    return () => { actif = false; desabonner(); };
  }, [schoolId, utilisateur]);

  // ── Effectif actif (vérification du plan) ────────────────────
  // Ce nombre s'affiche à l'écran (« X/40 élèves ») et autorise ou non un
  // nouvel enrôlement. Il restait bloqué à 0 en production : la limite du plan
  // gratuit ne s'appliquait donc jamais, et le compteur affichait un effectif
  // nul à des écoles qui comptaient des centaines d'élèves.
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return undefined;
    if (["enseignant", "parent"].includes(utilisateur.role)) return undefined;
    let actif = true;
    compterElevesActifs(schoolId).then((n) => { if (actif) setTotalElevesActifs(n); });
    return () => { actif = false; };
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
