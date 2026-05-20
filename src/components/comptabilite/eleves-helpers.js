// Petits helpers partagés par Comptabilite.jsx et ses sous-tabs.
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.

// Tri alphabétique des élèves selon la préférence schoolInfo.triEleves
// ("prenom_nom" | "nom_prenom" | "classe_prenom" | "classe_nom").
export function sortAlphaEleves(arr, triEleves = "prenom_nom") {
  const tri = triEleves || "prenom_nom";
  return [...arr].sort((a,b)=>{
    const ka = tri==="nom_prenom"||tri==="classe_nom" ? `${a.classe||""} ${a.nom} ${a.prenom}` : `${a.classe||""} ${a.prenom} ${a.nom}`;
    const kb = tri==="nom_prenom"||tri==="classe_nom" ? `${b.classe||""} ${b.nom} ${b.prenom}` : `${b.classe||""} ${b.prenom} ${b.nom}`;
    const withClasse = tri==="classe_prenom"||tri==="classe_nom";
    if(withClasse) return ka.localeCompare(kb,"fr",{sensitivity:"base"});
    // sans classe : comparer sans le préfixe classe
    const sa = tri==="nom_prenom" ? `${a.nom} ${a.prenom}` : `${a.prenom} ${a.nom}`;
    const sb = tri==="nom_prenom" ? `${b.nom} ${b.prenom}` : `${b.prenom} ${b.nom}`;
    return sa.localeCompare(sb,"fr",{sensitivity:"base"});
  });
}

// Crée la classe dans Firestore si elle n'existe pas encore. Le caller
// passe (classesList, ajClasse) selon le niveau pour rester découplé.
// `dejaCreees` est un Set partagé entre appels successifs pour éviter
// les doublons quand la même classe apparait plusieurs fois dans un import.
export async function ensureClasse(nom, { classesList, ajClasse, dejaCreees }) {
  if(!nom) return;
  if(!classesList.find(c=>c.nom===nom) && !(dejaCreees&&dejaCreees.has(nom))) {
    await ajClasse({nom, effectif:0});
    if(dejaCreees) dejaCreees.add(nom);
  }
}
