import React, { useMemo } from "react";
import { Btn, Modale } from "../ui";
import { bulletinDemo } from "./demo-data";

export function BulletinDemoModale({ onInscription, onClose }) {
  const moyGen = useMemo(() => {
    const totalCoef = bulletinDemo.matieres.reduce((s, m) => s + m.coef, 0);
    const totalPond = bulletinDemo.matieres.reduce((s, m) => s + m.moyenne * m.coef, 0);
    return (totalPond / totalCoef).toFixed(2);
  }, []);

  return (
    <Modale xlarge titre={`Bulletin — ${bulletinDemo.eleve.prenom} ${bulletinDemo.eleve.nom} · ${bulletinDemo.periode}`} fermer={onClose}>
      <div style={{ background: "#fff", padding: 18, borderRadius: 10, color: "#1f2937" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "3px solid #0A1628", paddingBottom: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <strong style={{ fontSize: 12, color: "#0A1628" }}>République de Guinée</strong><br />
            <em style={{ color: "#CE1126" }}>Travail</em> - <em style={{ color: "#B8860B" }}>Justice</em> - <em style={{ color: "#009460" }}>Solidarité</em><br />
            Ministère de l'Éducation Nationale
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <strong style={{ color: "#0A1628", fontSize: 14 }}>{bulletinDemo.ecole}</strong><br />
            Année {bulletinDemo.annee}<br />
            {bulletinDemo.periode}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14, fontSize: 12 }}>
          <div><strong>Élève :</strong> {bulletinDemo.eleve.prenom} {bulletinDemo.eleve.nom}</div>
          <div><strong>Classe :</strong> {bulletinDemo.eleve.classe}</div>
          <div><strong>Matricule :</strong> {bulletinDemo.eleve.matricule}</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 14 }}>
          <thead>
            <tr style={{ background: "#0A1628", color: "#fff" }}>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Matière</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>Coef.</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>Devoirs</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>Compo</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>Moyenne</th>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {bulletinDemo.matieres.map((m) => (
              <tr key={m.nom} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m.nom}</td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>{m.coef}</td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>{m.devoirs}</td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>{m.compo}</td>
                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 800, color: m.moyenne >= 10 ? "#15803d" : "#b91c1c" }}>
                  {m.moyenne.toFixed(2)}
                </td>
                <td style={{ padding: "6px 8px", color: "#475569", fontStyle: "italic" }}>{m.appreciation}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f0fdf4" }}>
              <td colSpan={4} style={{ padding: "8px", textAlign: "right", fontWeight: 800 }}>Moyenne générale :</td>
              <td style={{ padding: "8px", textAlign: "center", fontWeight: 900, color: "#15803d", fontSize: 14 }}>{moyGen} / 20</td>
              <td style={{ padding: "8px", color: "#15803d", fontWeight: 700 }}>Tableau d'honneur</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, fontSize: 11, color: "#475569" }}>
          <div><strong>Signature du parent</strong><br /><br />___________________</div>
          <div><strong>Directeur des études</strong><br /><br />___________________</div>
          <div><strong>Cachet de l'école</strong><br /><br />___________________</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn v="ghost" onClick={onClose}>Fermer</Btn>
        <Btn onClick={onInscription}>Créer ma propre école →</Btn>
      </div>
    </Modale>
  );
}
