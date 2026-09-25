import React from "react";
import { fmt } from "../../constants";
import {
  acompteInscription, getEleveMensualiteSnapshot, getFraisAnnexesEleve, getTarifConfigForClasse,
  getTarifMensuelForClasse, montantDuInscription, montantDuMois, montantInscriptionPaye,
} from "../../mensualite-utils";
import { etatsMois, periodeTranche, trancheDuMois } from "../../paiements-scolarite";
import { partiAvantAnnee } from "../../depart-utils";
import { Badge, Vide } from "../ui";

// Apparence d'un frais ou d'un mois selon son état.
const ETATS = {
  paye: { fond: "#dcfce7", bord: "#86efac", texte: "#166534", badge: "green", libelle: "Paye" },
  partiel: { fond: "#fef3c7", bord: "#fcd34d", texte: "#92400e", badge: "amber", libelle: "Acompte" },
  impaye: { fond: "#fee2e2", bord: "#fca5a5", texte: "#b91c1c", badge: "red", libelle: "A payer" },
  exonere: { fond: "#f1f5f9", bord: "#cbd5e1", texte: "#475569", badge: "gray", libelle: "Dispense" },
  nonDu: { fond: "#f8fafc", bord: "#e2e8f0", texte: "#94a3b8", badge: "gray", libelle: "Non du" },
};

// Carte d'un frais ponctuel (inscription, révision, cantine…) : son état, le
// montant et la ligne d'explication.
function carteFrais({ id, label, etat, montant, verse = 0, reste = 0, date = "" }) {
  const detail = etat === "paye" ? (date ? `Regle le ${date}` : "Regle")
    : etat === "partiel" ? `${fmt(verse)} verses, reste ${fmt(reste)}`
      : etat === "exonere" ? "Dispense accordee par l'ecole"
        : "En attente de reglement";
  return { id, label, etat, montant, detail };
}

// `annee` : année des fiches. Un élève parti ne doit que les mois entamés
// avant son départ — les suivants s'affichent « Non dû », pas « Impayé ».
// `tarifs` : tarifs de l'école (reste à payer, frais de la classe) ;
// `tranches` : tranches de paiement de l'école, pour regrouper les mois.
export function PaiementsTab({
  eleve, moisAnnee, annee, estReinscription, montantInscription, montantMensuel,
  tarifs = [], tranches = [], c1, c2,
}) {
  const mens = eleve.mens || {};
  const mensDates = eleve.mensDates || {};
  const moisList = moisAnnee.length ? moisAnnee : Object.keys(mens);
  const snapshot = getEleveMensualiteSnapshot(eleve, moisList, tarifs, annee);
  const resteAPayer = snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;
  const mensualite = getTarifMensuelForClasse(tarifs, eleve.classe) || montantMensuel;
  const duMois = montantDuMois(eleve, mensualite);
  const etats = etatsMois(eleve, moisList, mensualite, annee);
  const etatDe = Object.fromEntries(etats.map((e) => [e.mois, e]));
  const nbPayes = snapshot.nbPayes;
  const nbImpayes = snapshot.nbImpayes;
  // Parti avant la rentrée : ni inscription ni frais à réclamer pour l'année.
  const rienDu = partiAvantAnnee(eleve, moisList, annee);

  // Inscription puis tous les frais de la classe (autre, révision, tenue,
  // cantine…) — et ceux déjà réglés que la classe ne facture plus.
  const fraisAnnexes = [];
  const acompteIns = eleve.inscriptionPayee ? 0 : acompteInscription(eleve);
  const duIns = montantDuInscription(eleve, montantInscription);
  if (eleve.inscriptionPayee || acompteIns > 0 || (!rienDu && montantInscription > 0)) {
    fraisAnnexes.push(carteFrais({
      id: "inscription",
      label: estReinscription ? "Reinscription" : "Inscription",
      etat: eleve.inscriptionPayee ? "paye" : acompteIns > 0 ? "partiel" : duIns === 0 ? "exonere" : "impaye",
      montant: eleve.inscriptionPayee ? montantInscriptionPaye(eleve, montantInscription) : duIns || montantInscription,
      verse: acompteIns,
      reste: Math.max(0, duIns - acompteIns),
      date: eleve.inscriptionDate || "",
    }));
  }
  for (const ligne of getFraisAnnexesEleve(eleve, getTarifConfigForClasse(tarifs, eleve.classe))) {
    if (!ligne.paye && ligne.verse === 0 && rienDu) continue;
    fraisAnnexes.push(carteFrais({
      id: ligne.id,
      label: ligne.label,
      etat: ligne.paye ? "paye" : ligne.verse > 0 ? "partiel" : ligne.duNet === 0 ? "exonere" : "impaye",
      montant: ligne.paye ? ligne.montant : ligne.duNet || ligne.du,
      verse: ligne.verse,
      reste: ligne.reste,
      date: ligne.date,
    }));
  }

  // Mois regroupés par tranche quand l'école en a défini ; sinon un seul bloc.
  const groupes = tranches.length
    ? [
      ...tranches.map((t) => ({ titre: `${t.nom} — ${periodeTranche(t)}`, mois: t.mois.filter((m) => moisList.includes(m)) })),
      { titre: "Autres mois", mois: moisList.filter((m) => trancheDuMois(tranches, m) < 0) },
    ].filter((g) => g.mois.length)
    : [{ titre: "", mois: moisList }];

  const carteChiffre = (valeur, libelle, fond, couleur, minWidth = 120) => (
    <div style={{ padding: "14px 20px", background: fond, borderRadius: 12, textAlign: "center", minWidth }}>
      <div style={{ fontWeight: 900, fontSize: typeof valeur === "number" ? 24 : 20, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{libelle}</div>
    </div>
  );

  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Suivi des paiements</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {carteChiffre(fmt(resteAPayer), resteAPayer > 0 ? "Reste a payer" : "A jour", resteAPayer > 0 ? "#fee2e2" : "#dcfce7",
          resteAPayer > 0 ? "#b91c1c" : "#166534", 170)}
        {carteChiffre(nbPayes, "Mois payes", "#dcfce7", "#166534")}
        {carteChiffre(nbImpayes, "Mois impayes", "#fee2e2", "#b91c1c")}
        {carteChiffre(`${nbPayes + nbImpayes ? Math.round((nbPayes / (nbPayes + nbImpayes)) * 100) : 100}%`, "Taux", "#f0fdf4", c2)}
        <div style={{ padding: "14px 20px", background: "#eff6ff", borderRadius: 12, textAlign: "center", minWidth: 150 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#1d4ed8" }}>{fmt(duMois)}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            Mensualite{duMois !== mensualite ? ` (au lieu de ${fmt(mensualite)}, dispense)` : ""}
          </div>
        </div>
      </div>

      {fraisAnnexes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10, marginBottom: 18 }}>
          {fraisAnnexes.map((frais) => {
            const s = ETATS[frais.etat];
            return (
              <div key={frais.id} style={{ padding: "14px 16px", borderRadius: 14, background: s.fond, border: `1px solid ${s.bord}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ fontSize: 13, color: s.texte }}>{frais.label}</strong>
                  <Badge color={s.badge}>{s.libelle}</Badge>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.texte, marginTop: 10 }}>{fmt(frais.montant)}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{frais.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      {groupes.map((groupe) => {
        const etatsGroupe = groupe.mois.map((m) => etatDe[m]).filter(Boolean);
        const resteGroupe = etatsGroupe.reduce((s, e) => s + e.reste, 0);
        const payesGroupe = etatsGroupe.filter((e) => e.statut === "paye").length;
        return (
          <div key={groupe.titre || "mois"} style={{ marginBottom: 14 }}>
            {groupe.titre && (
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "0 0 8px" }}>
                <strong style={{ fontSize: 13, color: c1 }}>{groupe.titre}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, color: resteGroupe > 0 ? "#b91c1c" : "#166534" }}>
                  {payesGroupe}/{etatsGroupe.length} payes{resteGroupe > 0 ? ` · reste ${fmt(resteGroupe)}` : " · solde"}
                </span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
              {etatsGroupe.map((etat) => {
                const s = ETATS[etat.statut] || ETATS.impaye;
                const texte = etat.statut === "paye" ? "Paye"
                  : etat.statut === "partiel" ? `Acompte ${fmt(etat.verse)}`
                    : etat.statut === "exonere" ? "Dispense"
                      : etat.statut === "nonDu" ? "Non du (apres le depart)"
                        : `Impaye · ${fmt(etat.reste)}`;
                return (
                  <div key={etat.mois} style={{ padding: "12px 16px", borderRadius: 12, background: s.fond, border: `2px solid ${s.bord}` }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: s.texte }}>{etat.mois}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: s.texte, fontWeight: 700 }}>{texte}</div>
                    {etat.statut === "paye" && mensDates[etat.mois] && (
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{mensDates[etat.mois]}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {moisList.length === 0 && fraisAnnexes.length === 0 && <Vide icone="Paiements" msg="Aucune information de paiement" />}
    </>
  );
}
