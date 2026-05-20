import { useEffect, useState } from "react";
import {
  collection, doc, getDocFromServer, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { SCHOOL_INFO_DEFAUT } from "../contexts/SchoolContext";
import { getRoleSettingsForSchool, setMonnaie } from "../constants";
import { subscribeLegalProfile } from "../legal-utils";

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
  const [verrous, setVerrous] = useState({ comptable: false, primaire: false, secondaire: false });
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
      setVerrous({ comptable: false, primaire: false, secondaire: false });
      document.documentElement.style.setProperty("--sc1", "#0A1628");
      document.documentElement.style.setProperty("--sc2", "#00C48C");
    };
    const appliquerDonneesEcole = (d) => {
      const D = SCHOOL_INFO_DEFAUT;
      setSchoolInfo({
        ...D,
        ...d,
        nom:       d.nom       || D.nom,
        type:      d.type      || D.type,
        ville:     d.ville     || D.ville,
        pays:      d.pays      || D.pays,
        couleur1:  d.couleur1  || D.couleur1,
        couleur2:  d.couleur2  || D.couleur2,
        logo:      d.logo      || D.logo,
        devise:    d.devise    || D.devise,
        monnaie:   d.monnaie   || D.monnaie,
        ministere: d.ministere || D.ministere,
        ire:       d.ire       || D.ire,
        dpe:       d.dpe       || D.dpe,
        agrement:  d.agrement  || D.agrement,
        moisDebut: d.moisDebut || D.moisDebut,
        plan:      d.plan      || "gratuit",
        planExpiry:d.planExpiry|| null,
        accueil:   d.accueil   || D.accueil,
        roleSettings: getRoleSettingsForSchool(d.roleSettings || D.roleSettings),
      });
      setMonnaie(d.monnaie || D.monnaie);
      setVerrous(d.verrous || { comptable: false, primaire: false, secondaire: false });
      const r = document.documentElement.style;
      r.setProperty("--sc1", d.couleur1 || "#0A1628");
      r.setProperty("--sc2", d.couleur2 || "#00C48C");
    };

    reinitialiserBranding();
    if (!schoolId || schoolId === "superadmin" || !schoolRef) return;

    getDocFromServer(schoolRef).then((snap) => {
      if (!actif) return;
      accepterCache = true;
      if (snap.exists()) appliquerDonneesEcole(snap.data());
      else reinitialiserBranding();
    }).catch(() => {
      if (!actif) return;
      accepterCache = true;
    });

    const unsub = onSnapshot(schoolRef, (snap) => {
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
    if (!schoolId || schoolId === "superadmin") return;
    const unsub = subscribeLegalProfile(schoolId, (legal) => {
      setSchoolInfo((prev) => ({ ...prev, legal }));
    });
    return () => unsub();
  }, [schoolId]);

  // ── Badge messages non lus ───────────────────────────────────
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    const unsub = onSnapshot(collection(db, "ecoles", schoolId, "messages"), (snap) => {
      const nonLus = snap.docs.filter((d) => d.data().expediteur === "parent" && !d.data().lu).length;
      setMsgsNonLus(nonLus);
    });
    return () => unsub();
  }, [schoolId, utilisateur]);

  // ── Comptage élèves actifs (vérification plan) ──────────────
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    const colls = ["elevesCollege", "elevesPrimaire", "elevesLycee"];
    const counts = { elevesCollege: 0, elevesPrimaire: 0, elevesLycee: 0 };
    const unsubs = colls.map((coll) =>
      onSnapshot(collection(db, "ecoles", schoolId, coll), (snap) => {
        counts[coll] = snap.docs.filter((d) => d.data().statut === "Actif").length;
        setTotalElevesActifs(Object.values(counts).reduce((a, b) => a + b, 0));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [schoolId, utilisateur]);

  // ── Centre de notifications (10 dernières actions) ──────────
  useEffect(() => {
    if (!utilisateur || !schoolId || schoolId === "superadmin") return;
    if (["enseignant", "parent"].includes(utilisateur.role)) return;
    const q = query(collection(db, "ecoles", schoolId, "historique"), orderBy("date", "desc"), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotifListe(liste);
      // Non lues = actions < 5 minutes
      const cinqMin = Date.now() - 5 * 60 * 1000;
      setNotifNonLues(liste.filter((n) => n.date > cinqMin).length);
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
