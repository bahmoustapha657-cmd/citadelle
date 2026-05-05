import { getParentStudentLinks, mergeParentStudentLinks } from "./account-links.js";
import { getSectionCollections, normalizeSection, toItem } from "./portal-data.js";

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getStudentDisplayName(student = {}) {
  return String(
    student.nomComplet
      || [student.prenom, student.nom].filter(Boolean).join(" ")
      || student.eleveNom
      || "",
  ).trim();
}

function getClassKey(section = "", classe = "") {
  return `${normalizeSection(section)}|${normalizeText(classe)}`;
}

export function resolveParentLegacyLinks({ account = {}, studentsByClass = {} }) {
  const links = getParentStudentLinks(account);
  let didUpdate = false;

  const resolvedLinks = links.map((link) => {
    const section = normalizeSection(link.section || account.section);
    if (link.eleveId) {
      return {
        ...link,
        section,
      };
    }

    const eleveNom = normalizeText(link.eleveNom);
    const eleveClasse = String(link.eleveClasse || "").trim();
    if (!eleveNom || !eleveClasse) {
      return {
        ...link,
        section,
      };
    }

    const candidates = (studentsByClass[getClassKey(section, eleveClasse)] || []).filter((student) => (
      normalizeText(getStudentDisplayName(student)) === eleveNom
    ));

    if (candidates.length !== 1) {
      return {
        ...link,
        section,
      };
    }

    didUpdate = true;
    const student = candidates[0];
    return {
      eleveId: student._id,
      eleveNom: getStudentDisplayName(student) || link.eleveNom || null,
      eleveClasse: student.classe || link.eleveClasse || null,
      section,
    };
  });

  const mergedLinks = mergeParentStudentLinks({ elevesAssocies: resolvedLinks }, {});
  return {
    didUpdate,
    account: {
      ...account,
      ...mergedLinks,
      section: account.section || mergedLinks.section || null,
      sections: Array.isArray(account.sections) && account.sections.length > 0
        ? account.sections
        : mergedLinks.sections,
    },
  };
}

export async function migrateParentAccountLinks({ db, schoolId, account = {} }) {
  const legacyLinks = getParentStudentLinks(account).filter((link) => !link.eleveId);
  if (legacyLinks.length === 0) {
    return {
      didUpdate: false,
      account,
    };
  }

  const schoolRef = db.collection("ecoles").doc(schoolId);
  const classEntries = [];
  const seenKeys = new Set();

  legacyLinks.forEach((link) => {
    const section = normalizeSection(link.section || account.section);
    const classe = String(link.eleveClasse || "").trim();
    if (!section || !classe) return;

    const key = getClassKey(section, classe);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    classEntries.push({ key, section, classe });
  });

  const studentsByClass = {};
  await Promise.all(classEntries.map(async ({ key, section, classe }) => {
    const collections = getSectionCollections(section);
    if (!collections?.eleves) return;

    const snap = await schoolRef.collection(collections.eleves).where("classe", "==", classe).get();
    studentsByClass[key] = snap.docs.map(toItem);
  }));

  return resolveParentLegacyLinks({ account, studentsByClass });
}
