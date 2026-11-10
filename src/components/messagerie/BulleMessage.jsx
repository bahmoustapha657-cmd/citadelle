import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LecteurVocal } from "./LecteurVocal";
import { PieceJointe } from "./PieceJointe";
import { accuseLecture, apercuMessage, formatHeure, lecteursMessage, libelleAppel } from "./messagerie-logic";
import { enEnvoi, envoiEchoue, estProvisoire } from "./envoi-local";
import { REACTIONS, resumerReactions } from "./reactions";

const MODIFIABLE_MS = 24 * 3600 * 1000;

const pilule = {
  alignSelf: "center", maxWidth: "85%", textAlign: "center", fontSize: 11.5, fontWeight: 600,
  color: "var(--lc-text-muted)", background: "var(--lc-surface)", border: "1px solid var(--lc-border)",
  borderRadius: 12, padding: "5px 12px", margin: "6px 0",
};

const action = {
  background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 14,
  padding: "3px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: "var(--lc-text)",
};

// Un message du fil : bulle (texte / vocal), trace d'appel ou message système.
export function BulleMessage({
  message, conv, moi, annuaire, suite, citation, selectionne, onSelection,
  onRepondre, onModifier, onSupprimer, onRappeler, onReessayer, onAbandonner, onReagir,
}) {
  const { t } = useTranslation();
  const deMoi = message.de_compte_id === moi;
  const groupe = conv?.type === "groupe";
  // Délai de correction évalué à l'affichage (la base revérifie de toute façon).
  const [instantAffichage] = useState(() => Date.now());

  if (message.type === "systeme") {
    return <div style={pilule}>{message.corps}</div>;
  }

  if (message.type === "appel") {
    const manque = !deMoi && !/^(termine|reunion)/.test(String(message.corps || ""));
    return (
      <div style={{ ...pilule, color: manque ? "#dc2626" : pilule.color }}>
        📞 {libelleAppel(message.corps, deMoi)} · {formatHeure(message.created_at)}
        {onRappeler && (
          <button type="button" onClick={onRappeler}
            style={{ marginInlineStart: 8, background: "none", border: "none", color: "var(--msg-accent, var(--sc1))", fontWeight: 800, cursor: "pointer", fontSize: 11.5 }}>
            {t("msg.bubble.callBack")}
          </button>
        )}
      </div>
    );
  }

  const auteur = annuaire.get(message.de_compte_id);
  const { lus, total } = deMoi ? accuseLecture(message, conv) : { lus: 0, total: 0 };
  const toutLu = total > 0 && lus === total;
  // Pas encore en base : rien à corriger, citer ou supprimer côté serveur.
  const provisoire = estProvisoire(message);
  const echec = envoiEchoue(message);
  const modifiable = deMoi && !provisoire && !message.supprime && message.type === "texte"
    && instantAffichage - Date.parse(message.created_at) < MODIFIABLE_MS;

  const reactions = message.supprime || provisoire ? [] : resumerReactions(message.reactions, moi);
  const maReaction = message.reactions?.[moi];
  const noms = (comptes) => comptes.map((id) => (id === moi ? t("msg.you") : annuaire.get(id)?.nom || t("msg.removedAccount"))).join(", ");

  const fond = message.supprime ? "transparent" : deMoi ? "var(--sc1)" : "var(--lc-surface)";
  // Écriture de la bulle « moi » : blanche ou bleu nuit selon la couleur de
  // l'école (variables posées par MessageriePage).
  const texte = deMoi && !message.supprime ? "var(--msg-encre, #fff)" : "var(--lc-text)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: deMoi ? "flex-end" : "flex-start", marginTop: suite ? 2 : 10 }}>
      {groupe && !deMoi && !suite && (
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--lc-text-muted)", margin: "0 10px 3px" }}>
          {auteur?.nom || t("msg.removedAccount")}
        </div>
      )}
      <div onClick={provisoire ? undefined : onSelection} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" && !provisoire) onSelection(); }}
        style={{
          maxWidth: "min(78%, 520px)", background: fond, color: texte, cursor: provisoire ? "default" : "pointer",
          opacity: enEnvoi(message) ? 0.75 : 1,
          border: message.supprime ? "1px dashed var(--lc-border)" : deMoi ? "none" : "1px solid var(--lc-border)",
          borderRadius: 16, borderEndEndRadius: deMoi ? 5 : 16, borderEndStartRadius: deMoi ? 16 : 5,
          padding: "8px 12px", boxShadow: message.supprime ? "none" : "var(--lc-shadow)",
          outline: selectionne ? "2px solid var(--sc1-lt)" : "none", overflowWrap: "anywhere",
        }}>
        {citation !== undefined && !message.supprime && (
          <div style={{
            borderInlineStart: `3px solid ${deMoi ? "color-mix(in srgb, var(--msg-encre, #fff) 70%, transparent)" : "var(--sc1)"}`,
            background: deMoi ? "color-mix(in srgb, var(--msg-encre, #fff) 14%, transparent)" : "var(--lc-surface-alt)",
            borderRadius: 6, padding: "4px 8px", marginBottom: 6, fontSize: 11.5, opacity: 0.95,
          }}>
            <div style={{ fontWeight: 800 }}>{(citation && annuaire.get(citation.de_compte_id)?.nom) || t("msg.bubble.message")}</div>
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {citation ? apercuMessage(citation) : t("msg.bubble.older")}
            </div>
          </div>
        )}

        {message.supprime ? (
          <span style={{ fontStyle: "italic", fontSize: 12.5, color: "var(--lc-text-faint)" }}>🚫 {t("msg.bubble.deleted")}</span>
        ) : message.type === "audio" ? (
          <LecteurVocal chemin={message.audio_path} duree={message.audio_duree} clair={deMoi} />
        ) : message.type === "fichier" ? (
          <div>
            <PieceJointe chemin={message.fichier_path} nom={message.fichier_nom} type={message.fichier_type}
              taille={message.fichier_taille} clair={deMoi} />
            {message.corps && <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.45, marginTop: 6 }}>{message.corps}</div>}
          </div>
        ) : (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.45 }}>{message.corps}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 3, fontSize: 10, opacity: 0.75 }}>
          {message.modifie_at && !message.supprime && <span>{t("msg.bubble.edited")}</span>}
          <span>{formatHeure(message.created_at)}</span>
          {provisoire && <span title={t(echec ? "msg.bubble.notSent" : "msg.bubble.sending")}>{echec ? "⚠️" : "🕓"}</span>}
          {deMoi && !provisoire && !message.supprime && (
            <span title={t("msg.bubble.readBy", { read: lus, total })} style={{ fontWeight: 800, color: toutLu ? "var(--msg-lu, #7dd3fc)" : undefined }}>
              {groupe && lus > 0 && !toutLu ? `✓✓ ${lus}/${total}` : lus > 0 ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>

      {reactions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: -6, marginInline: 8, position: "relative", justifyContent: deMoi ? "flex-end" : "flex-start" }}>
          {reactions.map((r) => (
            <button key={r.emoji} type="button" onClick={() => onReagir?.(r.emoji)} title={noms(r.comptes)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", borderRadius: 12, padding: "1px 7px",
                fontSize: 12.5, lineHeight: "20px", color: "var(--lc-text)", background: r.deMoi ? "var(--msg-surbrillance, var(--lc-surface-alt))" : "var(--lc-surface)",
                border: `1px solid ${r.deMoi ? "var(--sc1)" : "var(--lc-border)"}`, boxShadow: "var(--lc-shadow)",
              }}>
              <span>{r.emoji}</span>
              {r.nombre > 1 && <span style={{ fontSize: 11, fontWeight: 800 }}>{r.nombre}</span>}
            </button>
          ))}
        </div>
      )}
      {echec && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#dc2626" }}>{t("msg.bubble.notSent")}</span>
          <button type="button" style={action} onClick={onReessayer}>🔄 {t("msg.bubble.retry")}</button>
          <button type="button" style={{ ...action, color: "#dc2626" }} onClick={onAbandonner}>🗑️ {t("common.delete")}</button>
        </div>
      )}
      {selectionne && !provisoire && !message.supprime && onReagir && (
        <div role="group" aria-label={t("msg.bubble.react")}
          style={{ display: "flex", gap: 2, marginTop: 6, padding: "3px 6px", background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 18, boxShadow: "var(--lc-shadow)" }}>
          {REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onReagir(emoji)} aria-pressed={maReaction === emoji}
              style={{ border: "none", cursor: "pointer", fontSize: 19, lineHeight: 1, padding: "5px 6px", borderRadius: 12, background: maReaction === emoji ? "var(--msg-surbrillance, var(--lc-surface-alt))" : "none" }}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      {selectionne && !provisoire && !message.supprime && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5, justifyContent: deMoi ? "flex-end" : "flex-start" }}>
          <button type="button" style={action} onClick={onRepondre}>↩️ {t("msg.bubble.reply")}</button>
          {modifiable && <button type="button" style={action} onClick={onModifier}>✏️ {t("common.edit")}</button>}
          {deMoi && <button type="button" style={{ ...action, color: "#dc2626" }} onClick={onSupprimer}>🗑️ {t("common.delete")}</button>}
        </div>
      )}
      {selectionne && deMoi && !provisoire && !message.supprime && total > 0 && (
        <AccuseDetail message={message} conv={conv} annuaire={annuaire} />
      )}
    </div>
  );
}

function AccuseDetail({ message, conv, annuaire }) {
  const { t } = useTranslation();
  const lecteurs = new Set(lecteursMessage(message, conv));
  const autres = (conv.membres || []).filter((m) => m.id !== message.de_compte_id);
  const nom = (id) => annuaire.get(id)?.nom || t("msg.removedAccount");
  const lus = autres.filter((m) => lecteurs.has(m.id)).map((m) => nom(m.id));
  const nonLus = autres.filter((m) => !lecteurs.has(m.id)).map((m) => nom(m.id));
  return (
    <div style={{ fontSize: 11, color: "var(--lc-text-muted)", marginTop: 4, maxWidth: "min(78%, 520px)", textAlign: "end" }}>
      {lus.length > 0 && <div>✓✓ {t("msg.bubble.readByList", { names: lus.join(", ") })}</div>}
      {nonLus.length > 0 && <div>✓ {t("msg.bubble.notReadList", { names: nonLus.join(", ") })}</div>}
    </div>
  );
}
