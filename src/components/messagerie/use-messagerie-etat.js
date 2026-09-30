import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { resoudreEcoleId } from "../../backend/data-supabase";
import { subscribeTablePayload } from "../../backend/realtime-supabase";
import * as api from "../../backend/messagerie-supabase";
import {
  annonceNonLue, annoncesEnAlerte, apercuMessage, destinatairesAnnonce,
  PRIORITES, titreConversation, totalNonLus,
} from "./messagerie-logic";

// Délai avant le premier chargement : la connexion (surtout sur réseau
// faible) sert d'abord les écrans métier ; la messagerie suit.
const DELAI_DEMARRAGE_MS = 3000;
const RAFRAICHISSEMENT_MS = 180000;

// État central de la messagerie d'un compte : annuaire, boîte, fils ouverts,
// annonces, temps réel. Partagé par le contexte (badge d'en-tête, page,
// bandeau d'alertes).
export function useMessagerieEtat({ utilisateur, schoolCode, actif }) {
  const moi = utilisateur?.compteDocId || null;
  const nomMoi = utilisateur?.nom || "";

  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ecoleId, setEcoleId] = useState(null);
  const [annuaireListe, setAnnuaireListe] = useState([]);
  const [boite, setBoite] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [lusAnnonces, setLusAnnonces] = useState(new Map());
  const [statsAnnonces, setStatsAnnonces] = useState(new Map());
  // Fils chargés : convId → { messages, complet }.
  const [fils, setFils] = useState({});
  const [convActiveId, setConvActiveIdEtat] = useState(null);
  // La page messagerie est-elle à l'écran ? (lecture automatique)
  const [vueOuverte, setVueOuverte] = useState(false);
  // Navigation de la page : onglet et annonce ouverte (pilotés aussi par
  // le bandeau d'alertes et les notifications).
  const [onglet, setOnglet] = useState("discussions");
  const [annonceActiveId, setAnnonceActiveId] = useState(null);

  const annuaire = useMemo(() => new Map(annuaireListe.map((c) => [c.id, c])), [annuaireListe]);
  const boiteParId = useMemo(() => new Map(boite.map((c) => [c.id, c])), [boite]);

  // Références pour les rappels temps réel (évite les fermetures périmées).
  const etat = useRef({});
  useLayoutEffect(() => {
    etat.current = { convActiveId, vueOuverte, boiteParId, fils, pret };
  });

  // ── Lecture ──
  const minuteurLu = useRef(null);
  const marquerConvLue = useCallback((convId) => {
    if (!convId) return;
    const maintenant = new Date().toISOString();
    setBoite((liste) => liste.map((c) => (c.id !== convId ? c : {
      ...c, non_lus: 0, dernier_lu_at: maintenant,
      membres: (c.membres || []).map((m) => (m.id === moi ? { ...m, lu: maintenant } : m)),
    })));
    clearTimeout(minuteurLu.current);
    minuteurLu.current = setTimeout(() => api.marquerLu(convId).catch(() => {}), 600);
  }, [moi]);

  const lectureAutorisee = () => etat.current.vueOuverte
    && (typeof document === "undefined" || document.visibilityState === "visible");

  // ── Chargements ──
  const chargerBoite = useCallback(async () => {
    try {
      const liste = await api.chargerBoite();
      setBoite(liste);
      setErreur("");
      // Discussion à l'écran qui a reçu des messages : elle devient lue.
      const active = etat.current.convActiveId;
      if (active && lectureAutorisee() && liste.find((c) => c.id === active)?.non_lus) marquerConvLue(active);
    } catch (e) {
      setErreur(/msg_boite|function|relation/i.test(e.message)
        ? "Messagerie pas encore installée sur le serveur (supabase/messagerie-v2.sql)."
        : (e.message || "Messagerie indisponible."));
    }
  }, [marquerConvLue]);

  const chargerAnnonces = useCallback(async () => {
    try {
      const [{ annonces: liste, lus }, stats] = await Promise.all([api.chargerAnnonces(), api.chargerStatsAnnonces()]);
      setAnnonces(liste);
      setLusAnnonces(lus);
      setStatsAnnonces(stats);
    } catch { /* l'erreur de la boîte suffit à l'écran */ }
  }, []);

  const chargerTout = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    await Promise.all([
      api.chargerAnnuaire().then(setAnnuaireListe).catch(() => {}),
      chargerBoite(),
      chargerAnnonces(),
    ]);
    setPret(true);
  }, [chargerBoite, chargerAnnonces]);

  // Rechargement de la boîte groupé (rafale de messages → une requête).
  const minuteurBoite = useRef(null);
  const planifierBoite = useCallback(() => {
    clearTimeout(minuteurBoite.current);
    minuteurBoite.current = setTimeout(chargerBoite, 400);
  }, [chargerBoite]);

  // La page Messagerie s'affiche / se ferme. Ouverte avant le chargement
  // différé : on n'attend pas.
  const definirVueOuverte = useCallback((ouverte) => {
    etat.current.vueOuverte = ouverte;
    setVueOuverte(ouverte);
    if (!ouverte) return;
    if (!etat.current.pret) { chargerTout(); return; }
    const active = etat.current.convActiveId;
    if (active && etat.current.boiteParId.get(active)?.non_lus) marquerConvLue(active);
  }, [chargerTout, marquerConvLue]);

  // ── Fils de messages ──
  const ajouterAuFil = useCallback((convId, messagesAjoutes, { enTete = false, complet } = {}) => {
    setFils((tous) => {
      const actuel = tous[convId] || { messages: [], complet: false };
      const connus = new Set(actuel.messages.map((m) => m.id));
      const nouveaux = messagesAjoutes.filter((m) => !connus.has(m.id));
      const messages = enTete ? [...nouveaux, ...actuel.messages] : [...actuel.messages, ...nouveaux];
      messages.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      return { ...tous, [convId]: { messages, complet: complet ?? actuel.complet } };
    });
  }, []);

  const remplacerDansFil = useCallback((message) => {
    setFils((tous) => {
      const actuel = tous[message.conversation_id];
      if (!actuel) return tous;
      return {
        ...tous,
        [message.conversation_id]: {
          ...actuel,
          messages: actuel.messages.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
        },
      };
    });
  }, []);

  // Derniers messages d'une discussion, fusionnés au fil déjà chargé (on
  // rafraîchit à chaque ouverture : un événement temps réel a pu être manqué
  // pendant une coupure réseau).
  const chargerFil = useCallback(async (convId) => {
    try {
      const messages = await api.chargerMessages(convId);
      const deja = !!etat.current.fils[convId];
      ajouterAuFil(convId, messages, deja ? {} : { complet: messages.length < 40 });
    } catch (e) {
      setErreur(e.message || "Chargement des messages impossible.");
    }
  }, [ajouterAuFil]);

  const chargerPlusAnciens = useCallback(async (convId) => {
    const actuel = etat.current.fils[convId];
    const plusAncien = actuel?.messages[0]?.created_at;
    if (!plusAncien || actuel.complet) return;
    try {
      const messages = await api.chargerMessages(convId, { avant: plusAncien });
      ajouterAuFil(convId, messages, { enTete: true, complet: messages.length < 40 });
    } catch (e) {
      setErreur(e.message || "Chargement impossible.");
    }
  }, [ajouterAuFil]);

  const ouvrirConversation = useCallback((convId) => {
    setConvActiveIdEtat(convId);
    if (!convId) return;
    chargerFil(convId);
    if (etat.current.boiteParId.get(convId)?.non_lus) marquerConvLue(convId);
  }, [chargerFil, marquerConvLue]);

  // Ouverture ciblée (notification, bandeau) : { onglet, id }.
  const appliquerDemande = useCallback((demande) => {
    if (demande.onglet === "annonces") {
      setOnglet("annonces");
      if (demande.id) setAnnonceActiveId(demande.id);
    } else {
      setOnglet("discussions");
      if (demande.id) ouvrirConversation(demande.id);
    }
  }, [ouvrirConversation]);

  // ── Envoi ──
  const pousserNotification = useCallback((conv, apercu) => {
    if (!conv) return; // boîte pas encore chargée : le message est parti, sans push
    const destinataires = (conv?.membres || [])
      .filter((m) => m.id !== moi && !m.sourdine)
      .map((m) => annuaire.get(m.id)?.user_id);
    const groupe = conv?.type === "groupe";
    api.notifier(destinataires,
      groupe ? `💬 ${titreConversation(conv, annuaire, moi)}` : `💬 ${nomMoi || "Message"}`,
      groupe ? `${nomMoi} : ${apercu}` : apercu,
      `/?messagerie=${conv.id}`);
  }, [annuaire, moi, nomMoi]);

  const ecoleIdSure = useCallback(async () => {
    if (ecoleId) return ecoleId;
    const id = await resoudreEcoleId(schoolCode);
    if (!id) throw new Error("École introuvable.");
    setEcoleId(id);
    return id;
  }, [ecoleId, schoolCode]);

  const envoyerTexte = useCallback(async (convId, corps, reponseA = null) => {
    const message = await api.envoyerTexte({ conversationId: convId, ecoleId: await ecoleIdSure(), moi, corps, reponseA });
    ajouterAuFil(convId, [message]);
    planifierBoite();
    pousserNotification(etat.current.boiteParId.get(convId), apercuMessage(message));
    return message;
  }, [ajouterAuFil, ecoleIdSure, moi, planifierBoite, pousserNotification]);

  const envoyerVocal = useCallback(async (convId, { blob, duree }, reponseA = null) => {
    const message = await api.envoyerVocal({ conversationId: convId, ecoleId: await ecoleIdSure(), moi, blob, duree, reponseA });
    ajouterAuFil(convId, [message]);
    planifierBoite();
    pousserNotification(etat.current.boiteParId.get(convId), apercuMessage(message));
    return message;
  }, [ajouterAuFil, ecoleIdSure, moi, planifierBoite, pousserNotification]);

  const modifierMessage = useCallback(async (message, corps) => {
    await api.modifierMessage(message.id, corps);
    remplacerDansFil({ ...message, corps: corps.trim(), modifie_at: new Date().toISOString() });
    planifierBoite();
  }, [planifierBoite, remplacerDansFil]);

  const supprimerMessage = useCallback(async (message) => {
    await api.supprimerMessage(message.id);
    remplacerDansFil({ ...message, supprime: true, corps: null, audio_path: null });
    planifierBoite();
  }, [planifierBoite, remplacerDansFil]);

  // ── Discussions ──
  const ouvrirDirecteAvec = useCallback(async (compteId) => {
    const id = await api.ouvrirDirecte(compteId);
    await chargerBoite();
    ouvrirConversation(id);
    return id;
  }, [chargerBoite, ouvrirConversation]);

  const creerGroupe = useCallback(async (titre, membres) => {
    const id = await api.creerGroupe(titre, membres);
    await chargerBoite();
    ouvrirConversation(id);
    return id;
  }, [chargerBoite, ouvrirConversation]);

  const actionGroupe = useCallback(async (fn) => {
    await fn();
    await chargerBoite();
  }, [chargerBoite]);

  const definirPreferences = useCallback(async (convId, prefs) => {
    setBoite((liste) => liste.map((c) => (c.id === convId ? { ...c, ...prefs } : c)));
    try { await api.definirPreferences(convId, prefs); } catch (e) { setErreur(e.message); chargerBoite(); }
  }, [chargerBoite]);

  // ── Annonces ──
  const publierAnnonce = useCallback(async (donnees) => {
    const annonce = await api.publierAnnonce({ ...donnees, ecoleId: await ecoleIdSure(), moi });
    await chargerAnnonces();
    const destinataires = destinatairesAnnonce(donnees.cible, annuaireListe, moi);
    const p = PRIORITES[annonce.priorite] || PRIORITES.normale;
    api.notifier(destinataires.map((c) => c.user_id),
      `${p.icone} ${annonce.titre || "Nouvelle annonce"}`,
      `${nomMoi} : ${apercuMessage(annonce)}`,
      `/?annonce=${annonce.id}`);
    return annonce;
  }, [annuaireListe, chargerAnnonces, ecoleIdSure, moi, nomMoi]);

  const lireAnnonce = useCallback(async (annonce, confirmer = false) => {
    if (annonce.de_compte_id === moi) return;
    const deja = lusAnnonces.get(annonce.id);
    if (deja && (!confirmer || deja.confirme_at)) return;
    const maintenant = new Date().toISOString();
    setLusAnnonces((m) => new Map(m).set(annonce.id, {
      annonce_id: annonce.id, lu_at: deja?.lu_at || maintenant,
      confirme_at: confirmer ? maintenant : deja?.confirme_at || null,
    }));
    try { await api.lireAnnonce(annonce.id, confirmer); } catch (e) { setErreur(e.message); }
  }, [lusAnnonces, moi]);

  // Relance : nouvelle notification aux destinataires qui n'ont pas lu.
  const relancerAnnonce = useCallback(async (annonce) => {
    const suivi = await api.suiviAnnonce(annonce.id);
    const retardataires = suivi.filter((s) => (annonce.accuse_requis ? !s.confirme_at : !s.lu_at));
    api.notifier(retardataires.map((s) => s.user_id),
      `🔔 Rappel : ${annonce.titre || "annonce"}`,
      annonce.accuse_requis ? "Merci de confirmer votre lecture." : "Annonce non encore lue.",
      `/?annonce=${annonce.id}`);
    return retardataires.length;
  }, []);

  const epinglerAnnonce = useCallback(async (annonce, epinglee) => {
    await api.epinglerAnnonce(annonce.id, epinglee);
    setAnnonces((liste) => liste.map((a) => (a.id === annonce.id ? { ...a, epinglee } : a)));
  }, []);

  const supprimerAnnonce = useCallback(async (annonce) => {
    await api.supprimerAnnonce(annonce.id);
    setAnnonces((liste) => liste.filter((a) => a.id !== annonce.id));
  }, []);

  // ── Démarrage, rafraîchissement, temps réel ──
  useEffect(() => {
    if (!actif) return undefined;
    const demarrage = setTimeout(chargerTout, DELAI_DEMARRAGE_MS);
    const periodique = setInterval(chargerTout, RAFRAICHISSEMENT_MS);
    const auRetour = () => { if (document.visibilityState === "visible") chargerTout(); };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("online", chargerTout);
    return () => {
      clearTimeout(demarrage);
      clearInterval(periodique);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("online", chargerTout);
    };
  }, [actif, chargerTout]);


  useEffect(() => {
    if (!actif || !schoolCode) return undefined;
    const surMessage = (payload) => {
      const m = payload?.new;
      if (!m?.id || !m.conversation_id) return;
      if (payload.eventType === "INSERT") {
        if (etat.current.fils[m.conversation_id]) ajouterAuFil(m.conversation_id, [m]);
        if (m.conversation_id === etat.current.convActiveId && m.de_compte_id !== moi && lectureAutorisee()) {
          marquerConvLue(m.conversation_id);
        }
      } else if (payload.eventType === "UPDATE") {
        remplacerDansFil(m);
      }
      planifierBoite();
    };
    // Accusés « Lu par » en direct ; ajout / retrait de membres → boîte.
    const surMembre = (payload) => {
      const m = payload?.new;
      if (payload.eventType === "UPDATE" && m?.conversation_id) {
        setBoite((liste) => liste.map((c) => (c.id !== m.conversation_id ? c : {
          ...c,
          membres: (c.membres || []).map((x) => (x.id === m.compte_id
            ? { ...x, lu: m.dernier_lu_at, admin: m.admin, sourdine: m.sourdine } : x)),
          ...(m.compte_id === moi ? { archive: m.archive, epingle: m.epingle, sourdine: m.sourdine, admin: m.admin } : {}),
        })));
      } else {
        planifierBoite();
      }
    };
    const detacher = [
      subscribeTablePayload(schoolCode, "msg_messages", surMessage),
      subscribeTablePayload(schoolCode, "msg_membres", surMembre),
      subscribeTablePayload(schoolCode, "msg_annonces", () => chargerAnnonces()),
    ];
    return () => detacher.forEach((fn) => fn());
  }, [actif, schoolCode, moi, ajouterAuFil, remplacerDansFil, planifierBoite, marquerConvLue, chargerAnnonces]);


  const annoncesNonLues = annonces.filter((a) => annonceNonLue(a, lusAnnonces, moi)).length;
  const alertes = useMemo(() => annoncesEnAlerte(annonces, lusAnnonces, moi), [annonces, lusAnnonces, moi]);
  const nonLusDiscussions = totalNonLus(boite);

  return {
    moi, nomMoi, pret, erreur, setErreur,
    annuaire, annuaireListe, boite, boiteParId, fils,
    convActiveId, ouvrirConversation, chargerPlusAnciens,
    vueOuverte, setVueOuverte: definirVueOuverte, onglet, setOnglet, annonceActiveId, setAnnonceActiveId, appliquerDemande,
    envoyerTexte, envoyerVocal, modifierMessage, supprimerMessage,
    ouvrirDirecteAvec, creerGroupe, actionGroupe, definirPreferences,
    annonces, lusAnnonces, statsAnnonces, alertes, annoncesNonLues,
    publierAnnonce, lireAnnonce, relancerAnnonce, epinglerAnnonce, supprimerAnnonce,
    chargerAnnonces,
    nonLusDiscussions, nonLus: nonLusDiscussions + annoncesNonLues,
  };
}
