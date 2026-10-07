// ══════════════════════════════════════════════════════════════
//  Messagerie interne — logique pure (sans React ni réseau)
// ══════════════════════════════════════════════════════════════
// Titres de discussion, accusés « Lu par », regroupement par jour, libellés
// d'appels, tri/filtre de la boîte et ciblage des annonces. Testé dans
// tests/messagerie-logic.test.js.

// Compte hors messagerie (transversal). Les parents y entrent depuis leur
// portail (supabase/messagerie-parents.sql).
export const ROLES_SANS_MESSAGERIE = new Set(["superadmin"]);

export const messagerieOuverteA = (utilisateur) =>
  !!utilisateur?.compteDocId && !ROLES_SANS_MESSAGERIE.has(utilisateur.role);

export const estParent = (utilisateur) => utilisateur?.role === "parent";

// Enseignants et parents discutent et appellent, mais ne publient pas
// d'annonces (la base l'interdit aussi : policy msg_annonces_insert).
export const peutPublierAnnonce = (utilisateur) =>
  messagerieOuverteA(utilisateur) && !["enseignant", "parent"].includes(utilisateur.role);

// Les parents échangent en discussion directe seulement, jamais en groupe.
export const peutCreerGroupe = (utilisateur) => messagerieOuverteA(utilisateur) && !estParent(utilisateur);

// Suivi détaillé d'une annonce : son auteur, la direction, l'administration.
export const peutGererAnnonce = (annonce, utilisateur) =>
  !!annonce && (annonce.de_compte_id === utilisateur?.compteDocId
    || ["direction", "admin"].includes(utilisateur?.role));

// ── Discussions ──
export const autresMembres = (conv, moi) => (conv?.membres || []).filter((m) => m.id !== moi);

export function titreConversation(conv, annuaire, moi) {
  if (!conv) return "";
  if (conv.type === "groupe") return conv.titre || "Groupe";
  const autre = autresMembres(conv, moi)[0];
  return (autre && annuaire.get(autre.id)?.nom) || "Compte retiré";
}

export function sousTitreConversation(conv, annuaire, moi) {
  if (!conv) return "";
  if (conv.type === "groupe") return `${(conv.membres || []).length} membres`;
  const autre = autresMembres(conv, moi)[0];
  return (autre && annuaire.get(autre.id)?.poste) || "";
}

// Membres (hors expéditeur) ayant lu le message : leur dernier_lu_at est
// postérieur ou égal à la date du message.
export function lecteursMessage(message, conv) {
  const t = Date.parse(message?.created_at);
  if (!conv || Number.isNaN(t)) return [];
  return (conv.membres || [])
    .filter((m) => m.id !== message.de_compte_id && m.lu && Date.parse(m.lu) >= t)
    .map((m) => m.id);
}

// Accusé d'un message envoyé : { lus, total } (total = destinataires).
export function accuseLecture(message, conv) {
  const total = (conv?.membres || []).filter((m) => m.id !== message.de_compte_id).length;
  return { lus: lecteursMessage(message, conv).length, total };
}

// Épinglées d'abord, puis la plus récente activité.
export function trierConversations(convs) {
  return [...convs].sort((a, b) =>
    (Number(!!b.epingle) - Number(!!a.epingle))
    || (Date.parse(b.dernier_message_at) - Date.parse(a.dernier_message_at)));
}

// Une discussion directe ouverte par l'AUTRE mais encore vide n'apparaît pas
// (il a cliqué sur votre nom sans rien écrire).
export const conversationVisible = (conv, moi) =>
  conv.type === "groupe" || !!conv.dernier_apercu || conv.cree_par === moi;

export function filtrerConversations(convs, { archivees = false, recherche = "", titre = () => "", moi = null } = {}) {
  const terme = normaliser(recherche);
  return trierConversations(convs.filter((c) =>
    !!c.archive === archivees
    && conversationVisible(c, moi)
    && (!terme || normaliser(titre(c)).includes(terme) || normaliser(c.dernier_apercu).includes(terme))));
}

// Badge : non-lus des discussions ni en sourdine ni archivées.
export const totalNonLus = (convs) =>
  convs.reduce((n, c) => n + (c.sourdine || c.archive ? 0 : (c.non_lus || 0)), 0);

// ── Dates & durées ──
const jourCle = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function libelleJour(iso, maintenant = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (jourCle(d) === jourCle(maintenant)) return "Aujourd'hui";
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (jourCle(d) === jourCle(hier)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
    ...(d.getFullYear() !== maintenant.getFullYear() ? { year: "numeric" } : {}),
  });
}

// Fil de discussion → éléments à afficher : séparateurs de jour + messages,
// avec `suite` quand le message prolonge celui du même auteur (< 5 min).
export function construireFil(messages, maintenant = new Date()) {
  const items = [];
  let jourPrecedent = null;
  let precedent = null;
  for (const m of messages) {
    const d = new Date(m.created_at);
    const cle = jourCle(d);
    if (cle !== jourPrecedent) {
      items.push({ type: "jour", cle: `jour-${cle}`, libelle: libelleJour(m.created_at, maintenant) });
      jourPrecedent = cle;
      precedent = null;
    }
    const suite = !!precedent
      && precedent.de_compte_id === m.de_compte_id
      && precedent.type !== "systeme" && m.type !== "systeme"
      && d - new Date(precedent.created_at) < 5 * 60000;
    items.push({ type: "message", cle: m.id, message: m, suite });
    precedent = m;
  }
  return items;
}

export function formatHeure(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Date courte de la boîte : heure aujourd'hui, « Hier », sinon jj/mm.
export function formatDateBoite(iso, maintenant = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (jourCle(d) === jourCle(maintenant)) return formatHeure(iso);
  const libelle = libelleJour(iso, maintenant);
  if (libelle === "Hier") return libelle;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// 75 → « 1:15 » (chronomètres).
export function formatChrono(secondes) {
  const s = Math.max(0, Math.floor(secondes || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// 192 → « 3 min 12 s » ; 40 → « 40 s ».
export function formatDuree(secondes) {
  const s = Math.max(0, Math.floor(secondes || 0));
  const min = Math.floor(s / 60);
  return min ? `${min} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

// Trace d'appel (corps 'termine:192' | 'manque' | 'refuse' | 'occupe' | 'echec').
export function libelleAppel(corps, sortant) {
  const [statut, duree, participants] = String(corps || "").split(":");
  if (statut === "reunion") {
    const n = Number(participants) || 0;
    return `Appel de groupe · ${formatDuree(Number(duree))} · ${n} participant${n > 1 ? "s" : ""}`;
  }
  if (statut === "termine") return `${sortant ? "Appel sortant" : "Appel entrant"} · ${formatDuree(Number(duree))}`;
  if (statut === "refuse") return "Appel refusé";
  if (statut === "occupe") return sortant ? "Correspondant occupé" : "Appel reçu pendant un autre appel";
  if (statut === "echec") return duree ? `Appel interrompu · ${formatDuree(Number(duree))}` : "Appel interrompu";
  return sortant ? "Appel sans réponse" : "Appel manqué";
}

// ── Annonces ──
export const PRIORITES = {
  normale: { libelle: "Normale", couleur: "#64748b", fond: "#f1f5f9", icone: "📣" },
  importante: { libelle: "Importante", couleur: "#b45309", fond: "#fef3c7", icone: "⚠️" },
  urgente: { libelle: "Urgente", couleur: "#b91c1c", fond: "#fee2e2", icone: "🔴" },
};

// Enfants d'un parent de l'annuaire, et clé de classe 'section|classe'
// (même format que msg_annonces.a_parents_classes).
const enfantsDe = (compte) => (Array.isArray(compte?.enfants) ? compte.enfants : []);
export const cleClasse = (section, classe) => `${section}|${classe || ""}`;

// Le parent est-il visé par les cibles « parents » ? (msg_parent_vise)
export function parentVise(compte, cible) {
  const sections = new Set(cible?.parentsSections || []);
  const classes = new Set(cible?.parentsClasses || []);
  return enfantsDe(compte).some((e) => cible?.parents || sections.has(e.section) || classes.has(cleClasse(e.section, e.classe)));
}

// Comptes de l'annuaire visés par une cible d'annonce (aperçu du nombre de
// destinataires, notifications push). Même règle que la base
// (msg_annonce_destinataires) : « Toute l'équipe », le personnel et les
// postes ne visent jamais les parents.
export function destinatairesAnnonce(cible, annuaireListe, moi) {
  const postes = new Set(cible?.postes || []);
  const comptes = new Set(cible?.comptes || []);
  return annuaireListe.filter((c) => c.id !== moi && (c.role === "parent"
    ? comptes.has(c.id) || parentVise(c, cible)
    : cible?.tous
      || (cible?.personnel && c.role !== "enseignant")
      || (cible?.enseignants && c.role === "enseignant")
      || postes.has(c.poste_cle)
      || comptes.has(c.id)));
}

export const cibleDepuisAnnonce = (a) => ({
  tous: a.a_tous, personnel: a.a_personnel, enseignants: a.a_enseignants,
  postes: a.a_postes || [], comptes: a.a_comptes || [],
  parents: !!a.a_parents, parentsSections: a.a_parents_sections || [], parentsClasses: a.a_parents_classes || [],
});

// Sections (clé → libellé) des annonces aux parents.
export const LIBELLES_SECTIONS = { prescolaire: "Maternelle", primaire: "Primaire", college: "Collège", lycee: "Lycée" };
const ORDRE_SECTIONS = Object.keys(LIBELLES_SECTIONS);

// Classes des enfants des parents de l'annuaire (dans le périmètre) :
// [{ cle, section, classe, parents }], par section puis par classe.
export function classesDesParents(annuaireListe) {
  const classes = new Map();
  for (const c of annuaireListe) {
    if (c.role !== "parent") continue;
    for (const e of enfantsDe(c)) {
      const cle = cleClasse(e.section, e.classe);
      const ligne = classes.get(cle) || { cle, section: e.section, classe: e.classe || "Sans classe", parents: new Set() };
      ligne.parents.add(c.id);
      classes.set(cle, ligne);
    }
  }
  return [...classes.values()]
    .map((l) => ({ ...l, parents: l.parents.size }))
    .sort((a, b) => (ORDRE_SECTIONS.indexOf(a.section) - ORDRE_SECTIONS.indexOf(b.section))
      || a.classe.localeCompare(b.classe, "fr", { numeric: true }));
}

export function libelleCibleAnnonce(annonce, annuaire, postesLabels = new Map()) {
  const parts = [];
  if (annonce.a_tous) parts.push("Toute l'équipe");
  if (annonce.a_personnel) parts.push("Personnel administratif");
  if (annonce.a_enseignants) parts.push("Enseignants");
  for (const cle of annonce.a_postes || []) parts.push(postesLabels.get(cle) || cle);
  if (annonce.a_parents) parts.push("Tous les parents");
  for (const s of annonce.a_parents_sections || []) parts.push(`Parents — ${LIBELLES_SECTIONS[s] || s}`);
  for (const cle of annonce.a_parents_classes || []) parts.push(`Parents — ${cle.split("|").slice(1).join("|")}`);
  for (const id of annonce.a_comptes || []) parts.push(annuaire.get(id)?.nom || "Un compte");
  return parts.join(", ");
}

// Épinglées d'abord, puis urgentes non lues, puis les plus récentes.
export function trierAnnonces(annonces, lus) {
  const rang = (a) => (a.epinglee ? 2 : 0) + (a.priorite === "urgente" && !lus.has(a.id) ? 1 : 0);
  return [...annonces].sort((a, b) => (rang(b) - rang(a)) || (Date.parse(b.created_at) - Date.parse(a.created_at)));
}

export const annonceNonLue = (a, lus, moi) => a.de_compte_id !== moi && !lus.has(a.id);

export const annonceAConfirmer = (a, lus, moi) =>
  a.de_compte_id !== moi && a.accuse_requis && !lus.get(a.id)?.confirme_at;

// Bandeau d'alerte : annonces à confirmer, ou urgentes pas encore lues.
export const annoncesEnAlerte = (annonces, lus, moi) =>
  annonces.filter((a) => annonceAConfirmer(a, lus, moi)
    || (a.priorite === "urgente" && annonceNonLue(a, lus, moi)));

// ── Divers ──
export function normaliser(texte) {
  return String(texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function initiales(nom) {
  const mots = String(nom || "?").trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] || "?") + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase();
}

const TEINTES = [210, 160, 25, 280, 340, 190, 45, 120];
export function couleurAvatar(id) {
  let h = 0;
  for (const c of String(id || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${TEINTES[h % TEINTES.length]} 55% 45%)`;
}

// Extrait de citation (réponse à un message).
export function apercuMessage(message) {
  if (!message) return "";
  if (message.supprime) return "Message supprimé";
  if (message.type === "audio") return `🎤 Message vocal (${formatChrono(message.audio_duree)})`;
  if (message.type === "fichier") return `📎 ${message.fichier_nom || "Document"}`;
  const t = String(message.corps || "");
  return t.length > 90 ? `${t.slice(0, 90)}…` : t;
}

// Entrée de menu du shell (hors carte de permissions des postes : tout
// compte du périmètre y a accès).
export const MODULE_MESSAGERIE = { id: "messagerie", label: "Messagerie", icon: "💬", desc: "Discussions & annonces" };

// Postes présents dans l'annuaire (hors enseignants et parents) : clé → libellé.
export function postesDeLAnnuaire(annuaireListe) {
  const postes = new Map();
  for (const c of annuaireListe) {
    if (c.role !== "enseignant" && c.role !== "parent" && c.poste_cle && !postes.has(c.poste_cle)) postes.set(c.poste_cle, c.poste);
  }
  return postes;
}

// ── Présence ──
export const COULEURS_PRESENCE = { actif: "#22c55e", absent: "#f59e0b" };

// { etat, depuis } → « En ligne », « Absent », « Vu il y a 12 min »… ;
// "" si le compte n'a jamais ouvert l'application depuis la mise en place.
export function libellePresence(presence) {
  if (!presence) return "";
  if (presence.etat === "actif") return "En ligne";
  if (presence.etat === "absent") return "Absent";
  const s = Math.max(0, presence.depuis || 0);
  if (s < 90) return "Vu à l'instant";
  if (s < 3600) return `Vu il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `Vu il y a ${Math.floor(s / 3600)} h`;
  const jours = Math.floor(s / 86400);
  return jours === 1 ? "Vu hier" : `Vu il y a ${jours} jours`;
}

export const estJoignable = (presence) => presence?.etat === "actif" || presence?.etat === "absent";

// Membres d'une discussion (hors soi) actuellement connectés.
export const membresConnectes = (conv, presences, moi) =>
  (conv?.membres || []).filter((m) => m.id !== moi && estJoignable(presences?.get(m.id))).length;

// ── Hiérarchie (supabase/messagerie-hierarchie.sql) ──
// L'annuaire marque les comptes que l'on peut CONTACTER (ouvrir une
// discussion, appeler, inviter dans un groupe, adresser une annonce). Tant
// que le SQL n'est pas appliqué, le champ est absent : tout le monde l'est.
export const peutContacter = (compte) => !!compte && compte.contactable !== false;

export const contactables = (annuaireListe, moi) => annuaireListe.filter((c) => c.id !== moi && peutContacter(c));

// Lancer un appel de groupe : administrateur du groupe, ou responsable de
// tous ses membres (la base applique la même règle).
export const peutLancerAppelGroupe = (conv, annuaire, moi) =>
  !!conv?.admin || (conv?.membres || []).every((x) => x.id === moi || peutContacter(annuaire.get(x.id)));
