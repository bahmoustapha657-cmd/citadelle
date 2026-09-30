import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { subscribeTablePayload } from "../../../backend/realtime-supabase";
import * as api from "../../../backend/messagerie-supabase";
import {
  arreterFlux, capterMicro, CONTRAINTES_VIDEO, limiterDebit, messageErreurCamera, webrtcDisponible,
} from "./webrtc";
import { creerSonnerie } from "./sonnerie";
import { pistesATirer } from "./reunion-logic";

const SIGNE_DE_VIE_MS = 20000;
const DELAI_DEMARRAGE_MS = 3500;

const etatVide = () => ({
  jeton: null, id: null, conversationId: null, pc: null, micro: null, camera: null,
  transAudio: null, transVideo: null, facing: "user",
  file: Promise.resolve(), tirees: new Set(), mids: new Map(), audios: new Map(),
  minuteur: null, synchro: null,
});

const description = (d) => ({ type: d.type, sdp: d.sdp });

// ══════════════════════════════════════════════════════════════
//  Appels de groupe (« réunions ») via le SFU Cloudflare Realtime
// ══════════════════════════════════════════════════════════════
// Une seule connexion WebRTC vers le serveur : on y PUBLIE son micro (et sa
// caméra si allumée) et on y TIRE les pistes des autres participants. Toutes
// les opérations passent par l'Edge Function `reunion`, qui vérifie les
// droits ; la liste des participants vient de la base (temps réel).
// `reunion` (état d'écran) : { id, conversationId, phase, debut, micro,
//   camera, reduite, participants[], videos{compteId: MediaStream},
//   videoLocale, message, erreur } — phase ∈ connexion | en_cours | fin.
export function useReunion({ actif, moi, schoolCode, occupe, surNouvelleReunion }) {
  const [reunion, setReunion] = useState(null);
  const [actives, setActives] = useState([]);
  const ref = useRef(etatVide());
  const occupeRef = useRef(occupe);
  const surNouvelleRef = useRef(surNouvelleReunion);
  useLayoutEffect(() => {
    occupeRef.current = occupe;
    surNouvelleRef.current = surNouvelleReunion;
  });

  const maj = (patch) => setReunion((r) => (r ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r));

  // Cloudflare exige qu'une négociation soit finie avant la suivante.
  const enFile = (fn) => {
    const r = ref.current;
    const suite = r.file.then(fn, fn);
    r.file = suite.catch(() => {});
    return suite;
  };

  const chargerActives = useCallback(async () => {
    try { setActives(await api.reunionsActives()); } catch { /* SQL v3 absent : rien à afficher */ }
  }, []);

  const nettoyer = useCallback(() => {
    const r = ref.current;
    clearInterval(r.minuteur);
    clearTimeout(r.synchro);
    try { r.pc?.close(); } catch { /* déjà fermée */ }
    arreterFlux(r.micro);
    arreterFlux(r.camera);
    r.audios.forEach((a) => { a.pause(); a.srcObject = null; });
    Object.assign(r, etatVide());
  }, []);

  const quitter = useCallback((message = null) => {
    const id = ref.current.id;
    nettoyer();
    if (id) api.quitterReunion(id).catch(() => {}).finally(chargerActives);
    if (!message) { setReunion(null); return; }
    setReunion((r) => (r ? { ...r, phase: "fin", message } : r));
    setTimeout(() => setReunion((r) => (r?.phase === "fin" ? null : r)), 3000);
  }, [chargerActives, nettoyer]);

  // Pistes reçues du serveur : son → <audio> par participant ; image → état.
  const surPiste = (e) => {
    const r = ref.current;
    const info = r.mids.get(String(e.transceiver?.mid));
    if (!info?.compteId) return;
    if (info.kind === "audio") {
      let lecteur = r.audios.get(info.compteId);
      if (!lecteur) { lecteur = new Audio(); lecteur.autoplay = true; r.audios.set(info.compteId, lecteur); }
      lecteur.srcObject = new MediaStream([e.track]);
      lecteur.play().catch(() => {});
    } else {
      const flux = new MediaStream([e.track]);
      maj((x) => ({ videos: { ...x.videos, [info.compteId]: flux } }));
    }
  };

  const tirer = async (jeton, demandes) => {
    const r = ref.current;
    if (r.jeton !== jeton || !demandes.length) return;
    const rep = await api.actionReunion("recevoir", {
      reunionId: r.id, pistes: demandes.map(({ compteId, trackName }) => ({ compteId, trackName })),
    });
    if (r.jeton !== jeton) return;
    for (const t of rep.tracks || []) {
      if (t.errorCode || t.mid == null || !t.compteId) continue;
      r.mids.set(String(t.mid), { compteId: t.compteId, kind: t.trackName === "video" ? "video" : "audio" });
    }
    demandes.forEach((d) => r.tirees.add(d.cle));
    if (rep.requiresImmediateRenegotiation && rep.sessionDescription) {
      await r.pc.setRemoteDescription(rep.sessionDescription);
      const reponse = await r.pc.createAnswer();
      await r.pc.setLocalDescription(reponse);
      await api.actionReunion("renegocier", { reunionId: r.id, sessionDescription: description(reponse) });
    }
  };

  // Participants présents (base) → pistes à tirer ; départs → nettoyage.
  const synchroniser = useCallback(() => {
    const r = ref.current;
    const { jeton, id } = r;
    if (!jeton || !id) return Promise.resolve();
    return enFile(async () => {
      if (ref.current.jeton !== jeton) return;
      const [participants, liste] = await Promise.all([api.participantsReunion(id), api.reunionsActives()]);
      if (ref.current.jeton !== jeton) return;
      setActives(liste);
      const courante = liste.find((x) => x.id === id);
      if (!courante) { quitter("L'appel est terminé."); return; }
      const presents = participants.filter((p) => !p.quitte_at && (courante.presents || []).includes(p.compte_id));
      maj({ participants: presents });
      for (const [compteId, lecteur] of r.audios) {
        if (!presents.some((p) => p.compte_id === compteId)) { lecteur.pause(); lecteur.srcObject = null; r.audios.delete(compteId); }
      }
      maj((x) => ({ videos: Object.fromEntries(Object.entries(x.videos).filter(([cid]) => presents.some((p) => p.compte_id === cid))) }));
      await tirer(jeton, pistesATirer(presents, moi, r.tirees));
    }).catch(() => { /* nouvelle tentative au prochain signe de vie */ });
  }, [moi, quitter]);

  const publier = async (transceiver, trackName) => {
    const r = ref.current;
    await r.pc.setLocalDescription(await r.pc.createOffer());
    const rep = await api.actionReunion("publier", {
      reunionId: r.id, sessionDescription: description(r.pc.localDescription),
      tracks: [{ mid: transceiver.mid, trackName }],
    });
    await r.pc.setRemoteDescription(rep.sessionDescription);
  };

  // ── Rejoindre (ou lancer) l'appel de groupe d'une discussion ──
  const rejoindre = useCallback(async (conversationId) => {
    const r0 = ref.current;
    if (r0.jeton) {
      if (r0.conversationId === conversationId) maj({ reduite: false });
      else maj({ erreur: "Quittez d'abord l'appel en cours." });
      return;
    }
    if (occupeRef.current?.()) {
      setReunion({ conversationId, phase: "fin", message: "Terminez d'abord l'appel en cours.", participants: [], videos: {} });
      setTimeout(() => setReunion((x) => (x?.phase === "fin" ? null : x)), 3000);
      return;
    }
    if (!webrtcDisponible()) {
      setReunion({ conversationId, phase: "fin", message: "Appels non pris en charge par ce navigateur.", participants: [], videos: {} });
      setTimeout(() => setReunion((x) => (x?.phase === "fin" ? null : x)), 3000);
      return;
    }
    const jeton = {};
    Object.assign(ref.current, { jeton, conversationId });
    setReunion({
      id: null, conversationId, phase: "connexion", micro: true, camera: false, reduite: false,
      participants: [], videos: {}, videoLocale: null, erreur: "",
    });
    try {
      const dejaActive = actives.some((a) => a.conversation_id === conversationId);
      const id = await api.demarrerReunion(conversationId);
      ref.current.id = id;
      maj({ id });
      const [micro, iceServers] = await Promise.all([capterMicro(), api.serveursIce()]);
      if (ref.current.jeton !== jeton) { arreterFlux(micro); return; }
      ref.current.micro = micro;
      const pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" });
      ref.current.pc = pc;
      pc.ontrack = surPiste;
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" && ref.current.jeton === jeton) quitter("Connexion au serveur d'appels perdue.");
      };
      await api.actionReunion("rejoindre", { reunionId: id });
      await enFile(async () => {
        const trans = pc.addTransceiver(micro.getAudioTracks()[0], { direction: "sendonly" });
        ref.current.transAudio = trans;
        await publier(trans, "audio");
      });
      if (ref.current.jeton !== jeton) return;
      maj({ phase: "en_cours", debut: Date.now() });
      if (!dejaActive) surNouvelleRef.current?.(conversationId);
      ref.current.minuteur = setInterval(() => {
        api.etatReunion(id).catch(() => {});
        synchroniser();
      }, SIGNE_DE_VIE_MS);
      synchroniser();
    } catch (e) {
      if (ref.current.jeton === jeton) quitter(e.message || "Impossible de rejoindre l'appel.");
    }
  }, [actives, quitter, synchroniser]); // eslint-disable-line react-hooks/exhaustive-deps

  const basculerMicro = useCallback(() => {
    const r = ref.current;
    const piste = r.micro?.getAudioTracks()[0];
    if (!piste || !r.id) return;
    piste.enabled = !piste.enabled;
    maj({ micro: piste.enabled });
    api.etatReunion(r.id, { micro: piste.enabled }).catch(() => {});
  }, []);

  const ouvrirCamera = (facing) => navigator.mediaDevices.getUserMedia({ video: { ...CONTRAINTES_VIDEO, facingMode: facing } });

  const basculerCamera = useCallback(() => {
    const r = ref.current;
    if (!r.pc || !r.id) return;
    enFile(async () => {
      if (r.camera) {
        await r.transVideo?.sender.replaceTrack(null);
        arreterFlux(r.camera);
        r.camera = null;
        maj({ camera: false, videoLocale: null });
        api.etatReunion(r.id, { camera: false }).catch(() => {});
        return;
      }
      const flux = await ouvrirCamera(r.facing);
      const piste = flux.getVideoTracks()[0];
      r.camera = flux;
      if (r.transVideo) {
        await r.transVideo.sender.replaceTrack(piste);
      } else {
        const trans = r.pc.addTransceiver(piste, { direction: "sendonly" });
        r.transVideo = trans;
        await publier(trans, "video");
        await limiterDebit(trans.sender);
      }
      maj({ camera: true, videoLocale: flux, erreur: "" });
      api.etatReunion(r.id, { camera: true }).catch(() => {});
    }).catch((e) => maj({ erreur: messageErreurCamera(e) }));
  }, []);

  // Caméra avant ↔ arrière (téléphone).
  const retournerCamera = useCallback(() => {
    const r = ref.current;
    if (!r.camera || !r.transVideo) return;
    enFile(async () => {
      const facing = r.facing === "user" ? "environment" : "user";
      const flux = await ouvrirCamera(facing);
      await r.transVideo.sender.replaceTrack(flux.getVideoTracks()[0]);
      arreterFlux(r.camera);
      Object.assign(r, { camera: flux, facing });
      maj({ videoLocale: flux });
    }).catch((e) => maj({ erreur: messageErreurCamera(e) }));
  }, []);

  const reduire = useCallback((reduite) => maj({ reduite }), []);

  // ── Temps réel : réunions (bandeaux) et participants (appel en cours) ──
  const synchroniserRef = useRef(synchroniser);
  useLayoutEffect(() => { synchroniserRef.current = synchroniser; }, [synchroniser]);

  useEffect(() => {
    if (!actif || !schoolCode) return undefined;
    let minuteurActives = null;
    const planifierActives = () => { clearTimeout(minuteurActives); minuteurActives = setTimeout(chargerActives, 500); };
    const surReunion = (payload) => {
      planifierActives();
      const nouvelle = payload?.eventType === "INSERT" ? payload.new : null;
      // Un collègue lance un appel dans une de mes discussions : bref signal.
      if (nouvelle && nouvelle.lance_par !== moi && !ref.current.jeton) {
        const son = creerSonnerie("entrant");
        son.demarrer();
        setTimeout(() => son.arreter(), 2200);
      }
    };
    const surParticipant = (payload) => {
      const ligne = payload?.new || payload?.old;
      const r = ref.current;
      if (r.id && ligne?.reunion_id === r.id) {
        clearTimeout(r.synchro);
        r.synchro = setTimeout(() => synchroniserRef.current(), 300);
      } else {
        planifierActives();
      }
    };
    const detacher = [
      subscribeTablePayload(schoolCode, "msg_reunions", surReunion),
      subscribeTablePayload(schoolCode, "msg_reunion_participants", surParticipant),
    ];
    const demarrage = setTimeout(chargerActives, DELAI_DEMARRAGE_MS);
    const auRetour = () => { if (document.visibilityState === "visible") chargerActives(); };
    document.addEventListener("visibilitychange", auRetour);
    const surFermeture = () => { if (ref.current.id) api.quitterReunion(ref.current.id).catch(() => {}); };
    window.addEventListener("pagehide", surFermeture);
    return () => {
      detacher.forEach((fn) => fn());
      clearTimeout(minuteurActives);
      clearTimeout(demarrage);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("pagehide", surFermeture);
    };
  }, [actif, schoolCode, moi, chargerActives]);

  useEffect(() => () => nettoyer(), [nettoyer]);

  return {
    reunion, actives, rejoindre, quitter: () => quitter(null), basculerMicro, basculerCamera, retournerCamera, reduire,
    enCours: !!reunion && reunion.phase !== "fin",
  };
}
