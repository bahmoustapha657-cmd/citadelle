import React from "react";
import { fmt, getFraisAnnexeDate, getFraisAnnexeMontantFige, isFraisAnnexePaye } from "../../constants";
import { montantInscriptionPaye } from "../../mensualite-utils";
import { Badge, Vide } from "../ui";
import { normalizeText } from "./helpers";

// Carte d'un frais ponctuel : réglé (au montant encaissé) ou en attente (au
// tarif de la classe).
const carteFrais = (id, label, montant, paye, date, [fond, bord, texte]) => ({
  id, label, montant, paye, date,
  couleur: paye ? fond : "#fee2e2",
  bordure: paye ? bord : "#fca5a5",
  texte: paye ? texte : "#b91c1c",
});

export function PaiementsTab({ eleve, moisAnnee, estReinscription, montantInscription, montantAutre, montantRevision = 0, montantMensuel, c1, c2 }) {
  const mens = eleve.mens || {};
  const mensDates = eleve.mensDates || {};
  const moisList = moisAnnee.length ? moisAnnee : Object.keys(mens);
  const nbPayes = moisList.filter((mois) => normalizeText(mens[mois]) === "paye").length;
  const nbImpayes = moisList.filter((mois) => normalizeText(mens[mois]) !== "paye").length;
  const frais = (id, label, tarif, couleurs) => {
    const paye = isFraisAnnexePaye(eleve, id);
    return carteFrais(id, label, paye ? (getFraisAnnexeMontantFige(eleve, id) ?? tarif) : tarif,
      paye, getFraisAnnexeDate(eleve, id), couleurs);
  };
  const fraisAnnexes = [
    carteFrais("inscription", estReinscription ? "Reinscription" : "Inscription",
      eleve.inscriptionPayee ? montantInscriptionPaye(eleve, montantInscription) : montantInscription,
      !!eleve.inscriptionPayee, eleve.inscriptionDate || "", ["#dbeafe", "#93c5fd", "#1d4ed8"]),
    // La révision est due une fois par an : elle ne fait plus partie de la
    // mensualité affichée ci-dessous.
    frais("revision", "Frais de revision (annuel)", montantRevision, ["#fef3c7", "#fcd34d", "#92400e"]),
    frais("autre", "Autre frais", montantAutre, ["#e2e8f0", "#94a3b8", "#334155"]),
  ].filter((item) => item.montant > 0);

  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Suivi des paiements</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "14px 20px", background: "#dcfce7", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#166534" }}>{nbPayes}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mois payes</div>
        </div>
        <div style={{ padding: "14px 20px", background: "#fee2e2", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#b91c1c" }}>{nbImpayes}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mois impayes</div>
        </div>
        <div style={{ padding: "14px 20px", background: "#f0fdf4", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: c2 }}>{moisList.length ? Math.round((nbPayes / moisList.length) * 100) : 0}%</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Taux</div>
        </div>
        <div style={{ padding: "14px 20px", background: "#eff6ff", borderRadius: 12, textAlign: "center", minWidth: 150 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#1d4ed8" }}>{fmt(montantMensuel)}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mensualite</div>
        </div>
      </div>

      {fraisAnnexes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10, marginBottom: 18 }}>
          {fraisAnnexes.map((frais) => (
            <div key={frais.id} style={{ padding: "14px 16px", borderRadius: 14, background: frais.couleur, border: `1px solid ${frais.bordure}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 13, color: frais.texte }}>{frais.label}</strong>
                <Badge color={frais.paye ? "green" : "red"}>{frais.paye ? "Paye" : "Impaye"}</Badge>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: frais.texte, marginTop: 10 }}>{fmt(frais.montant)}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{frais.paye && frais.date ? `Regle le ${frais.date}` : "En attente de reglement"}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
        {moisList.map((mois) => {
          const paye = normalizeText(mens[mois]) === "paye";
          return (
            <div key={mois} style={{ padding: "12px 16px", borderRadius: 12, background: paye ? "#dcfce7" : "#fee2e2", border: `2px solid ${paye ? "#86efac" : "#fca5a5"}` }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: paye ? "#166534" : "#b91c1c" }}>{mois}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: paye ? "#15803d" : "#dc2626", fontWeight: 700 }}>{paye ? "Paye" : "Impaye"}</div>
              {paye && mensDates[mois] && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{mensDates[mois]}</div>}
            </div>
          );
        })}
      </div>

      {moisList.length === 0 && fraisAnnexes.length === 0 && <Vide icone="Paiements" msg="Aucune information de paiement" />}
    </>
  );
}
