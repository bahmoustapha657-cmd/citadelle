import React from "react";
import { C } from "../../constants";
import { getGeneralAverage } from "../../note-utils";
import { imprimerBulletin } from "../../reports";
import { BlocagePaiement } from "../BlocagePaiement";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";

export function BulletinsTab({ accesBloqueParPaiement, moisImpayes, schoolInfo, onPaiements, periodes, mesNotes, eleve, eleveNom, section, c1, c2 }) {
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Bulletins</h2>
      {accesBloqueParPaiement && <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={onPaiements} />}
      {!accesBloqueParPaiement && <>
        {periodes.map((periode) => {
          const notesPeriode = mesNotes.filter((item) => item.periode === periode);
          if (notesPeriode.length === 0) return null;
          const matieresPeriode = [...new Set(notesPeriode.map((item) => item.matiere))].map((nom) => ({ nom }));
          const moyenne = (getGeneralAverage(notesPeriode, matieresPeriode, eleve.classe) || 0).toFixed(1);
          return (
            <Card key={periode} style={{ marginBottom: 12 }}>
              <div style={{ padding: "12px 18px", background: `linear-gradient(135deg,${c1},${c1}cc)`, borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ color: "#fff", fontSize: 14 }}>Bulletin - {periode}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ background: c2, color: "#fff", fontWeight: 900, fontSize: 13, padding: "4px 14px", borderRadius: 20 }}>Moy. {moyenne}/20</span>
                  <button
                    onClick={() => imprimerBulletin(
                      { ...eleve, nom: eleve.nom || eleveNom.split(" ").slice(-1)[0] || eleveNom, prenom: eleve.prenom || eleveNom.split(" ").slice(0, -1).join(" ") },
                      notesPeriode,
                      [...new Set(notesPeriode.map((item) => item.matiere))].map((nom) => ({ nom })),
                      periode,
                      section === "primaire" ? "Primaire" : "Secondaire",
                      section === "primaire" ? 10 : 20,
                      schoolInfo,
                    )}
                    style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                  >
                    Imprimer
                  </button>
                </div>
              </div>
              <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
                <THead cols={["Matiere", "Type", "Note /20"]} />
                <tbody>
                  {notesPeriode.map((item, index) => (
                    <TR key={index}>
                      <TD bold>{item.matiere}</TD>
                      <TD><Badge color="blue">{item.type}</Badge></TD>
                      <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c" }}>{item.note}/20</strong></TD>
                    </TR>
                  ))}
                </tbody>
              </table></div>
            </Card>
          );
        })}
        {mesNotes.length === 0 && <Vide icone="Bulletins" msg="Aucun bulletin disponible pour le moment" />}
      </>}
    </>
  );
}
