import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { subscribeTablePayload } from "../../../backend/realtime-supabase";
import {
  appelsEntrantsEnAttente, lancerAppel, notifier, ouvrirCanalAppel, repondreAppel, serveursIce, terminerAppel,
  tracerAppel,
} from "../../../backend/messagerie-supabase";
import {
  arreterFlux, attendreCollecteIce, capterMicro, creerConnexion, descriptionJson, webrtcDisponible,
} from "./webrtc";
import { cleCommune, creerEchangeCles } from "./relais-chiffrement";
import { appelADecrocher } from "../../../backend/application-android";
import { demarrerRelaisSecours } from "./relais-secours";
import { creerSonnerie } from "./sonnerie";
import { compteRendu, noter, nouvelleTrace, resumerStats } from "./trace-appel";
import i18n from "../../../i18n";

// Sonnerie côté appelant avant « Pas de réponse » : le temps de voir la
// notification et d'ouvrir l'application sur un téléphone lent.
const DELAI_SONNERIE_MS = 60000;
// Coupure réseau tolérée en cours d'appel avant de passer au relais de secours.
const DELAI_COUPURE_MS = 12000;
// Après la réponse : au-delà, la voix passe par le relais de secours sans
// attendre que le navigateur déclare la connexion perdue.
const DELAI_CONNEXION_MS = 10000;
// Relevé des compteurs de la connexion, gardé pour le compte rendu de l'appel.
const RELEVE_STATS_MS = 2000;

// Fin annoncée à l'écran, selon le statut final lu dans msg_appels
// (clés msg.callEnd.*).
const FIN_POUR_APPELANT = {
  refuse: "declined", occupe: "busy", manque: "noAnswer", termine: "ended", echec: "lost",
};
const FIN_POUR_APPELE = {
  annule: "missed", manque: "missed", termine: "ended", echec: "lost",
};
const fin = (cle) => i18n.t(`msg.callEnd.${cle}`);

const etatVide = () => ({
  jeton: null, id: null, sens: null, offre: null, pc: null, audio: null, flux: null,
  sonnerie: null, minuteurs: [], coupure: null, reponduIci: false, distantOk: false,
  canal: null, secours: null, attenteConnexion: null, echange: null, cle: null, appeleUserId: null,
  trace: null, releve: null,
});

// Dernier état connu de la connexion WebRTC, relevé tant qu'elle existe : à la
// fin de l'appel elle est déjà fermée, et ses compteurs avec elle.
function releverStats(r) {
  const { pc, trace } = r;
  if (!pc || !trace) return;
  pc.getStats().then((stats) => { trace.webrtc = resumerStats(stats.values()); }).catch(() => {});
}

// Compte rendu de cet appareil, déposé pour tout appel décroché.
function deposerTrace(r) {
  const { id, trace, flux, secours } = r;
  if (!id || !trace || !(r.reponduIci || r.distantOk)) return;
  if (secours) trace.secours = secours.compteurs();
  const piste = flux?.getAudioTracks?.()[0];
  if (piste) trace.piste = { active: piste.enabled, muette: piste.muted, etat: piste.readyState };
  noter(trace, "fin");
  tracerAppel(id, compteRendu(trace)).catch(() => {});
}

// Description envoyée à l'autre côté, avec la clé publique du relais de secours.
const descriptionAvecCle = (pc, echange) => ({ ...descriptionJson(pc.localDescription), cle: echange?.publique });

// Appels audio 1-à-1. Signalisation : table msg_appels (insert = ça sonne,
// update = réponse / fin), reçue en temps réel. Un seul appel à la fois par
// appareil ; un appel reçu pendant un autre est refusé « occupé ».
// Voix : WebRTC (direct, ou relais TURN) ; si la connexion n'aboutit pas ou se
// perd, relais de secours chiffré par le canal privé Supabase de l'appel.
// `appel` (état d'écran) : { id, sens, phase, correspondantId, conversationId,
//   debut, muet, secours, message } avec phase ∈ preparation | appel | sonnerie |
//   connexion | en_cours | fin.
export function useAppels({ actif, moi, schoolCode, annuaire, nomMoi, occupe }) {
  const [appel, setAppel] = useState(null);
  const ref = useRef(etatVide());
  const annuaireRef = useRef(annuaire);
  useLayoutEffect(() => { annuaireRef.current = annuaire; }, [annuaire]);
  // Autre appel en cours sur cet appareil (appel de groupe).
  const occupeRef = useRef(occupe);
  useLayoutEffect(() => { occupeRef.current = occupe; });

  const majAppel = (patch) => setAppel((a) => (a ? { ...a, ...patch } : a));

  const nettoyer = useCallback(() => {
    const r = ref.current;
    deposerTrace(r);
    clearInterval(r.releve);
    r.sonnerie?.arreter();
    r.minuteurs.forEach(clearTimeout);
    clearTimeout(r.coupure);
    clearTimeout(r.attenteConnexion);
    r.secours?.arreter();
    r.canal?.fermer();
    try { r.pc?.close(); } catch { /* déjà fermée */ }
    arreterFlux(r.flux);
    if (r.audio) r.audio.srcObject = null;
    Object.assign(r, etatVide());
  }, []);

  // Termine localement ; `message` s'affiche 2,5 s (null : fermeture directe).
  const finir = useCallback((message = null) => {
    nettoyer();
    if (!message) { setAppel(null); return; }
    setAppel((a) => (a ? { ...a, phase: "fin", message } : a));
    setTimeout(() => setAppel((a) => (a?.phase === "fin" ? null : a)), 2500);
  }, [nettoyer]);

  // L'application Android de l'appelé sonne toute seule : si l'appelant renonce,
  // il faut lui dire d'arrêter.
  const finirSonnerieDistante = useCallback(() => {
    const r = ref.current;
    if (r.sens === "sortant" && r.id && !r.distantOk) notifier([r.appeleUserId], "", "", "/", { appelFin: r.id });
  }, []);

  const echouer = useCallback((message) => {
    const id = ref.current.id;
    if (id) terminerAppel(id, "echec").catch(() => {});
    finir(message);
  }, [finir]);

  // Ni connexion directe ni relais TURN : la voix passe par le canal privé de
  // l'appel. Chaque côté bascule de lui-même (échec, délai) ou dès le premier
  // message de l'autre, qui ne parle sur ce canal qu'une fois basculé. Sans clé
  // commune, pas de relais : jamais de voix en clair.
  const basculer = useCallback((jeton) => {
    const r = ref.current;
    if (r.jeton !== jeton || r.secours) return;
    const impossible = () => {
      if (ref.current.jeton !== jeton) return;
      noter(ref.current.trace, "secours-impossible");
      echouer(fin("networkFailed"));
    };
    noter(r.trace, `bascule:${r.pc?.connectionState || "sans-connexion"}`);
    if (!r.canal || !r.cle) { impossible(); return; }
    clearTimeout(r.coupure);
    clearTimeout(r.attenteConnexion);
    try { r.pc?.close(); } catch { /* déjà fermée */ }
    r.pc = null;
    if (r.audio) r.audio.srcObject = null;
    const { canal, flux, cle } = r;
    try {
      r.secours = demarrerRelaisSecours({
        flux, canal, cle,
        surPerte: () => {
          if (ref.current.jeton !== jeton) return;
          noter(ref.current.trace, "secours-perdu");
          echouer(fin("lost"));
        },
      });
    } catch { impossible(); return; }
    Promise.all([canal.pret, r.secours.pret]).then(() => {
      if (ref.current.jeton !== jeton) return;
      canal.envoyer("bascule");
      noter(ref.current.trace, "secours-pret");
      setAppel((a) => (a ? { ...a, phase: "en_cours", debut: a.debut || Date.now(), secours: true } : a));
    }).catch(impossible);
  }, [echouer]);

  // Réponse échangée : le canal de secours s'ouvre, la clé commune se calcule,
  // et la connexion a un délai pour aboutir.
  const preparerSecours = useCallback((jeton, publiqueDistante) => {
    const r = ref.current;
    if (r.jeton !== jeton || r.canal) return;
    cleCommune(r.echange, publiqueDistante, r.id).then((cle) => {
      if (ref.current.jeton === jeton) ref.current.cle = cle;
    });
    r.canal = ouvrirCanalAppel(r.id, (evenement, charge) => {
      if (ref.current.jeton !== jeton) return;
      basculer(jeton);
      ref.current.secours?.recevoir(evenement, charge);
    });
    r.canal.pret.then(() => noter(ref.current.trace, "canal-pret"))
      .catch(() => { noter(ref.current.trace, "canal-refuse"); /* WebRTC reste seul en piste */ });
    clearInterval(r.releve);
    r.releve = setInterval(() => releverStats(ref.current), RELEVE_STATS_MS);
    r.attenteConnexion = setTimeout(() => {
      const e = ref.current;
      if (e.jeton === jeton && e.cle && e.pc?.connectionState !== "connected") basculer(jeton);
    }, DELAI_CONNEXION_MS);
  }, [basculer]);

  const surEtatConnexion = useCallback((jeton) => (etat) => {
    const r = ref.current;
    if (r.jeton !== jeton) return;
    noter(r.trace, etat);
    if (etat === "connected") {
      releverStats(r);
      clearTimeout(r.coupure);
      clearTimeout(r.attenteConnexion);
      setAppel((a) => (a && a.phase !== "en_cours" ? { ...a, phase: "en_cours", debut: a.debut || Date.now() } : a));
    } else if (etat === "failed") {
      basculer(jeton);
    } else if (etat === "disconnected") {
      clearTimeout(r.coupure);
      r.coupure = setTimeout(() => {
        if (ref.current.jeton === jeton && ref.current.pc?.connectionState !== "connected") basculer(jeton);
      }, DELAI_COUPURE_MS);
    }
  }, [basculer]);

  const brancher = async (jeton) => {
    const [flux, iceServers] = await Promise.all([capterMicro(), serveursIce()]);
    const r = ref.current;
    if (r.jeton !== jeton) { arreterFlux(flux); return null; }
    r.flux = flux;
    r.trace = nouvelleTrace({ sens: r.sens, ua: navigator.userAgent });
    const { pc, audio } = creerConnexion({
      iceServers, flux, onEtat: surEtatConnexion(jeton),
      onLecture: (ok) => { if (ref.current.jeton === jeton) noter(ref.current.trace, ok ? "lecture" : "lecture-bloquee"); },
    });
    Object.assign(r, { pc, audio });
    return pc;
  };

  // ── Appel sortant ──
  const appeler = useCallback(async ({ conversationId, correspondantId }) => {
    if (ref.current.jeton) return;
    if (occupeRef.current?.()) {
      setAppel({ sens: "sortant", phase: "fin", correspondantId, conversationId, message: fin("leaveGroupFirst") });
      setTimeout(() => setAppel(null), 3000);
      return;
    }
    if (!webrtcDisponible()) {
      setAppel({ sens: "sortant", phase: "fin", correspondantId, conversationId, message: fin("unsupported") });
      setTimeout(() => setAppel(null), 3000);
      return;
    }
    const jeton = {};
    Object.assign(ref.current, { jeton, sens: "sortant" });
    setAppel({ id: null, sens: "sortant", phase: "preparation", correspondantId, conversationId, muet: false });
    try {
      const pc = await brancher(jeton);
      if (!pc) return;
      await pc.setLocalDescription(await pc.createOffer());
      await attendreCollecteIce(pc);
      const echange = await creerEchangeCles().catch(() => null);
      if (ref.current.jeton !== jeton) return;
      ref.current.echange = echange;
      const id = await lancerAppel(conversationId, descriptionAvecCle(pc, echange));
      if (ref.current.jeton !== jeton) { terminerAppel(id, "termine").catch(() => {}); return; }
      const appeleUserId = annuaireRef.current.get(correspondantId)?.user_id;
      Object.assign(ref.current, { id, appeleUserId });
      majAppel({ id, phase: "appel" });
      ref.current.sonnerie = creerSonnerie("sortant");
      ref.current.sonnerie.demarrer();
      ref.current.minuteurs.push(setTimeout(() => {
        if (ref.current.jeton === jeton && !ref.current.distantOk) {
          finirSonnerieDistante();
          terminerAppel(id, "manque").catch(() => {});
          finir(fin("noAnswer"));
        }
      }, DELAI_SONNERIE_MS));
      // Réveille l'appelé si l'application est fermée sur son téléphone.
      const nom = nomMoi || fin("aColleague");
      notifier([appeleUserId], `📞 ${i18n.t("msg.callEnd.pushTitle", { name: nom })}`, fin("pushBody"),
        `/?messagerie=${conversationId}`, { appel: { id, nom } });
    } catch (e) {
      if (ref.current.jeton === jeton) echouer(e.message || fin("callFailed"));
    }
  }, [echouer, finir, finirSonnerieDistante, nomMoi]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Appel entrant ──
  const recevoir = useCallback((ligne) => {
    if (ref.current.jeton || occupeRef.current?.()) {
      // Déjà en ligne sur cet appareil (appel direct ou de groupe).
      if (ref.current.id !== ligne.id) terminerAppel(ligne.id, "occupe").catch(() => {});
      return;
    }
    const jeton = {};
    Object.assign(ref.current, { jeton, id: ligne.id, sens: "entrant", offre: ligne.offre });
    ref.current.sonnerie = creerSonnerie("entrant");
    ref.current.sonnerie.demarrer();
    // Filet : si l'appelant disparaît sans raccrocher, on cesse de sonner.
    ref.current.minuteurs.push(setTimeout(() => {
      if (ref.current.jeton === jeton && !ref.current.reponduIci) finir(fin("missed"));
    }, DELAI_SONNERIE_MS + 5000));
    setAppel({
      id: ligne.id, sens: "entrant", phase: "sonnerie",
      correspondantId: ligne.appelant_id, conversationId: ligne.conversation_id, muet: false,
    });
  }, [finir]);

  const repondre = useCallback(async () => {
    const r = ref.current;
    const { jeton, id, offre } = r;
    if (!jeton || r.sens !== "entrant" || r.reponduIci) return;
    r.sonnerie?.arreter();
    majAppel({ phase: "connexion" });
    try {
      if (!webrtcDisponible()) throw new Error(fin("unsupported"));
      const pc = await brancher(jeton);
      if (!pc) return;
      await pc.setRemoteDescription(offre);
      await pc.setLocalDescription(await pc.createAnswer());
      await attendreCollecteIce(pc);
      const echange = await creerEchangeCles().catch(() => null);
      if (ref.current.jeton !== jeton) return;
      ref.current.echange = echange;
      ref.current.reponduIci = true;
      await repondreAppel(id, descriptionAvecCle(pc, echange));
      preparerSecours(jeton, offre?.cle);
    } catch (e) {
      if (ref.current.jeton === jeton) echouer(e.message || fin("answerFailed"));
    }
  }, [echouer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Raccrocher / refuser / annuler : la base tranche l'état final selon la
  // phase (sonne → refusé ou annulé ; en cours → terminé).
  const raccrocher = useCallback(() => {
    const id = ref.current.id;
    finirSonnerieDistante();
    if (id) terminerAppel(id, "termine").catch(() => {});
    finir(null);
  }, [finir, finirSonnerieDistante]);

  const basculerMuet = useCallback(() => {
    const flux = ref.current.flux;
    if (!flux) return;
    const muet = flux.getAudioTracks().some((p) => p.enabled);
    flux.getAudioTracks().forEach((p) => { p.enabled = !muet; });
    majAppel({ muet });
  }, []);

  // ── Temps réel : sonnerie, réponse, fin ──
  const recevoirRef = useRef(recevoir);
  const finirRef = useRef(finir);
  const echouerRef = useRef(echouer);
  const preparerSecoursRef = useRef(preparerSecours);
  const repondreRef = useRef(repondre);
  useLayoutEffect(() => {
    repondreRef.current = repondre;
    recevoirRef.current = recevoir;
    finirRef.current = finir;
    echouerRef.current = echouer;
    preparerSecoursRef.current = preparerSecours;
  }, [recevoir, repondre, finir, echouer, preparerSecours]);

  useEffect(() => {
    if (!actif || !moi || !schoolCode) return undefined;
    const surEvenement = (payload) => {
      const ligne = payload?.new;
      if (!ligne?.id) return;
      const r = ref.current;
      if (payload.eventType === "INSERT") {
        if (ligne.appele_id === moi && ligne.statut === "sonne") recevoirRef.current(ligne);
        return;
      }
      if (payload.eventType !== "UPDATE" || ligne.id !== r.id) return;
      if (ligne.statut === "en_cours") {
        if (r.sens === "sortant" && !r.distantOk && ligne.reponse) {
          r.distantOk = true;
          r.sonnerie?.arreter();
          setAppel((a) => (a ? { ...a, phase: "connexion" } : a));
          r.pc?.setRemoteDescription(ligne.reponse)
            .catch(() => echouerRef.current(fin("connectFailed")));
          preparerSecoursRef.current(r.jeton, ligne.reponse.cle);
        } else if (r.sens === "entrant" && !r.reponduIci) {
          finirRef.current(fin("answeredElsewhere"));
        }
      } else if (ligne.statut !== "sonne") {
        const table = r.sens === "sortant" ? FIN_POUR_APPELANT : FIN_POUR_APPELE;
        finirRef.current(fin(table[ligne.statut] || "ended"));
      }
    };
    const detacher = subscribeTablePayload(schoolCode, "msg_appels", surEvenement);
    // Ouverture depuis la notification « X vous appelle », ou retour dans
    // l'application : ça sonne encore ? En arrière-plan, le temps réel a pu
    // manquer l'événement, et il n'est jamais rejoué.
    // « Répondre » sur l'écran d'appel natif : on décroche sans redemander.
    let aDecrocher = appelADecrocher();
    const verifierAppels = () => {
      appelsEntrantsEnAttente(moi).then((liste) => {
        if (!liste[0]) return;
        recevoirRef.current(liste[0]);
        if (liste[0].id === aDecrocher) repondreRef.current();
        aDecrocher = null;
      }).catch(() => {});
    };
    verifierAppels();
    const surRetour = () => { if (document.visibilityState === "visible" && !ref.current.jeton) verifierAppels(); };
    document.addEventListener("visibilitychange", surRetour);
    // Fermeture de l'onglet en plein appel : on prévient l'autre côté.
    const surFermeture = () => { if (ref.current.id) terminerAppel(ref.current.id, "termine").catch(() => {}); };
    window.addEventListener("pagehide", surFermeture);
    return () => {
      detacher();
      document.removeEventListener("visibilitychange", surRetour);
      window.removeEventListener("pagehide", surFermeture);
    };
  }, [actif, moi, schoolCode]);

  useEffect(() => () => nettoyer(), [nettoyer]);

  return { appel, appeler, repondre, raccrocher, basculerMuet };
}
