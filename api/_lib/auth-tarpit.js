import bcrypt from "bcryptjs";

const DUMMY_BCRYPT_HASH = "$2b$10$hZ4weVkqJhQgc6ItT2wbiO2yogizJm15LGy3v07DW7/LVBW/qR1Rq";

export async function applyPasswordTarpit(password = "") {
  try {
    await bcrypt.compare(String(password || ""), DUMMY_BCRYPT_HASH);
  } catch {
    // Best effort only: the goal is to keep failed logins on a similar code path.
  }
}

