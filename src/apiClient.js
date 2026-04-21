import { getCurrentUserIdToken } from "./firebaseAuth";

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
