import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Modale } from "../ui";
import { SelecteurComptes } from "./SelecteurComptes";
import { contactables } from "./messagerie-logic";
import { champ, puce } from "./styles-messagerie";

// Nouvelle discussion : message direct (un clic sur un nom) ou groupe nommé.
// Un parent n'a que le message direct (pas de groupe).
export function NouvelleDiscussionModal({ m, fermer, groupes = true, parent = false }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("direct");
  const [titre, setTitre] = useState("");
  const [membres, setMembres] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  // Hiérarchie : seules les personnes que l'on peut contacter sont proposées.
  const comptes = contactables(m.annuaireListe, m.moi);
  const restreint = comptes.length < m.annuaireListe.filter((c) => c.id !== m.moi).length;

  const executer = async (fn) => {
    setEnCours(true);
    setErreur("");
    try { await fn(); fermer(); } catch (e) { setErreur(e.message || t("msg.opFailed")); } finally { setEnCours(false); }
  };

  const basculer = (id) => setMembres((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Modale titre={`✍️ ${t("msg.list.newConversation")}`} fermer={fermer}>
      {groupes && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button type="button" style={{ ...puce(mode === "direct"), flex: 1, padding: "8px" }} onClick={() => setMode("direct")}>💬 {t("msg.newConv.direct")}</button>
          <button type="button" style={{ ...puce(mode === "groupe"), flex: 1, padding: "8px" }} onClick={() => setMode("groupe")}>👥 {t("msg.newConv.newGroup")}</button>
        </div>
      )}
      {erreur && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{erreur}</div>}

      {parent ? (
        <div style={{ fontSize: 12, color: "var(--lc-text-muted)", background: "var(--lc-surface-alt)", border: "1px solid var(--lc-border)", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
          🏫 {t("msg.newConv.parentHint")}
        </div>
      ) : restreint && (
        <div style={{ fontSize: 12, color: "var(--lc-text-muted)", background: "var(--lc-surface-alt)", border: "1px solid var(--lc-border)", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
          {comptes.length
            ? `🏛️ ${t("msg.newConv.hierarchyHint")}`
            : `🏛️ ${t("msg.newConv.noManagerHint")}`}
        </div>
      )}
      {mode === "direct" || !groupes ? (
        <SelecteurComptes comptes={comptes} onChoisir={(c) => !enCours && executer(() => m.ouvrirDirecteAvec(c.id))} />
      ) : (
        <>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80}
            placeholder={t("msg.newConv.groupNamePlaceholder")} style={{ ...champ, marginBottom: 10 }} />
          <SelecteurComptes comptes={comptes} selection={membres} onBasculer={basculer} hauteur={260} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <Btn disabled={enCours || !titre.trim() || !membres.length}
              onClick={() => executer(() => m.creerGroupe(titre.trim(), membres))}>
              {enCours ? t("msg.newConv.creating") : t("msg.newConv.createGroup", { count: membres.length + 1 })}
            </Btn>
          </div>
        </>
      )}
    </Modale>
  );
}
