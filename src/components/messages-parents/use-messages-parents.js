import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { C } from "../../constants";

// Logique de la liaison École–Famille : regroupement des messages en
// conversations, lecture/réponse et publication d'annonces.
export function useMessagesParents() {
  const { schoolInfo, toast, envoyerPush } = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1 || C.blue;
  const { items: msgs, modifier: modMsg, ajouter: repMsg } = useFirestore("messages");
  const { items: annonces, ajouter: ajAnn, supprimer: supAnn } = useFirestore("annonces");
  const [tab, setTab] = useState("messages");
  const [selMsg, setSelMsg] = useState(null);
  const [reponse, setRep] = useState("");
  const [formAnn, setFormAnn] = useState({ titre: "", corps: "", important: false });
  const [modal, setModal] = useState(null);

  const threads = Object.values(
    msgs.reduce((acc, m) => {
      const key = m.eleveId || m.eleveNom || m.expediteurLogin;
      if (!acc[key]) acc[key] = { key, eleveNom: m.eleveNom, expediteurLogin: m.expediteurLogin, messages: [], nonLus: 0 };
      acc[key].messages.push(m);
      if (m.expediteur === "parent" && !m.lu) acc[key].nonLus++;
      return acc;
    }, {}),
  ).sort((a, b) => Math.max(...b.messages.map((m) => m.date)) - Math.max(...a.messages.map((m) => m.date)));

  const threadSelec = selMsg ? threads.find((t) => t.key === selMsg) : null;

  const marquerLus = async (thread) => {
    for (const m of thread.messages) {
      if (m.expediteur === "parent" && !m.lu) await modMsg({ ...m, lu: true });
    }
  };

  const envoyerReponse = async () => {
    if (!reponse.trim() || !threadSelec) return;
    await repMsg({
      expediteur: "ecole",
      expediteurNom: "École",
      eleveId: threadSelec.messages[0]?.eleveId,
      eleveNom: threadSelec.eleveNom,
      destinataireLogin: threadSelec.expediteurLogin,
      sujet: "Réponse : " + (threadSelec.messages[0]?.sujet || ""),
      corps: reponse.trim(),
      lu: false,
      date: Date.now(),
    });
    // Notifier le parent par push
    envoyerPush(
      ["parent"],
      `📩 Message de ${schoolInfo.nom || "l'école"}`,
      `Concernant ${threadSelec.eleveNom} : ${reponse.trim().slice(0, 80)}${reponse.length > 80 ? "…" : ""}`,
      "/messages",
    );
    setRep("");
  };

  const publierAnnonce = () => {
    if (!formAnn.titre.trim() || !formAnn.corps.trim()) { toast("Titre et contenu requis.", "warning"); return; }
    ajAnn({ ...formAnn, auteur: schoolInfo.nom || "École", date: Date.now() });
    setFormAnn({ titre: "", corps: "", important: false });
    setModal(null);
  };

  return {
    c1, tab, setTab, threads, threadSelec, selMsg, setSelMsg,
    reponse, setRep, marquerLus, envoyerReponse,
    annonces, supAnn, formAnn, setFormAnn, modal, setModal, publierAnnonce,
  };
}
