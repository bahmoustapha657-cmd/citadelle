import { useContext, useState } from "react";
import { genererMdp } from "../../../constants";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { donneesDoublonsParents, fusionnerComptesParents } from "../../../backend/compte-parent";
import { reinitialiserMotDePasse } from "../../../backend/account-manage-supabase";
import { groupesDoublons } from "../../../doublons-parents";

// Écran Comptes & Postes → Doublons parents : analyse à la demande (lecture
// de tous les comptes parents et de leurs liens), choix du compte conservé,
// fusion confirmée par la Direction, puis — si le parent ne connaît pas le
// mot de passe du compte conservé — réinitialisation de celui-ci.
export function useDoublonsParents({ schoolId, toast }) {
  const { logAction } = useContext(SchoolContext);
  const [groupes, setGroupes] = useState(null); // null : pas encore analysé
  const [chargement, setChargement] = useState(false);
  const [cibles, setCibles] = useState({}); // clé du groupe → compte conservé choisi
  const [masques, setMasques] = useState([]); // groupes écartés pour cette session
  const [enCours, setEnCours] = useState(null); // clé du groupe en cours
  const [faits, setFaits] = useState({}); // clé → résultat de la fusion

  const analyser = async () => {
    setChargement(true);
    try {
      const { comptes, liens } = await donneesDoublonsParents();
      setGroupes(groupesDoublons(comptes, liens));
      setCibles({});
      setFaits({});
    } catch (e) {
      toast("Doublons parents : " + e.message, "error");
    } finally {
      setChargement(false);
    }
  };

  const cibleDe = (g) => cibles[g.cle] || g.cibleId;
  const choisirCible = (g, id) => setCibles((c) => ({ ...c, [g.cle]: id }));
  const masquer = (g) => setMasques((m) => [...m, g.cle]);

  const fusionner = async (g) => {
    if (enCours) return;
    const cible = g.comptes.find((c) => c.id === cibleDe(g));
    const autres = g.comptes.filter((c) => c.id !== cible.id);
    const liste = autres.map((c) => `« ${c.login} »`).join(", ");
    const message = [
      `Fusionner dans « ${cible.login} » ?`,
      "",
      `• Les enfants de ${liste} passeront sur « ${cible.login} ».`,
      `• ${autres.length > 1 ? "Ces comptes seront désactivés" : "Ce compte sera désactivé"} : le parent se connectera avec « ${cible.login} » et son mot de passe.`,
      ...(g.verdict === "a_verifier" ? ["", "⚠️ Les noms diffèrent : vérifiez qu'il s'agit bien du même parent."] : []),
    ].join("\n");
    if (!confirm(message)) return;
    setEnCours(g.cle);
    try {
      const r = await fusionnerComptesParents({ schoolId, cibleId: cible.id, sourceIds: autres.map((c) => c.id) });
      const absorbes = r.absorbes || autres.map((c) => c.login);
      setFaits((f) => ({ ...f, [g.cle]: {
        cibleId: cible.id, login: r.login || cible.login, absorbes,
        liensDeplaces: r.liensDeplaces || 0,
      } }));
      toast(`Fusion faite : ${absorbes.join(", ")} → « ${r.login || cible.login} ».`, "success");
      logAction("Fusion comptes parents", `Conserve: ${r.login || cible.login} - Absorbes: ${absorbes.join(", ")}`);
    } catch (e) {
      toast("Fusion : " + (e?.message || e), "error");
    } finally {
      setEnCours(null);
    }
  };

  // Le parent se servait peut-être d'un compte absorbé : nouveau mot de passe
  // pour le compte conservé, à lui remettre (à changer à la connexion).
  const reinitialiser = async (g) => {
    const fait = faits[g.cle];
    if (enCours || !fait) return;
    const mdp = genererMdp();
    setEnCours(g.cle);
    try {
      await reinitialiserMotDePasse({ schoolId, accountId: fait.cibleId, mdp });
      setFaits((f) => ({ ...f, [g.cle]: { ...f[g.cle], nouveauMdp: mdp } }));
      logAction("Mot de passe reinitialise", `Login: ${fait.login} (apres fusion)`);
    } catch (e) {
      toast("Réinitialisation : " + (e?.message || e), "error");
    } finally {
      setEnCours(null);
    }
  };

  const visibles = (groupes || []).filter((g) => !masques.includes(g.cle));
  return { groupes, visibles, chargement, analyser, cibleDe, choisirCible, masquer, fusionner, reinitialiser, enCours, faits };
}
