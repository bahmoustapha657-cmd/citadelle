import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../apiClient";

const cleStockage = (uid) => `LC_messagesLus_${uid}`;

function lireLusLocal(uid) {
  if (!uid) return {};
  try {
    return JSON.parse(localStorage.getItem(cleStockage(uid)) || "{}");
  } catch {
    return {};
  }
}

function ecrireLusLocal(uid, lus) {
  if (!uid) return;
  try {
    localStorage.setItem(cleStockage(uid), JSON.stringify(lus));
  } catch {
    // Quota localStorage dépassé : on ignore.
  }
}

// Logique des messages SuperAdmin reçus par une école : polling /school,
// suivi des messages lus (localStorage + Firestore), bandeaux et compteurs.
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

    const chargerMessages = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await apiFetch("/school", {
          method: "GET",
          query: { op: "superadmin-messages" },
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      }
    };

    chargerMessages();
    const timer = window.setInterval(chargerMessages, 60000);

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

    try {
      await setDoc(
        doc(db, "superadmin_messages", msg._id, "lectures", uid),
        {
          schoolId,
          role,
          login: utilisateur?.login || null,
          readAt: Date.now(),
        },
      );
    } catch {
      // Pas d'accès réseau ou règles plus strictes : on garde le marquage local.
    }
  };

  const marquerToutLu = () => {
    nonLus.forEach((m) => marquerLu(m));
  };

  return {
    uid, role, lus, boiteOuverte, setBoiteOuverte, setBandeauFerme,
    messagesPourMoi, nonLus, bandeauxAffiches, marquerLu, marquerToutLu,
  };
}
