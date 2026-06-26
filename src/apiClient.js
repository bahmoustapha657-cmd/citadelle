import { getCurrentUserIdToken } from "./firebaseAuth";

const RAW_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim();

function trimTrailingSlash(value = "") {
  return String(value).replace(/\/+$/, "");
}

function normalizeApiPath(path = "") {
  const normalized = String(path || "").trim();
  if (!normalized) return "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function appendQuery(url, query) {
  if (!query || typeof query !== "object") {
    return url;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null || entry === "") return;
        url.searchParams.append(key, String(entry));
      });
      return;
    }
    url.searchParams.set(key, String(value));
  });

  return url;
}

export function getApiBaseUrl() {
  return trimTrailingSlash(RAW_API_BASE_URL);
}

export function buildApiUrl(path = "/", query) {
  const normalizedPath = normalizeApiPath(path);
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    const relativeUrl = new URL(`/api${normalizedPath}`, window.location.origin);
    return appendQuery(relativeUrl, query).toString();
  }

  const relativePath = normalizedPath.replace(/^\/+/, "");
  const absoluteUrl = new URL(relativePath, `${baseUrl}/`);
  return appendQuery(absoluteUrl, query).toString();
}

export async function getAuthHeaders(baseHeaders = {}) {
  const token = await getCurrentUserIdToken();
  if (!token) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetch(path, options = {}) {
  const { query, timeoutMs, ...fetchOptions } = options || {};
  const url = buildApiUrl(path, query);
  if (!timeoutMs) return fetch(url, fetchOptions);

  // Garde-fou : sans timeout, une requete qui pend (reseau lent, fonction
  // serverless qui demarre a froid) ferait tourner l'UI indefiniment. On
  // abandonne au-dela de timeoutMs -> fetch rejette -> l'appelant affiche une
  // erreur claire. On respecte un signal deja fourni par l'appelant.
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: fetchOptions.signal || controller.signal });
  } finally {
    clearTimeout(tid);
  }
}
