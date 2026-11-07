// Lecture SEULE de l'ancien Firestore (projet Firebase d'avant la bascule sur
// Supabase), par l'API REST : aucune dépendance Firebase n'est installée
// depuis leur retrait. Sert aux réparations qui ont besoin de l'état d'origine
// (ex. classes de fin 2025-2026, enregistrées avant la promotion).
//
// La clé de service (*firebase-adminsdk*.json, ignorée par git) doit se
// trouver dans ce dossier, comme pour l'ancien script de migration.
import crypto from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

function cleDeService() {
  const fichier = readdirSync(ICI).find((f) => /firebase-adminsdk.*\.json$/.test(f));
  if (!fichier) throw new Error("Clé de service Firebase (*firebase-adminsdk*.json) introuvable dans supabase/.");
  return JSON.parse(readFileSync(join(ICI, fichier), "utf8"));
}

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

async function jeton(svc) {
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: svc.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: maintenant,
    exp: maintenant + 3000,
  })}`;
  const signature = crypto.createSign("RSA-SHA256").update(corps).sign(svc.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${corps}.${signature}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Jeton Firebase refusé : ${JSON.stringify(j)}`);
  return j.access_token;
}

// Valeur typée Firestore → valeur JavaScript.
const valeur = (v) => {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valeur(x)]));
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valeur);
  return null;
};

const champs = (d) => Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, valeur(x)]));

// Lecteur des sous-collections d'une école : lire("elevesPrimaire") → documents
// { _id, ...champs }. Une collection absente renvoie une liste vide.
// lire.ecole() → le document de l'école lui-même (ses réglages).
export async function lecteurFirestore(codeEcole) {
  const svc = cleDeService();
  const token = await jeton(svc);
  const base = `https://firestore.googleapis.com/v1/projects/${svc.project_id}/databases/(default)/documents/ecoles/${codeEcole}`;
  lire.ecole = async () => {
    const j = await (await fetch(base, { headers: { Authorization: `Bearer ${token}` } })).json();
    if (j.error) throw new Error(`Firestore école : ${j.error.message}`);
    return champs(j);
  };
  return lire;
  async function lire(collection) {
    const docs = [];
    let page = "";
    do {
      const url = `${base}/${collection}?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`;
      const j = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (j.error) throw new Error(`Firestore ${collection} : ${j.error.message}`);
      for (const d of j.documents || []) docs.push({ _id: d.name.split("/").pop(), ...champs(d) });
      page = j.nextPageToken || "";
    } while (page);
    return docs;
  }
}
