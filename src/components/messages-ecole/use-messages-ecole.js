import { useEffect, useMemo, useState } from "react";
import { lireLusLocal, ecrireLusLocal } from "./messages-storage";
import { fetchSuperadminMessages, enregistrerLecture } from "./messages-api";

// Logique des messages SuperAdmin reçus par une école : polling /school,
// suivi des messages lus (localStorage + Firestore), bandeaux et compteurs.
// La persistance locale vit dans messages-storage.js, les appels réseau
// dans messages-api.js.
export function useMessagesEcole({ utilisateur, schoolId }) {
  const uid = utilisateur?.uid;
  const role = utilisateur?.role;
  const [messages, setMessages] = useState([]);
  const [lus, setLus] = useState(() => lireLusLocal(uid));
  const [uidLus, setUidLus] = useState(uid || null);
  const [boiteOuverte, setBoiteOuverte] = useState(false);
  const [bandeauFerme, setBandeauFerme] = useState({});

  if (uidLus !== uid) {
    setUidLus(uid || null);
    setLus(lireLusLocal(uid));
  }

  useEffect(() => {
    if (!uid || !role || role === "parent") return undefined;
    let cancelled = false;

    const charger = async () => {
      const msgs = await fetchSuperadminMessages();
      if (!cancelled) setMessages(msgs);
    };

    charger();
    const timer = window.setInterval(charger, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [uid, role]);

  const messagesPourMoi = useMemo(() => {
    if (!role || !schoolId) return [];
    return messages;
  }, [messages, role, schoolId]);

  const nonLus = messagesPourMoi.filter((m) => !lus[m._id]);
  const bandeauxAffiches = messagesPourMoi
    .filter((m) => (m.niveau === "important" || m.niveau === "critique") && !lus[m._id] && !bandeauFerme[m._id])
    .slice(0, 1);

  const marquerLu = async (msg) => {
    if (!uid || !schoolId) return;
    const nouveauxLus = { ...lus, [msg._id]: Date.now() };
    setLus(nouveauxLus);
    ecrireLusLocal(uid, nouveauxLus);
    await enregistrerLecture(msg._id, { schoolId, role, login: utilisateur?.login }, uid);
  };

  const marquerToutLu = () => {
    nonLus.forEach((m) => marquerLu(m));
  };

  return {
    uid, role, lus, boiteOuverte, setBoiteOuverte, setBandeauFerme,
    messagesPourMoi, nonLus, bandeauxAffiches, marquerLu, marquerToutLu,
  };
}
