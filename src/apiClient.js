import { auth } from "./firebase";

export async function getAuthHeaders(baseHeaders = {}) {
  const user = auth.currentUser;

  if (!user) {
    return baseHeaders;
  }

  try {
    const token = await user.getIdToken();
    return {
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return baseHeaders;
  }
}
