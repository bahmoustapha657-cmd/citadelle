function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length > 9 && digits.startsWith("224")) {
    return digits.slice(-9);
  }
  return digits;
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function buildLegacyStudentLink(source = {}) {
  const eleveId = String(source.eleveId || "").trim();
  const eleveNom = String(source.eleveNom || "").trim();
  const eleveClasse = String(source.eleveClasse || "").trim();
  const section = String(source.section || "").trim();

  if (!eleveId && !eleveNom) {
    return null;
  }

  return {
    eleveId: eleveId || null,
    eleveNom: eleveNom || null,
    eleveClasse: eleveClasse || null,
    section: section || null,
  };
}

function buildStudentLink(source = {}) {
  const eleveId = String(source.eleveId || source.id || source._id || "").trim();
  const eleveNom = String(
    source.eleveNom
      || source.nomComplet
      || [source.prenom, source.nom].filter(Boolean).join(" ")
      || "",
  ).trim();
  const eleveClasse = String(source.eleveClasse || source.classe || "").trim();
  const section = String(source.section || "").trim();

  if (!eleveId && !eleveNom) {
    return null;
  }

  return {
    eleveId: eleveId || null,
    eleveNom: eleveNom || null,
    eleveClasse: eleveClasse || null,
    section: section || null,
  };
}

function getStudentLinkKey(link = {}) {
  const eleveId = String(link.eleveId || "").trim();
  if (eleveId) return `id:${eleveId}`;
  return [
    "legacy",
    normalizeText(link.eleveNom),
    normalizeText(link.eleveClasse),
    normalizeText(link.section),
  ].join("|");
}

export function getParentStudentLinks(source = {}) {
  const links = [];
  const fromArray = Array.isArray(source.elevesAssocies) ? source.elevesAssocies : [];

  fromArray.forEach((entry) => {
    const link = buildStudentLink(entry);
    if (link) links.push(link);
  });

  const legacy = buildLegacyStudentLink(source);
  if (legacy) links.push(legacy);

  const seen = new Set();
  return links.filter((link) => {
    const key = getStudentLinkKey(link);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeParentStudentLinks(existingAccount = {}, candidate = {}) {
  const links = getParentStudentLinks({
    elevesAssocies: [
      ...getParentStudentLinks(existingAccount),
      ...getParentStudentLinks(candidate),
    ],
  });
  const primary = links[0] || null;

  return {
    eleveId: primary?.eleveId || null,
    eleveNom: primary?.eleveNom || null,
    eleveClasse: primary?.eleveClasse || null,
    section: primary?.section || null,
    eleveIds: uniqueStrings(links.map((link) => link.eleveId)),
    elevesAssocies: links,
    sections: uniqueStrings(links.map((link) => link.section)),
  };
}

export function hasSameParentHousehold(candidate = {}, account = {}) {
  const tutorCandidate = normalizeText(candidate.tuteur);
  const tutorAccount = normalizeText(account.tuteur);
  const filiationCandidate = normalizeText(candidate.filiation);
  const filiationAccount = normalizeText(account.filiation);

  if (!tutorCandidate || !filiationCandidate) {
    return false;
  }
  if (tutorCandidate !== tutorAccount || filiationCandidate !== filiationAccount) {
    return false;
  }

  const phoneCandidate = normalizePhone(candidate.contactTuteur);
  const phoneAccount = normalizePhone(account.contactTuteur);
  if (phoneCandidate && phoneAccount && phoneCandidate !== phoneAccount) {
    return false;
  }

  return true;
}

export function extractAccountProfileFields(account = {}) {
  const parentLinks = mergeParentStudentLinks(account, {});

  return {
    section: account.section || parentLinks.section || null,
    sections: Array.isArray(account.sections) ? uniqueStrings(account.sections) : parentLinks.sections,
    eleveId: account.eleveId || parentLinks.eleveId || null,
    eleveNom: account.eleveNom || parentLinks.eleveNom || null,
    eleveClasse: account.eleveClasse || parentLinks.eleveClasse || null,
    eleveIds: Array.isArray(account.eleveIds) ? uniqueStrings(account.eleveIds) : parentLinks.eleveIds,
    elevesAssocies: Array.isArray(account.elevesAssocies) ? getParentStudentLinks(account) : parentLinks.elevesAssocies,
    enseignantId: account.enseignantId || null,
    enseignantNom: account.enseignantNom || null,
    matiere: account.matiere || null,
    tuteur: account.tuteur || null,
    contactTuteur: account.contactTuteur || null,
    filiation: account.filiation || null,
  };
}

export function parentAccountsShareStudent(candidate = {}, account = {}) {
  const accountKeys = new Set(getParentStudentLinks(account).map(getStudentLinkKey));
  return getParentStudentLinks(candidate).some((link) => accountKeys.has(getStudentLinkKey(link)));
}
