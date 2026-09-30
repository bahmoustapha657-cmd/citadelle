import { useState } from "react";
import { LecteurVocal } from "./LecteurVocal";
import { PieceJointe } from "./PieceJointe";
import { accuseLecture, apercuMessage, formatHeure, lecteursMessage, libelleAppel } from "./messagerie-logic";

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
  onRepondre, onModifier, onSupprimer, onRappeler,
}) {
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
            style={{ marginInlineStart: 8, background: "none", border: "none", color: "var(--sc1)", fontWeight: 800, cursor: "pointer", fontSize: 11.5 }}>
            Rappeler
          </button>
        )}
      </div>
    );
  }

  const auteur = annuaire.get(message.de_compte_id);
  const { lus, total } = deMoi ? accuseLecture(message, conv) : { lus: 0, total: 0 };
  const toutLu = total > 0 && lus === total;
  const modifiable = deMoi && !message.supprime && message.type === "texte"
    && instantAffichage - Date.parse(message.created_at) < MODIFIABLE_MS;

  const fond = message.supprime ? "transparent" : deMoi ? "var(--sc1)" : "var(--lc-surface)";
  const texte = deMoi && !message.supprime ? "#fff" : "var(--lc-text)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: deMoi ? "flex-end" : "flex-start", marginTop: suite ? 2 : 10 }}>
      {groupe && !deMoi && !suite && (
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--lc-text-muted)", margin: "0 10px 3px" }}>
          {auteur?.nom || "Compte retiré"}
        </div>
      )}
      <div onClick={onSelection} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onSelection(); }}
        style={{
          maxWidth: "min(78%, 520px)", background: fond, color: texte, cursor: "pointer",
          border: message.supprime ? "1px dashed var(--lc-border)" : deMoi ? "none" : "1px solid var(--lc-border)",
          borderRadius: 16, borderEndEndRadius: deMoi ? 5 : 16, borderEndStartRadius: deMoi ? 16 : 5,
          padding: "8px 12px", boxShadow: message.supprime ? "none" : "var(--lc-shadow)",
          outline: selectionne ? "2px solid var(--sc1-lt)" : "none", overflowWrap: "anywhere",
        }}>
        {citation !== undefined && !message.supprime && (
          <div style={{
            borderInlineStart: `3px solid ${deMoi ? "rgba(255,255,255,0.7)" : "var(--sc1)"}`,
            background: deMoi ? "rgba(255,255,255,0.14)" : "var(--lc-surface-alt)",
            borderRadius: 6, padding: "4px 8px", marginBottom: 6, fontSize: 11.5, opacity: 0.95,
          }}>
            <div style={{ fontWeight: 800 }}>{citation ? (annuaire.get(citation.de_compte_id)?.nom || "Message") : "Message"}</div>
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {citation ? apercuMessage(citation) : "Message plus ancien"}
            </div>
          </div>
        )}

        {message.supprime ? (
          <span style={{ fontStyle: "italic", fontSize: 12.5, color: "var(--lc-text-faint)" }}>🚫 Message supprimé</span>
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
          {message.modifie_at && !message.supprime && <span>modifié</span>}
          <span>{formatHeure(message.created_at)}</span>
          {deMoi && !message.supprime && (
            <span title={`Lu par ${lus} sur ${total}`} style={{ fontWeight: 800, color: toutLu ? "#7dd3fc" : undefined }}>
              {groupe && lus > 0 && !toutLu ? `✓✓ ${lus}/${total}` : lus > 0 ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>

      {selectionne && !message.supprime && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5, justifyContent: deMoi ? "flex-end" : "flex-start" }}>
          <button type="button" style={action} onClick={onRepondre}>↩️ Répondre</button>
          {modifiable && <button type="button" style={action} onClick={onModifier}>✏️ Modifier</button>}
          {deMoi && <button type="button" style={{ ...action, color: "#dc2626" }} onClick={onSupprimer}>🗑️ Supprimer</button>}
        </div>
      )}
      {selectionne && deMoi && !message.supprime && total > 0 && (
        <AccuseDetail message={message} conv={conv} annuaire={annuaire} />
      )}
    </div>
  );
}

function AccuseDetail({ message, conv, annuaire }) {
  const lecteurs = new Set(lecteursMessage(message, conv));
  const autres = (conv.membres || []).filter((m) => m.id !== message.de_compte_id);
  const nom = (id) => annuaire.get(id)?.nom || "Compte retiré";
  const lus = autres.filter((m) => lecteurs.has(m.id)).map((m) => nom(m.id));
  const nonLus = autres.filter((m) => !lecteurs.has(m.id)).map((m) => nom(m.id));
  return (
    <div style={{ fontSize: 11, color: "var(--lc-text-muted)", marginTop: 4, maxWidth: "min(78%, 520px)", textAlign: "end" }}>
      {lus.length > 0 && <div>✓✓ Lu par : {lus.join(", ")}</div>}
      {nonLus.length > 0 && <div>✓ Pas encore lu : {nonLus.join(", ")}</div>}
    </div>
  );
}
