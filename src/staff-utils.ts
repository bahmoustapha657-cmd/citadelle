export type StaffPerson = {
  _id?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  contact?: string;
};

export type StaffDuplicate = {
  type: "phone" | "identity";
  person: StaffPerson;
};

type FindStaffDuplicateOptions = {
  excludeId?: string | null;
};

type GetStaffDuplicateMessageOptions = {
  label?: string;
};

const normalizeText = (value: string = ""): string => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ");

const normalizePhone = (value: string = ""): string => {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length > 9) return digits.slice(-9);
  return digits;
};

const buildIdentityKey = (person: StaffPerson = {}): string => {
  const nom = normalizeText(person.nom);
  const prenom = normalizeText(person.prenom);
  if (!nom || !prenom) return "";
  return `${nom}|${prenom}`;
};

export const findStaffDuplicate = (
  candidate: StaffPerson = {},
  people: StaffPerson[] = [],
  options: FindStaffDuplicateOptions = {},
): StaffDuplicate | null => {
  const excludeId = options.excludeId ?? candidate?._id ?? null;
  const pool = (people || []).filter((person) => person && person._id !== excludeId);

  const phone = normalizePhone(candidate.telephone || candidate.contact);
  if (phone) {
    const existing = pool.find((person) => normalizePhone(person.telephone || person.contact) === phone);
    if (existing) return { type: "phone", person: existing };
  }

  const identityKey = buildIdentityKey(candidate);
  if (identityKey) {
    const existing = pool.find((person) => buildIdentityKey(person) === identityKey);
    if (existing) return { type: "identity", person: existing };
  }

  return null;
};

export const getStaffDuplicateMessage = (
  duplicate: StaffDuplicate | null,
  options: GetStaffDuplicateMessageOptions = {},
): string => {
  if (!duplicate) return "";
  const label = options.label || "cette fiche";
  if (duplicate.type === "phone") {
    return `Doublon detecte: ce numero est deja utilise pour ${label}.`;
  }
  return `Doublon detecte: une fiche avec le meme nom et prenom existe deja pour ${label}.`;
};
