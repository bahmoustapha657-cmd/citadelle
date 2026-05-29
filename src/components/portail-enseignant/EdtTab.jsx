import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";

export function EdtTab({ c1, matiere, emplois, formatEmploiHeure, imprimerEdt }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1 }}>Mon emploi du temps</h2>
        {emplois.length > 0 && <Btn sm v="ghost" onClick={imprimerEdt}>Imprimer EDT</Btn>}
      </div>
      {emplois.length === 0 ? (
        <Vide icone="EDT" msg="Aucun creneau dans votre emploi du temps" />
      ) : (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{minWidth: 600}}>
              <THead cols={["Jour", "Heure", "Classe", "Matiere"]} />
              <tbody>
                {emplois.map((emploi, index) => (
                  <TR key={emploi._id || index}>
                    <TD bold>{emploi.jour || "-"}</TD>
                    <TD>{formatEmploiHeure(emploi)}</TD>
                    <TD><Badge color="blue">{emploi.classe || "-"}</Badge></TD>
                    <TD>{emploi.matiere || matiere || "-"}</TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </div>
        </Card>
      )}
    </>
  );
}
