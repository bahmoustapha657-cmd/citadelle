// Agrégation du rapport mensuel (calculs purs, sans DOM) : absences du mois,
// statistiques par classe, totaux et liste des élèves à absences répétées.

// Vrai si l'absence tombe sur le mois ciblé (compare le libellé ou la date).
const absenceDuMois = (a, mois) =>
  a.date && a.date.startsWith
    ? a.date.includes(mois) || (() => {
        try { return new Date(a.date).toLocaleDateString("fr-FR",{month:"long"}).toLowerCase() === mois.toLowerCase(); } catch { return false; }
      })()
    : false;

// Renvoie le modèle exploité par le gabarit : classes, lignes par classe,
// totaux et élèves concernés par ≥ 3 absences.
export function computeRapportMensuel(mois, eleves, absences) {
  const absences_mois = absences.filter((a) => absenceDuMois(a, mois));

  const classes = [...new Set(eleves.map(e=>e.classe||"Sans classe"))].sort();

  const lignesClasse = classes.map(classe => {
    const elevesClasse = eleves.filter(e=>(e.classe||"Sans classe")===classe);
    const absClasse = absences_mois.filter(a => elevesClasse.some(e=>e._id===a.eleveId||(e.nom+" "+e.prenom)===a.eleveNom));
    const absJustif = absClasse.filter(a=>a.justifie==="Oui").length;
    const absNonJust = absClasse.filter(a=>a.justifie!=="Oui").length;
    // Paiements : compter payés vs impayés pour ce mois
    const payesMois = elevesClasse.filter(e=>(e.mens||{})[mois]==="Payé").length;
    const tauxPaye = elevesClasse.length ? Math.round(payesMois/elevesClasse.length*100) : 0;
    return { classe, effectif:elevesClasse.length, absJustif, absNonJust, total:absJustif+absNonJust, payesMois, tauxPaye };
  });

  const totEffectif = lignesClasse.reduce((s,l)=>s+l.effectif,0);
  const totAbsJ = lignesClasse.reduce((s,l)=>s+l.absJustif,0);
  const totAbsN = lignesClasse.reduce((s,l)=>s+l.absNonJust,0);
  const totPaye = lignesClasse.reduce((s,l)=>s+l.payesMois,0);
  const tauxGlobal = totEffectif ? Math.round(totPaye/totEffectif*100) : 0;

  // Élèves avec absences répétées (≥ 3 ce mois), top 15
  const elevesConcernes = eleves.map(e => {
    const abs = absences_mois.filter(a=>a.eleveId===e._id||(e.nom+" "+e.prenom)===a.eleveNom);
    return { ...e, nbAbs: abs.length };
  }).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs).slice(0,15);

  return { classes, lignesClasse, totEffectif, totAbsJ, totAbsN, totPaye, tauxGlobal, elevesConcernes };
}
