import { useState } from "react";
import { useTranslation } from "react-i18next";
import { nettoyerSurnom } from "../../identite-enfant";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";
import { EnfantAgrandi } from "../identite-enfant/EnfantAgrandi";
import { PhotoEleve } from "../identite-enfant/PhotoEleve";
import { Trombinoscope } from "../identite-enfant/Trombinoscope";
import { AppelVue } from "./AppelVue";

export function ElevesTab({ c1, mesClasses, eleves, ouvrirSignalementEleve, schoolInfo = {}, annee = "", section = "", vueChoisie = "", setVue, appel, enregistrement = false }) {
  // En maternelle, la maîtresse reconnaît l'enfant à son visage avant son
  // nom : le trombinoscope s'ouvre d'office. Ailleurs, la liste.
  const vue = vueChoisie || (section === "prescolaire" ? "trombi" : "liste");
  const [agrandi, setAgrandi] = useState(null);
  const { t } = useTranslation();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 16px" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1, flex: 1 }}>{t("teacher.students.title", { count: eleves.length })}</h2>
        {mesClasses.length > 0 && <span style={{ display: "inline-flex", gap: 4 }}>
          <Btn sm v={vue === "appel" ? "blue" : "ghost"} onClick={() => setVue("appel")}>✅ {t("teacher.rollCall.tab")}</Btn>
          <Btn sm v={vue === "liste" ? "blue" : "ghost"} onClick={() => setVue("liste")}>📋 {t("teacher.students.list")}</Btn>
          <Btn sm v={vue === "trombi" ? "blue" : "ghost"} onClick={() => setVue("trombi")}>🖼️ {t("teacher.students.photoBoard")}</Btn>
        </span>}
      </div>
      {mesClasses.length === 0 ? (
        <Vide icone="👥" msg={t("teacher.students.noClass")} />
      ) : vue === "appel" ? (
        <>
          <AppelVue c1={c1} mesClasses={mesClasses} appel={appel} enregistrement={enregistrement}
            ouvrirSignalementEleve={ouvrirSignalementEleve} onAgrandir={setAgrandi} />
          <EnfantAgrandi eleve={agrandi} fermer={() => setAgrandi(null)} />
        </>
      ) : vue === "trombi" ? (
        <Trombinoscope eleves={eleves} schoolInfo={schoolInfo} annee={annee} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {mesClasses.map((classe) => (
              <Badge key={classe} color="blue">{t("teacher.students.countInClass", { classe, count: eleves.filter((eleveItem) => eleveItem.classe === classe).length })}</Badge>
            ))}
          </div>
          <Card>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={[t("teacher.cols.matricule"), t("teacher.cols.fullName"), t("teacher.cols.class"), t("teacher.cols.sex"), t("teacher.cols.status"), t("teacher.cols.action")]} />
              <tbody>
                {eleves.map((eleveItem) => (
                  <TR key={eleveItem._id}>
                    <TD><span style={{ fontFamily: "monospace", fontSize: 11, background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: c1, fontWeight: 700 }}>{eleveItem.matricule}</span></TD>
                    <TD bold>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PhotoEleve eleve={eleveItem} largeur={30} onClick={setAgrandi} />
                        <div>
                          {eleveItem.nom} {eleveItem.prenom}
                          {nettoyerSurnom(eleveItem.surnom) && <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>« {nettoyerSurnom(eleveItem.surnom)} »</div>}
                        </div>
                      </div>
                    </TD>
                    <TD><Badge color="blue">{eleveItem.classe}</Badge></TD>
                    <TD><Badge color={eleveItem.sexe === "F" ? "vert" : "blue"}>{eleveItem.sexe}</Badge></TD>
                    <TD><Badge color={eleveItem.statut === "Actif" ? "vert" : "gray"}>{eleveItem.statut && eleveItem.statut !== "Actif" ? eleveItem.statut : t("teacher.students.active")}</Badge></TD>
                    <TD>
                      <Btn sm v="amber" onClick={() => ouvrirSignalementEleve(eleveItem)}>⚠️ {t("teacher.students.report")}</Btn>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </Card>
          <EnfantAgrandi eleve={agrandi} fermer={() => setAgrandi(null)}
            actions={agrandi && <Btn sm v="amber" onClick={() => { const e = agrandi; setAgrandi(null); ouvrirSignalementEleve(e); }}>⚠️ {t("teacher.students.report")}</Btn>} />
        </>
      )}
    </>
  );
}
