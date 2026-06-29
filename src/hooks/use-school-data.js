import { useEffect, useState } from "react";
import { doc, getDocFromServer } from "firebase/firestore";
import { db } from "../firebaseDb";
import { isSupabase } from "../backend";
import { chargerEcole } from "../backend/data-supabase";
import { SCHOOL_INFO_DEFAUT } from "../contexts/SchoolContext";
import { setMonnaie } from "../constants";
import { subscribeLegalProfile } from "../legal-utils";
import { safeOnSnapshot } from "../firestore-safe";
import { DEFAULT_VERROUS, mergeSchoolInfo, applyBrandingColors } from "./school-data-helpers";
import {
  countMessagesNonLus,
  countElevesActifs,
  subscribeNotifications,
} from "./school-data-subscriptions";

// Hook regroupant les listeners Firestore liés à l'école courante :
// - schoolInfo (doc /ecoles/{id} en privé, /ecoles_public/{id} en non auth)
//   + verrous + variables CSS de branding
// - legal profile (/ecoles/{id}/config/legal)
// - msgsNonLus (badge sidebar)
// - totalElevesActifs (toutes sections, pour vérification plan)
// - notifListe + notifNonLues (10 dernières actions de l'historique)
//
// Extrait de App.jsx au refactor découpage 2026-05-20.
export function useSchoolData({ schoolId, utilisateur }) {
  const [schoolInfoState, setSchoolInfo] = useState(SCHOOL_INFO_DEFAUT);
  const [verrous, setVerrous] = useState(DEFAULT_VERROUS);
  const [msgsNonLus, setMsgsNonLus] = useState(0);
  const [totalElevesActifs, setTotalElevesActifs] = useState(0);
  const [notifListe, setNotifListe] = useState([]);
  const [notifNonLues, setNotifNonLues] = useState(0);

  // ── schoolInfo + verrous + branding ──────────────────────────
  useEffect(() => {
    let actif = true;
    let accepterCache = false;
    const estSessionPrivee = !!utilisateur && schoolId !== "superadmin";
    const schoolRef = schoolId
      ? doc(db, estSessionPrivee ? "ecoles" : "ecoles_public", schoolId)
      : null;
    const reinitialiserBranding = () => {
      setSchoolInfo(SCHOOL_INFO_DEFAUT);
      setMonnaie(SCHOOL_INFO_DEFAUT.monnaie);
      setVerrous(DEFAULT_VERROUS);
      applyBrandingColors("#0A1628", "#00C48C");
    };
    const appliquerDonneesEcole = (d) => {
      setSchoolInfo(mergeSchoolInfo(d));
      setMonnaie(d.monnaie || SCHOOL_INFO_DEFAUT.monnaie);
      setVerrous(d.verrous || DEFAULT_VERROUS);
      applyBrandingColors(d.couleur1, d.couleur2);
    };

    reinitialiserBranding();
    if (!schoolId || schoolId === "superadmin") return;

    // ── Backend Supabase : lecture unique de l'école (pas de listener). ──
    if (isSupabase) {
      chargerEcole(schoolId).then((d) => {
        if (actif && d) appliquerDonneesEcole(d);
      }).catch(() => {});
      return () => { actif = false; };
    }

    if (!schoolRef) return;
    getDocFromServer(schoolRef).then((snap) => {
      if (!actif) return;
      accepterCache = true;
      if (snap.exists()) appliquerDonneesEcole(snap.data());
      else reinitialiserBranding();
    }).catch(() => {
      if (!actif) return;
      accepterCache = true;
    });

    const unsub = safeOnSnapshot(schoolRef, (snap) => {
      if (!actif) return;
      if (!accepterCache && snap.metadata?.fromCache) return;
      if (snap.exists()) appliquerDonneesEcole(snap.data());
      else reinitialiserBranding();
    });

    return () => {
      actif = false;
      unsub();
    };
  }, [schoolId, utilisateur]);

  // ── Profil légal officiel ────────────────────────────────────
  useEffect(() => {
    if (isSupabase) return; // non porté (Firestore) — Tranche ultérieure
    if (!schoolId || schoolId === "superadmin") return;
    const unsub = subscribeLegalProfile(schoolId, (legal) => {
      setSchoolInfo((prev) => ({ ...prev, legal }));
    });
    return () => unsub();
  }, [schoolId]);

  // ── Badge messages non lus (lecture ciblée à la demande) ─────
  useEffect(() => {
    if (isSupabase) return; // non porté (Firestore) — Tranche ultérieure
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    let actif = true;
    countMessagesNonLus(schoolId).then((n) => { if (actif) setMsgsNonLus(n); });
    return () => { actif = false; };
  }, [schoolId, utilisateur]);

  // ── Comptage élèves actifs (agrégation, vérification plan) ───
  useEffect(() => {
    if (isSupabase) return; // non porté (Firestore) — Tranche ultérieure
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    let actif = true;
    countElevesActifs(schoolId).then((n) => { if (actif) setTotalElevesActifs(n); });
    return () => { actif = false; };
  }, [schoolId, utilisateur]);

  // ── Centre de notifications (10 dernières actions) ──────────
  useEffect(() => {
    if (isSupabase) return; // non porté (Firestore) — Tranche ultérieure
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    const unsub = subscribeNotifications(schoolId, ({ liste, nonLues }) => {
      setNotifListe(liste);
      setNotifNonLues(nonLues);
    });
    return () => unsub();
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
