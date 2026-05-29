import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";

export function ElevesTab({ c1, mesClasses, eleves, ouvrirSignalementEleve }) {
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Mes eleves ({eleves.length})</h2>
      {mesClasses.length === 0 ? (
        <Vide icone="Eleves" msg="Aucune classe assignee dans l'emploi du temps" />
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
                    <TD bold>{eleveItem.nom} {eleveItem.prenom}</TD>
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
        </>
      )}
    </>
  );
}
