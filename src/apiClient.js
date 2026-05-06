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
  const { query, ...fetchOptions } = options || {};
  return fetch(buildApiUrl(path, query), fetchOptions);
}
