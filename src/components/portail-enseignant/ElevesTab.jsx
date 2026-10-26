import { useState } from "react";
import { nettoyerSurnom } from "../../identite-enfant";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";
import { EnfantAgrandi } from "../identite-enfant/EnfantAgrandi";
import { PhotoEleve } from "../identite-enfant/PhotoEleve";
import { Trombinoscope } from "../identite-enfant/Trombinoscope";

export function ElevesTab({ c1, mesClasses, eleves, ouvrirSignalementEleve, schoolInfo = {}, annee = "", section = "" }) {
  // En maternelle, la maîtresse reconnaît l'enfant à son visage avant son
  // nom : le trombinoscope s'ouvre d'office. Ailleurs, la liste.
  const [vue, setVue] = useState(section === "prescolaire" ? "trombi" : "liste");
  const [agrandi, setAgrandi] = useState(null);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 16px" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1, flex: 1 }}>Mes eleves ({eleves.length})</h2>
        {mesClasses.length > 0 && <span style={{ display: "inline-flex", gap: 4 }}>
          <Btn sm v={vue === "liste" ? "blue" : "ghost"} onClick={() => setVue("liste")}>📋 Liste</Btn>
          <Btn sm v={vue === "trombi" ? "blue" : "ghost"} onClick={() => setVue("trombi")}>🖼️ Trombinoscope</Btn>
        </span>}
      </div>
      {mesClasses.length === 0 ? (
        <Vide icone="Eleves" msg="Aucune classe assignee dans l'emploi du temps" />
      ) : vue === "trombi" ? (
        <Trombinoscope eleves={eleves} schoolInfo={schoolInfo} annee={annee} section={section} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {mesClasses.map((classe) => (
              <Badge key={classe} color="blue">{classe} - {eleves.filter((eleveItem) => eleveItem.classe === classe).length} eleve(s)</Badge>
            ))}
          </div>
          <Card>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={["Matricule", "Nom et prenom", "Classe", "Sexe", "Statut", "Action"]} />
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
                    <TD><Badge color={eleveItem.statut === "Actif" ? "vert" : "gray"}>{eleveItem.statut || "Actif"}</Badge></TD>
                    <TD>
                      <Btn sm v="amber" onClick={() => ouvrirSignalementEleve(eleveItem)}>⚠️ Signaler</Btn>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </Card>
          <EnfantAgrandi eleve={agrandi} fermer={() => setAgrandi(null)}
            actions={agrandi && <Btn sm v="amber" onClick={() => { const e = agrandi; setAgrandi(null); ouvrirSignalementEleve(e); }}>⚠️ Signaler</Btn>} />
        </>
      )}
    </>
  );
}
