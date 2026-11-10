import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";
import { BulleMessage } from "./BulleMessage";
import { Composeur } from "./Composeur";
import {
  autresMembres, construireFil, libellePresence, membresConnectes, peutContacter, peutLancerAppelGroupe,
  sousTitreConversation, titreConversation,
} from "./messagerie-logic";
import { boutonIcone } from "./styles-messagerie";
import { ecrireBrouillon, lireBrouillon } from "./envoi-local";
import { fichiersTransferes, libelleEcriture } from "./ecriture-logic";
import { useEcriture } from "./use-ecriture";

const itemMenu = {
  display: "block", width: "100%", textAlign: "start", background: "none", border: "none",
  padding: "9px 14px", fontSize: 13, cursor: "pointer", color: "var(--lc-text)",
};

// Discussion ouverte : en-tête (appel, menu), fil de messages, saisie.
export function VueConversation({ m, conv, etroit, onRetour, onGererGroupe }) {
  const { t } = useTranslation();
  const { moi, annuaire, fils, appels } = m;
  const fil = fils[conv.id];
  const messages = useMemo(() => fil?.messages || [], [fil]);
  const [selectionId, setSelectionId] = useState(null);
  const [reponse, setReponse] = useState(null);
  const [edition, setEdition] = useState(null);
  const [menu, setMenu] = useState(false);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  // « En train d'écrire… » : canal privé de la discussion.
  const ecriture = useEcriture({ convId: conv.id, moi });
  const ecrit = libelleEcriture(ecriture.enTrainDEcrire, { groupe: conv.type === "groupe", annuaire });
  // Fichiers glissés sur la discussion : remis à la zone de saisie.
  const [depot, setDepot] = useState(null);
  const [survol, setSurvol] = useState(false);
  const porteDesFichiers = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const surSurvol = (e) => { if (porteDesFichiers(e)) { e.preventDefault(); setSurvol(true); } };
  const surDepot = (e) => {
    if (!porteDesFichiers(e)) return;
    e.preventDefault();
    setSurvol(false);
    const fichiers = fichiersTransferes(e.dataTransfer);
    if (fichiers.length) setDepot({ fichiers });
  };
  const defilRef = useRef(null);
  const enBasRef = useRef(true);
  const hauteurAvantRef = useRef(null);

  const titre = titreConversation(conv, annuaire, moi);
  const correspondant = conv.type === "direct" ? autresMembres(conv, moi)[0] : null;
  const items = useMemo(() => construireFil(messages), [messages]);
  const parId = useMemo(() => new Map(messages.map((x) => [x.id, x])), [messages]);

  // Défilement : en bas à l'ouverture et à l'arrivée d'un message si on y
  // était déjà ; position conservée au chargement des messages anciens.
  useLayoutEffect(() => {
    const d = defilRef.current;
    if (!d) return;
    if (hauteurAvantRef.current !== null) {
      d.scrollTop = d.scrollHeight - hauteurAvantRef.current;
      hauteurAvantRef.current = null;
    } else if (enBasRef.current || messages[messages.length - 1]?.de_compte_id === moi) {
      d.scrollTop = d.scrollHeight;
    }
  }, [messages, moi]);

  // Son message vient d'arriver : il n'écrit plus.
  const dernierAuteur = messages[messages.length - 1]?.de_compte_id;
  const nbMessages = messages.length;
  const oublierEcriture = ecriture.oublier;
  useEffect(() => {
    if (dernierAuteur && dernierAuteur !== moi) oublierEcriture(dernierAuteur);
  }, [dernierAuteur, nbMessages, moi, oublierEcriture]);

  // Zone redimensionnée (clavier mobile, rotation, fenêtre) : on reste collé
  // en bas si on y était.
  useEffect(() => {
    const d = defilRef.current;
    if (!d || typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver(() => { if (enBasRef.current) d.scrollTop = d.scrollHeight; });
    obs.observe(d);
    return () => obs.disconnect();
  }, []);

  const surDefilement = () => {
    const d = defilRef.current;
    enBasRef.current = d.scrollHeight - d.scrollTop - d.clientHeight < 80;
  };

  const chargerAnciens = async () => {
    hauteurAvantRef.current = defilRef.current?.scrollHeight ?? null;
    setChargementAnciens(true);
    await m.chargerPlusAnciens(conv.id);
    setChargementAnciens(false);
  };

  const appeler = () => {
    if (!correspondant) return;
    appels.appeler({ conversationId: conv.id, correspondantId: correspondant.id });
  };

  const prefs = (p) => { setMenu(false); m.definirPreferences(conv.id, p); };

  const supprimer = async (message) => {
    if (!window.confirm(t("msg.conv.deleteConfirm"))) return;
    try { await m.supprimerMessage(message); } catch (e) { m.setErreur(e.message); }
    setSelectionId(null);
  };

  // Un seul appel à la fois : direct (P2P) ou de groupe (serveur d'appels).
  const reunions = m.reunions;
  const reunionIci = reunions?.actives.find((a) => a.conversation_id === conv.id);
  const dansReunionIci = reunions?.reunion?.conversationId === conv.id;
  const appelEnCours = !!appels.appel || (!!reunions?.enCours && !dansReunionIci);
  // Hiérarchie : on n'appelle que qui l'on peut contacter ; on rejoint
  // toujours un appel de groupe en cours.
  const peutAppeler = !!correspondant && peutContacter(annuaire.get(correspondant.id));
  const peutLancerGroupe = conv.type === "groupe" && peutLancerAppelGroupe(conv, annuaire, moi);

  return (
    <div onDragOver={surSurvol} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSurvol(false); }} onDrop={surDepot}
      style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--lc-surface-alt)" }}>
      {survol && (
        <div style={{ position: "absolute", inset: 8, zIndex: 30, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed var(--sc1)", borderRadius: 14, background: "color-mix(in srgb, var(--lc-surface) 88%, transparent)", color: "var(--msg-accent, var(--sc1))", fontSize: 15, fontWeight: 800 }}>
          📎 {t("msg.compose.dropHere")}
        </div>
      )}
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--lc-surface)", borderBottom: "1px solid var(--lc-border)" }}>
        {etroit && <button type="button" onClick={onRetour} style={boutonIcone} aria-label={t("msg.backToList")}>←</button>}
        <Avatar id={correspondant?.id || conv.id} nom={titre} groupe={conv.type === "groupe"} taille={38}
          presence={correspondant ? m.presences?.get(correspondant.id) : null} />
        <div style={{ flex: 1, minWidth: 0, cursor: conv.type === "groupe" ? "pointer" : "default" }}
          onClick={conv.type === "groupe" ? onGererGroupe : undefined}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--lc-text-brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {conv.epingle && "📌 "}{titre}{conv.sourdine && " 🔕"}
          </div>
          <div style={{ fontSize: 11.5, color: ecrit ? "var(--msg-accent, var(--sc1))" : "var(--lc-text-muted)", fontWeight: ecrit ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ecrit || [
              sousTitreConversation(conv, annuaire, moi),
              correspondant
                ? libellePresence(m.presences?.get(correspondant.id))
                : (membresConnectes(conv, m.presences, moi) ? t("msg.conv.onlineCount", { count: membresConnectes(conv, m.presences, moi) }) : ""),
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
        {peutAppeler && (
          <button type="button" onClick={appeler} disabled={appelEnCours || dansReunionIci} title={t("msg.conv.audioCall")}
            style={{ ...boutonIcone, fontSize: 19, opacity: appelEnCours ? 0.4 : 1 }}>📞</button>
        )}
        {conv.type === "groupe" && reunions && (reunionIci && !dansReunionIci ? (
          <button type="button" onClick={() => reunions.rejoindre(conv.id)} disabled={appelEnCours}
            title={t("msg.list.groupCallInProgress")}
            style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", opacity: appelEnCours ? 0.5 : 1 }}>
            🟢 {t("msg.conv.joinCount", { count: (reunionIci.presents || []).length })}
          </button>
        ) : (dansReunionIci || peutLancerGroupe) && (
          <button type="button" onClick={() => reunions.rejoindre(conv.id)} disabled={appelEnCours}
            title={dansReunionIci ? t("msg.conv.backToCall") : t("msg.conv.groupCallHint")}
            style={{ ...boutonIcone, fontSize: 19, opacity: appelEnCours ? 0.4 : 1 }}>📞</button>
        ))}
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => setMenu((v) => !v)} style={{ ...boutonIcone, fontSize: 20 }} aria-label={t("msg.conv.options")}>⋮</button>
          {menu && (
            <div style={{ position: "absolute", insetInlineEnd: 0, top: "100%", zIndex: 20, minWidth: 210, background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 10, boxShadow: "var(--lc-shadow-modal)", overflow: "hidden" }}>
              <button type="button" style={itemMenu} onClick={() => prefs({ epingle: !conv.epingle })}>📌 {conv.epingle ? t("msg.conv.unpin") : t("msg.conv.pinTop")}</button>
              <button type="button" style={itemMenu} onClick={() => prefs({ sourdine: !conv.sourdine })}>{conv.sourdine ? `🔔 ${t("msg.conv.unmute")}` : `🔕 ${t("msg.conv.mute")}`}</button>
              <button type="button" style={itemMenu} onClick={() => prefs({ archive: !conv.archive })}>{conv.archive ? `📤 ${t("msg.conv.unarchive")}` : `🗄️ ${t("msg.conv.archive")}`}</button>
              {conv.type === "groupe" && (
                <button type="button" style={itemMenu} onClick={() => { setMenu(false); onGererGroupe(); }}>👥 {t("msg.conv.groupSettings")}</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fil */}
      <div ref={defilRef} onScroll={surDefilement} onClick={() => setMenu(false)}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 14px 14px", display: "flex", flexDirection: "column" }}>
        {!fil && <p style={{ textAlign: "center", color: "var(--lc-text-faint)", fontSize: 12, marginTop: 30 }}>{t("msg.page.loading")}</p>}
        {fil && !fil.complet && (
          <button type="button" onClick={chargerAnciens} disabled={chargementAnciens}
            style={{ alignSelf: "center", margin: "6px 0 10px", background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 14, padding: "4px 12px", fontSize: 11.5, cursor: "pointer", color: "var(--lc-text-muted)" }}>
            {chargementAnciens ? t("msg.page.loading") : `↑ ${t("msg.conv.olderMessages")}`}
          </button>
        )}
        {fil && messages.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--lc-text-faint)", fontSize: 12.5, marginTop: 40 }}>
            {t("msg.conv.empty")}
          </p>
        )}
        {items.map((item) => (item.type === "jour" ? (
          <div key={item.cle} style={{ alignSelf: "center", fontSize: 11, fontWeight: 700, color: "var(--lc-text-muted)", background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 10, padding: "3px 10px", margin: "12px 0 4px", textTransform: "capitalize" }}>
            {item.libelle}
          </div>
        ) : (
          <BulleMessage key={item.cle} message={item.message} conv={conv} moi={moi} annuaire={annuaire} suite={item.suite}
            citation={item.message.reponse_a ? (parId.get(item.message.reponse_a) || null) : undefined}
            selectionne={selectionId === item.message.id}
            onSelection={() => setSelectionId(selectionId === item.message.id ? null : item.message.id)}
            onRepondre={() => { setReponse(item.message); setEdition(null); setSelectionId(null); }}
            onModifier={() => { setEdition(item.message); setReponse(null); setSelectionId(null); }}
            onSupprimer={() => supprimer(item.message)}
            onReessayer={() => m.reessayerMessage(item.message)}
            onAbandonner={() => m.abandonnerMessage(item.message)}
            onRappeler={item.message.type === "appel" && peutAppeler && !appelEnCours ? appeler : undefined} />
        )))}
      </div>

      <Composeur annuaire={annuaire}
        brouillon={lireBrouillon(moi, conv.id)} onBrouillon={(texte) => ecrireBrouillon(moi, conv.id, texte)}
        onFrappe={ecriture.signalerFrappe} depot={depot}
        reponse={reponse} onAnnulerReponse={() => setReponse(null)}
        edition={edition} onAnnulerEdition={() => setEdition(null)}
        onEnvoyerTexte={(texte) => { enBasRef.current = true; m.envoyerTexte(conv.id, texte, reponse?.id || null); setReponse(null); }}
        onEnvoyerFichiers={async (fichiers, legende) => {
          enBasRef.current = true;
          try { await m.envoyerFichiers(conv.id, fichiers, legende, reponse?.id || null); } finally { setReponse(null); }
        }}
        onEnvoyerVocal={async (vocal) => { await m.envoyerVocal(conv.id, vocal, reponse?.id || null); setReponse(null); enBasRef.current = true; }}
        onValiderEdition={async (texte) => { await m.modifierMessage(edition, texte); setEdition(null); }} />
    </div>
  );
}
