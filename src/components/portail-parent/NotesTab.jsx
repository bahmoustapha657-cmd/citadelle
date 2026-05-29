import React from "react";
import { C } from "../../constants";
import { getSubjectAverage } from "../../note-utils";
import { BlocagePaiement } from "../BlocagePaiement";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";

export function NotesTab({ accesBloqueParPaiement, moisImpayes, schoolInfo, onPaiements, mesNotes, matieres, eleve, eleveNom, c1 }) {
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Notes de {eleveNom}</h2>
      {accesBloqueParPaiement ? (
        <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={onPaiements} />
      ) : mesNotes.length === 0 ? (
        <Vide icone="Notes" msg="Aucune note disponible" />
      ) : (
        matieres.map((matiere) => {
          const notesMatiere = mesNotes.filter((item) => item.matiere === matiere);
          const moyenne = (getSubjectAverage(notesMatiere, eleve.classe) || 0).toFixed(1);
          return (
            <Card key={matiere} style={{ marginBottom: 12 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 13, color: c1, flex: 1 }}>{matiere}</strong>
                <span style={{ background: Number(moyenne) >= 10 ? "#dcfce7" : "#fee2e2", color: Number(moyenne) >= 10 ? "#166534" : "#b91c1c", fontWeight: 900, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>Moy. {moyenne}/20</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
                  <THead cols={["Type", "Periode", "Note /20"]} />
                  <tbody>
                    {notesMatiere.map((item, index) => (
                      <TR key={index}>
                        <TD><Badge color="blue">{item.type}</Badge></TD>
                        <TD>{item.periode}</TD>
                        <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c" }}>{item.note}/20</strong></TD>
                      </TR>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
