import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../backend/messagerie-supabase";
import { Btn, Modale } from "../ui";
import { Avatar } from "./Avatar";
import { SelecteurComptes } from "./SelecteurComptes";
import { contactables } from "./messagerie-logic";
import { champ } from "./styles-messagerie";

const petitBouton = {
  background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 8,
  padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "var(--lc-text)",
};

// Membres et réglages d'un groupe : renommer, ajouter, retirer, nommer
// administrateur, quitter. Les droits sont vérifiés par la base.
export function GroupeModal({ m, conv, fermer }) {
  const { t } = useTranslation();
  const [titre, setTitre] = useState(conv.titre || "");
  const [ajout, setAjout] = useState(null); // null | [ids]
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const admin = !!conv.admin;
  const nom = (id) => m.annuaire.get(id)?.nom || t("msg.removedAccount");

  const executer = async (fn, { fermerApres = false } = {}) => {
    setEnCours(true);
    setErreur("");
    try {
      await m.actionGroupe(fn);
      if (fermerApres) fermer();
    } catch (e) { setErreur(e.message || t("msg.opFailed")); } finally { setEnCours(false); }
  };

  const quitter = () => {
    if (!window.confirm(t("msg.group.leaveConfirm", { name: conv.titre }))) return;
    executer(async () => { await api.retirerMembre(conv.id, m.moi); m.ouvrirConversation(null); }, { fermerApres: true });
  };

  return (
    <Modale titre={`👥 ${conv.titre || t("msg.group.group")}`} fermer={fermer}>
      {erreur && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{erreur}</div>}

      {admin && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80} style={champ} />
          <Btn sm disabled={enCours || !titre.trim() || titre.trim() === conv.titre}
            onClick={() => executer(() => api.renommerGroupe(conv.id, titre.trim()))}>{t("msg.group.rename")}</Btn>
        </div>
      )}

      {ajout ? (
        <>
          <SelecteurComptes comptes={contactables(m.annuaireListe, m.moi)} exclus={(conv.membres || []).map((x) => x.id)}
            selection={ajout} onBasculer={(id) => setAjout((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))} hauteur={260} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn sm v="ghost" onClick={() => setAjout(null)}>{t("common.cancel")}</Btn>
            <Btn sm disabled={enCours || !ajout.length}
              onClick={() => executer(async () => { await api.ajouterMembres(conv.id, ajout); setAjout(null); })}>
              {t("msg.group.addCount", { count: ajout.length })}
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 13, color: "var(--lc-text-brand)", flex: 1 }}>{t("msg.group.members", { count: (conv.membres || []).length })}</strong>
            {admin && <Btn sm v="ghost" onClick={() => setAjout([])}>➕ {t("common.add")}</Btn>}
          </div>
          <div style={{ border: "1px solid var(--lc-border)", borderRadius: 10, maxHeight: 320, overflowY: "auto" }}>
            {(conv.membres || []).map((membre) => (
              <div key={membre.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid var(--lc-border-soft)" }}>
                <Avatar id={membre.id} nom={nom(membre.id)} taille={32} presence={m.presences?.get(membre.id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--lc-text)" }}>
                    {nom(membre.id)}{membre.id === m.moi && ` (${t("msg.group.you")})`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--lc-text-muted)" }}>
                    {m.annuaire.get(membre.id)?.poste}{membre.admin && ` · 🛡️ ${t("msg.group.admin")}`}
                  </div>
                </div>
                {admin && membre.id !== m.moi && (
                  <div style={{ display: "flex", gap: 5 }}>
                    <button type="button" style={petitBouton} disabled={enCours}
                      onClick={() => executer(() => api.definirAdmin(conv.id, membre.id, !membre.admin))}>
                      {membre.admin ? t("msg.group.removeAdmin") : t("msg.group.makeAdmin")}
                    </button>
                    <button type="button" style={{ ...petitBouton, color: "#dc2626" }} disabled={enCours}
                      onClick={() => window.confirm(t("msg.group.removeConfirm", { name: nom(membre.id) })) && executer(() => api.retirerMembre(conv.id, membre.id))}>
                      {t("msg.group.remove")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Btn sm v="danger" disabled={enCours} onClick={quitter}>🚪 {t("msg.group.leave")}</Btn>
            <Btn sm v="ghost" onClick={fermer}>{t("common.close")}</Btn>
          </div>
        </>
      )}
    </Modale>
  );
}
