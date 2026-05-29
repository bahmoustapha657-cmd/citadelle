import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebaseDb";
import { safeOnSnapshot } from "../../firestore-safe";
import { PLANS } from "../../constants";

// Logique du module Communications superadmin : flux Firestore des messages,
// calcul des statistiques de lecture, état du formulaire et envoi/suppression.
export function useCommunicationsAdmin({ ecoles, auteur }) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [niveau, setNiveau] = useState("info");
  const [modeCible, setModeCible] = useState("toutes"); // toutes | plan | selection
  const [planChoisi, setPlanChoisi] = useState("gratuit");
  const [schoolsChoisies, setSchoolsChoisies] = useState([]);
  const [rolesChoisis, setRolesChoisis] = useState(["direction", "admin"]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [messages, setMessages] = useState([]);
  const [statsLectures, setStatsLectures] = useState({});

  useEffect(() => {
    const q = query(collection(db, "superadmin_messages"), orderBy("createdAt", "desc"));
    const unsub = safeOnSnapshot(q, (snap) => {
      const liste = snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
      setMessages(liste);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    let annule = false;
    (async () => {
      const stats = {};
      await Promise.all(
        messages.map(async (m) => {
          try {
            const lectSnap = await getDocs(
              collection(db, "superadmin_messages", m._id, "lectures"),
            );
            const ecolesUniques = new Set();
            lectSnap.docs.forEach((d) => {
              const data = d.data();
              if (data?.schoolId) ecolesUniques.add(data.schoolId);
            });
            stats[m._id] = { lectures: lectSnap.size, ecoles: ecolesUniques.size };
          } catch {
            stats[m._id] = { lectures: 0, ecoles: 0 };
          }
        }),
      );
      if (!annule) setStatsLectures(stats);
    })();
    return () => {
      annule = true;
    };
  }, [messages]);

  const ecolesParPlan = useMemo(() => {
    const map = {};
    ecoles.forEach((e) => {
      const plan = e.plan || "gratuit";
      map[plan] = (map[plan] || 0) + 1;
    });
    return map;
  }, [ecoles]);

  const toggleRole = (id) => {
    setRolesChoisis((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const toggleSchool = (id) => {
    setSchoolsChoisies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const reinitFormulaire = () => {
    setTitre("");
    setCorps("");
    setNiveau("info");
    setModeCible("toutes");
    setSchoolsChoisies([]);
    setRolesChoisis(["direction", "admin"]);
  };

  const construireCibleSchools = () => {
    if (modeCible === "toutes") return ["*"];
    if (modeCible === "plan") {
      return ecoles.filter((e) => (e.plan || "gratuit") === planChoisi).map((e) => e._id);
    }
    return schoolsChoisies;
  };

  const envoyer = async () => {
    setErreur("");
    if (!titre.trim() || titre.trim().length < 3) {
      setErreur("Le titre doit faire au moins 3 caractères.");
      return;
    }
    if (!corps.trim() || corps.trim().length < 5) {
      setErreur("Le message doit faire au moins 5 caractères.");
      return;
    }
    if (rolesChoisis.length === 0) {
      setErreur("Choisissez au moins un rôle ciblé.");
      return;
    }
    const cibleSchools = construireCibleSchools();
    if (cibleSchools.length === 0) {
      setErreur("Aucune école ne correspond à la cible.");
      return;
    }
    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "superadmin_messages"), {
        titre: titre.trim(),
        corps: corps.trim(),
        niveau,
        cibleSchools,
        cibleRoles: rolesChoisis,
        auteur,
        createdAt: Date.now(),
      });
      setSucces(`Message envoyé à ${cibleSchools[0] === "*" ? "toutes les écoles" : `${cibleSchools.length} école${cibleSchools.length > 1 ? "s" : ""}`}.`);
      reinitFormulaire();
      setTimeout(() => setSucces(""), 4000);
    } catch (e) {
      setErreur(`Échec de l'envoi : ${e?.message || "erreur inconnue"}.`);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const supprimerMessage = async (id) => {
    if (!confirm("Supprimer ce message ? Les destinataires ne le verront plus.")) return;
    try {
      await deleteDoc(doc(db, "superadmin_messages", id));
    } catch (e) {
      alert(`Suppression impossible : ${e?.message || "erreur"}`);
    }
  };

  const previewCible =
    modeCible === "toutes"
      ? `Toutes les écoles (${ecoles.length})`
      : modeCible === "plan"
        ? `Plan ${PLANS[planChoisi]?.label || planChoisi} — ${ecolesParPlan[planChoisi] || 0} école(s)`
        : `${schoolsChoisies.length} école(s) sélectionnée(s)`;

  return {
    titre, setTitre, corps, setCorps, niveau, setNiveau,
    modeCible, setModeCible, planChoisi, setPlanChoisi,
    schoolsChoisies, rolesChoisis,
    envoiEnCours, erreur, succes, messages, statsLectures,
    ecolesParPlan, toggleRole, toggleSchool,
    envoyer, supprimerMessage, previewCible,
  };
}
