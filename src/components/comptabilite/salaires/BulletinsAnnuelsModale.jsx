import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Modale, Selec } from "../../ui";

// Bulletins de paie annuels (registre d'émargement rempli à la main) : on
// choisit les feuillets à imprimer — tous, un groupe (secondaire, primaire et
// maternelle, personnel), ou une seule personne pour remplacer sa page dans la
// brochure — et la couverture avec sommaire.
// Les feuillets gardent le numéro qu'ils ont dans le registre complet : un
// feuillet réimprimé reprend sa place dans la brochure.
const MAX_NOMS = 6;
const resumeNoms = (noms) => (noms.length > MAX_NOMS
  ? `${noms.slice(0, MAX_NOMS).join(", ")}… (+${noms.length - MAX_NOMS})`
  : noms.join(", "));

export function BulletinsAnnuelsModale({ calculerFiches, imprimer, fermer }) {
  const { t } = useTranslation();
  const fiches = useMemo(() => calculerFiches(), [calculerFiches]);
  const secondaire = fiches.filter((f) => f.type === "heures");
  const forfait = fiches.filter((f) => f.type === "forfait");
  const agents = fiches.filter((f) => f.type === "personnel");
  // Groupes proposés seulement s'il y en a au moins deux.
  const groupes = [["secondaire", "secondary", secondaire], ["forfait", "forfait", forfait], ["personnel", "staff", agents]]
    .filter(([, , liste]) => liste.length > 0);
  const [portee, setPortee] = useState("tous");
  const [idSeul, setIdSeul] = useState(() => String(fiches[0]?.id ?? ""));
  const [couverture, setCouverture] = useState(true);

  const choisies = portee === "un" ? fiches.filter((f) => String(f.id) === idSeul)
    : groupes.find(([cle]) => cle === portee)?.[2] || fiches;
  const avecCouverture = couverture && choisies.length > 1;
  const sansEdt = choisies.filter((f) => f.type === "heures" && !(f.vhHebdo > 0)).map((f) => f.nom);
  const sansTaux = choisies.filter((f) => (f.type === "heures"
    ? !(f.taux > 0 || f.tauxParClasse.length)
    : !(f.salaireMois > 0))).map((f) => f.nom);

  const lancer = () => {
    if (!choisies.length) return;
    if (imprimer(choisies, { couverture: avecCouverture, totalFeuillets: fiches.length })) fermer();
  };

  return (
    <Modale titre={`📘 ${t("accounting.payBook.title")}`} fermer={fermer}>
      <p style={{margin:"0 0 8px",fontSize:13,lineHeight:1.5,color:"var(--lc-text)"}}>{t("accounting.payBook.intro")}</p>
      <p style={{margin:"0 0 14px",fontSize:12,lineHeight:1.5,color:"var(--lc-text-muted, #64748b)"}}>{t("accounting.payBook.fixed")}</p>
      {fiches.length === 0
        ? <div style={{padding:"14px",textAlign:"center",color:"#94a3b8",fontStyle:"italic"}}>{t("accounting.payBook.none")}</div>
        : <>
          <Selec label={t("accounting.payBook.scope")} value={portee} onChange={(e) => setPortee(e.target.value)}>
            <option value="tous">{t("accounting.payBook.all", { n: fiches.length })}</option>
            {groupes.length > 1 && groupes.map(([cle, libelle, liste]) => (
              <option key={cle} value={cle}>{t(`accounting.payBook.${libelle}`, { n: liste.length })}</option>
            ))}
            <option value="un">{t("accounting.payBook.one")}</option>
          </Selec>
          {portee === "un" && <div style={{marginTop:10}}>
            <Selec label={t("accounting.payBook.teacher")} value={idSeul} onChange={(e) => setIdSeul(e.target.value)}>
              {fiches.map((f) => <option key={f.id} value={String(f.id)}>{f.numero}. {f.nom}</option>)}
            </Selec>
          </div>}
          {choisies.length > 1 && <label style={{display:"flex",alignItems:"center",gap:8,marginTop:12,fontSize:13,cursor:"pointer",color:"var(--lc-text)"}}>
            <input type="checkbox" checked={couverture} onChange={(e) => setCouverture(e.target.checked)}/>
            {t("accounting.payBook.cover")}
          </label>}
          {(sansEdt.length > 0 || sansTaux.length > 0) && <div style={{marginTop:12,padding:"8px 12px",borderRadius:8,background:"#fffbeb",border:"1px solid #fcd34d",fontSize:12,lineHeight:1.5,color:"#92400e"}}>
            {sansEdt.length > 0 && <div>⚠️ {t("accounting.payBook.noSchedule", { noms: resumeNoms(sansEdt) })}</div>}
            {sansTaux.length > 0 && <div>⚠️ {t("accounting.payBook.noRate", { noms: resumeNoms(sansTaux) })}</div>}
          </div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
            <Btn v="vert" onClick={lancer} disabled={!choisies.length}>🖨️ {t("accounting.payBook.print")}</Btn>
          </div>
        </>}
    </Modale>
  );
}
