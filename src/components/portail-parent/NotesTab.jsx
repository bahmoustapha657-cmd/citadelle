import React from "react";
import { C, getBaremeForSection } from "../../constants";
import { getSubjectAverage } from "../../note-utils";
import { BlocagePaiement } from "../BlocagePaiement";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";

// `section` = clé de section de l'enfant (cf. sectionDeLEleve) : elle fixe le
// barème affiché (maternelle et primaire sur 10) et la formule de moyenne,
// les mêmes que sur le bulletin.
export function NotesTab({ accesBloqueParPaiement, moisImpayes, schoolInfo, onPaiements, mesNotes, matieres, eleve, eleveNom, section, c1 }) {
  const maxNote = getBaremeForSection(section);
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
          const moyenne = (getSubjectAverage(notesMatiere, eleve.classe, section) || 0).toFixed(1);
          return (
            <Card key={matiere} style={{ marginBottom: 12 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 13, color: c1, flex: 1 }}>{matiere}</strong>
                <span style={{ background: Number(moyenne) >= maxNote / 2 ? "#dcfce7" : "#fee2e2", color: Number(moyenne) >= maxNote / 2 ? "#166534" : "#b91c1c", fontWeight: 900, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>Moy. {moyenne}/{maxNote}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
                  <THead cols={["Type", "Periode", `Note /${maxNote}`]} />
                  <tbody>
                    {notesMatiere.map((item, index) => (
                      <TR key={index}>
                        <TD><Badge color="blue">{item.type}</Badge></TD>
                        <TD>{item.periode}</TD>
                        <TD center><strong style={{ color: Number(item.note) >= maxNote / 2 ? C.greenDk : "#b91c1c" }}>{item.note}/{maxNote}</strong></TD>
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
