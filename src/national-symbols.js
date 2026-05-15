// Devises et couleurs du drapeau par pays.
// Utilisé dans les en-têtes officiels des documents imprimés.
//
// Convention : chaque pays a un libellé de devise (3 mots) et 3 couleurs
// du drapeau dans l'ordre traditionnel. Les 3 mots sont stylés chacun
// dans une couleur. Pour les pays bicolores, on duplique la couleur
// principale ou on garde le blanc/noir au milieu.
//
// Pour ajouter un pays : ajouter une entrée. Pour ne pas casser
// l'existant, laisser le fallback "Guinée" tel quel.

const PAYS = {
  guinee: {
    devise: ["Travail", "Justice", "Solidarité"],
    couleurs: ["#CE1126", "#B8860B", "#009460"],
  },
  senegal: {
    devise: ["Un Peuple", "Un But", "Une Foi"],
    couleurs: ["#00853F", "#FDEF42", "#E31B23"],
  },
  mali: {
    devise: ["Un Peuple", "Un But", "Une Foi"],
    couleurs: ["#14B53A", "#FCD116", "#CE1126"],
  },
  cotedivoire: {
    devise: ["Union", "Discipline", "Travail"],
    couleurs: ["#FF8200", "#6b7280", "#009E60"],
  },
  mauritanie: {
    devise: ["Honneur", "Fraternité", "Justice"],
    couleurs: ["#006233", "#FFD700", "#D01C1F"],
  },
  burkinafaso: {
    devise: ["Unité", "Progrès", "Justice"],
    couleurs: ["#EF2B2D", "#FCD116", "#009E49"],
  },
  benin: {
    devise: ["Fraternité", "Justice", "Travail"],
    couleurs: ["#008751", "#FCD116", "#E8112D"],
  },
  togo: {
    devise: ["Travail", "Liberté", "Patrie"],
    couleurs: ["#006A4E", "#FFCE00", "#D21034"],
  },
  niger: {
    devise: ["Fraternité", "Travail", "Progrès"],
    couleurs: ["#E05206", "#6b7280", "#0DB02B"],
  },
  france: {
    devise: ["Liberté", "Égalité", "Fraternité"],
    couleurs: ["#0055A4", "#6b7280", "#EF4135"],
  },
  maroc: {
    devise: ["الله", "الوطن", "الملك"],
    couleurs: ["#C1272D", "#006233", "#C1272D"],
  },
  algerie: {
    devise: ["بالشعب", "و", "للشعب"],
    couleurs: ["#006233", "#6b7280", "#D21034"],
  },
  tunisie: {
    devise: ["حرية", "نظام", "عدالة"],
    couleurs: ["#E70013", "#6b7280", "#E70013"],
  },
};

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

// Résout un libellé de pays libre vers une clé connue.
// Retourne null si pays inconnu (caller décide du fallback).
export function resolvePaysKey(paysLibre) {
  const n = normalize(paysLibre);
  if (!n) return null;
  // alias courants
  if (n.includes("guinee") || n === "guinea") return "guinee";
  if (n.includes("senegal")) return "senegal";
  if (n.includes("mali")) return "mali";
  if (n.includes("ivoire") || n.includes("cotediv")) return "cotedivoire";
  if (n.includes("mauritan")) return "mauritanie";
  if (n.includes("burkina")) return "burkinafaso";
  if (n.includes("benin")) return "benin";
  if (n.includes("togo")) return "togo";
  if (n.includes("niger") && !n.includes("nigeria")) return "niger";
  if (n.includes("france") || n.includes("francaise")) return "france";
  if (n.includes("maroc") || n.includes("morocco")) return "maroc";
  if (n.includes("algerie") || n.includes("algeria")) return "algerie";
  if (n.includes("tunisie") || n.includes("tunisia")) return "tunisie";
  return null;
}

// Retourne { devise: [m1,m2,m3], couleurs: [c1,c2,c3] } ou null si pays inconnu.
export function getNationalSymbols(paysLibre) {
  const key = resolvePaysKey(paysLibre);
  return key ? PAYS[key] : null;
}

// HTML coloré de la devise nationale, prêt à être injecté dans les
// templates imprimables. Force `print-color-adjust:exact` pour conserver
// les couleurs à l'impression.
//
// Fallback : si le pays n'est pas reconnu, retourne juste la devise de
// la Guinée (comportement historique) — l'utilisateur peut ajouter
// son pays au mapping si nécessaire.
export function getNationalDeviseHTML(paysLibre) {
  const sym = getNationalSymbols(paysLibre) || PAYS.guinee;
  const [m1, m2, m3] = sym.devise;
  const [c1, c2, c3] = sym.couleurs;
  return `<em style="-webkit-print-color-adjust:exact;print-color-adjust:exact">`
    + `<span style="color:${c1};font-weight:700">${m1}</span> - `
    + `<span style="color:${c2};font-weight:700">${m2}</span> - `
    + `<span style="color:${c3};font-weight:700">${m3}</span>`
    + `</em>`;
}
