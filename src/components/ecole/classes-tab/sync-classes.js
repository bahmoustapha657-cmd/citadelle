// Crée/met à jour les classes à partir des classes présentes chez les élèves
// et des titulaires déclarés chez les enseignants.
export async function syncClassesFromData({ eleves, ens, classes, ajC, modC, toast }) {
  const classesEleves = [...new Set(eleves.map(e => e.classe).filter(Boolean))];
  const titulairesParClasse = {};
  ens.forEach(e => {
    if (e.classeTitle) {
      titulairesParClasse[e.classeTitle] = `${e.prenom || ""} ${e.nom || ""}`.trim();
    }
  });
  const classesEns = Object.keys(titulairesParClasse);
  const toutesClasses = [...new Set([...classesEleves, ...classesEns])];
  let nbCrees = 0, nbMaj = 0;
  for (const nom of toutesClasses) {
    const existante = classes.find(c => c.nom === nom);
    const titulaire = titulairesParClasse[nom] || "";
    if (!existante) {
      await ajC({ nom, effectif: 0, ...(titulaire ? { enseignant: titulaire } : {}) });
      nbCrees++;
    } else if (titulaire && !existante.enseignant) {
      await modC({ ...existante, enseignant: titulaire });
      nbMaj++;
    }
  }
  toast(`Synchronisation : ${nbCrees} classe(s) créée(s), ${nbMaj} mise(s) à jour.`, "success");
}
