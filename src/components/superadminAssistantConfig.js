export const SUPERADMIN_ASSISTANT_HISTORY_KEY = "LC_superadminAssistantHistory";
export const MAX_SUPERADMIN_HISTORY = 8;

export const SUPERADMIN_ASSISTANT_PRESETS = [
  {
    id: "support_connexion",
    title: "Reponse support connexion",
    mode: "support",
    schoolName: "",
    context: "Des utilisateurs signalent un probleme de connexion.",
    prompt: "Redige une reponse calme et professionnelle a envoyer a une ecole qui n'arrive plus a se connecter depuis ce matin. Propose 3 verifications simples, puis dis que l'equipe continue l'analyse.",
  },
  {
    id: "annonce_maintenance",
    title: "Annonce maintenance",
    mode: "annonce",
    schoolName: "",
    context: "Maintenance planifiee de la plateforme.",
    prompt: "Redige une annonce courte pour prevenir les ecoles d'une maintenance samedi a 8h UTC. Precise que l'acces peut etre perturbe pendant 45 minutes et remercie-les pour leur patience.",
  },
  {
    id: "incident_resume",
    title: "Resume incident",
    mode: "incident",
    schoolName: "",
    context: "Incident en cours avec impact utilisateur.",
    prompt: "Fais un resume d'incident a partir des elements suivants, puis propose les causes probables et les prochaines actions. Reste factuel, prudent et lisible par une equipe non technique.",
  },
  {
    id: "relance_commerciale",
    title: "Relance commerciale",
    mode: "commercial",
    schoolName: "",
    context: "Une ecole a demande des informations puis n'a plus repondu.",
    prompt: "Redige un message de relance commercial court, respectueux et sans pression a destination d'un directeur d'ecole qui a montre de l'interet pour EduGest mais n'a pas encore finalise son choix.",
  },
];

export function buildAssistantHistoryEntry({ mode, schoolName, context, prompt, result, now = Date.now() }) {
  return {
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    mode: typeof mode === "string" ? mode : "support",
    schoolName: typeof schoolName === "string" ? schoolName.trim() : "",
    context: typeof context === "string" ? context.trim() : "",
    prompt: typeof prompt === "string" ? prompt.trim() : "",
    result: typeof result === "string" ? result.trim() : "",
  };
}

export function sanitizeAssistantHistoryEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      id: typeof entry.id === "string" && entry.id ? entry.id : `history_${index}`,
      createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : 0,
      mode: typeof entry.mode === "string" && entry.mode ? entry.mode : "support",
      schoolName: typeof entry.schoolName === "string" ? entry.schoolName.trim() : "",
      context: typeof entry.context === "string" ? entry.context.trim() : "",
      prompt: typeof entry.prompt === "string" ? entry.prompt.trim() : "",
      result: typeof entry.result === "string" ? entry.result.trim() : "",
    }))
    .filter((entry) => entry.prompt && entry.result)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_SUPERADMIN_HISTORY);
}
