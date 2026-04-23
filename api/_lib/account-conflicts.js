const normalizeText = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ");

function matchesParent(candidate, account) {
  const candidateEleveId = String(candidate.eleveId || "").trim();
  const accountEleveId = String(account.eleveId || "").trim();
  if (candidateEleveId && accountEleveId && candidateEleveId === accountEleveId) {
    return true;
  }

  const sameLegacyIdentity = normalizeText(candidate.eleveNom)
    && normalizeText(candidate.eleveNom) === normalizeText(account.eleveNom)
    && normalizeText(candidate.eleveClasse) === normalizeText(account.eleveClasse)
    && normalizeText(candidate.section) === normalizeText(account.section);

  return sameLegacyIdentity && (!candidateEleveId || !accountEleveId);
}

function matchesTeacher(candidate, account) {
  const candidateTeacherId = String(candidate.enseignantId || "").trim();
  const accountTeacherId = String(account.enseignantId || "").trim();
  if (candidateTeacherId && accountTeacherId && candidateTeacherId === accountTeacherId) {
    return true;
  }

  const sameLegacyIdentity = normalizeText(candidate.enseignantNom)
    && normalizeText(candidate.enseignantNom) === normalizeText(account.enseignantNom)
    && normalizeText(candidate.section) === normalizeText(account.section)
    && normalizeText(candidate.matiere) === normalizeText(account.matiere);

  return sameLegacyIdentity && (!candidateTeacherId || !accountTeacherId);
}

export function findLogicalAccountConflict(accounts = [], candidate = {}) {
  if (candidate.role === "parent") {
    const conflict = accounts.find((account) => matchesParent(candidate, account));
    if (conflict) {
      return {
        type: "parent",
        account: conflict,
        error: "Un compte parent existe deja pour cet eleve.",
      };
    }
  }

  if (candidate.role === "enseignant") {
    const conflict = accounts.find((account) => matchesTeacher(candidate, account));
    if (conflict) {
      return {
        type: "enseignant",
        account: conflict,
        error: "Un compte enseignant existe deja pour cette fiche.",
      };
    }
  }

  return null;
}
