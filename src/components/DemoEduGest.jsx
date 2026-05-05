import React, { useMemo, useState } from "react";
import Logo from "../Logo";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, LectureSeule, Stat, Tabs, THead, TR, TD } from "./ui";

const kpis = [
  { label: "Élèves actifs", value: "842", sub: "Primaire, collège et lycée" },
  { label: "Paiements du mois", value: "178 500 000 GNF", sub: "Montant déjà encaissé" },
  { label: "Salaires prêts", value: "46", sub: "Fiches prêtes à payer" },
  { label: "Messages parents", value: "19", sub: "Annonces et rappels envoyés" },
];

const paiements = [
  { eleve: "Aïssatou Diallo", classe: "6e A", montant: "450 000 GNF", statut: "À jour" },
  { eleve: "Mamadou Bah", classe: "CM2", montant: "320 000 GNF", statut: "Partiel" },
  { eleve: "Mariama Barry", classe: "2nde S", montant: "600 000 GNF", statut: "À jour" },
];

const notes = [
  { eleve: "Fatou Camara", matiere: "Mathématiques", moyenne: "15,33 / 20", rang: "5e" },
  { eleve: "Ibrahima Condé", matiere: "SVT", moyenne: "13,67 / 20", rang: "9e" },
  { eleve: "Kadiatou Sylla", matiere: "Français", moyenne: "16,00 / 20", rang: "3e" },
];

const salaires = [
  { nom: "M. Touré", role: "Enseignant collège", montant: "2 450 000 GNF", bon: "300 000 GNF", net: "2 150 000 GNF" },
  { nom: "Mme Diallo", role: "Titulaire primaire", montant: "1 800 000 GNF", bon: "0 GNF", net: "1 800 000 GNF" },
  { nom: "M. Barry", role: "Surveillant général", montant: "1 250 000 GNF", bon: "150 000 GNF", net: "1 100 000 GNF" },
];

const parentFeed = [
  { titre: "Bulletin disponible", detail: "Le bulletin du 2e trimestre est prêt dans le portail parent." },
  { titre: "Rappel de paiement", detail: "Le solde du mois de mai peut être régularisé en caisse." },
  { titre: "Annonce école", detail: "Composition blanche prévue la semaine prochaine pour les classes d'examen." },
];

const tabs = [
  { id: "direction", label: "Vue direction" },
  { id: "notes", label: "Notes et bulletins" },
  { id: "compta", label: "Comptabilité" },
  { id: "parents", label: "Portail parent" },
];

function tableCard(title, subtitle, header, rows) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 10px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "#0A1628" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{subtitle}</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <THead cols={header} />
          <tbody>{rows}</tbody>
        </table>
      </div>
    </Card>
  );
}

function DemoEduGest({ onConnexion, onInscription, onRetour }) {
  const [tab, setTab] = useState("direction");

  const tabContent = useMemo(() => {
    if (tab === "notes") {
      return tableCard(
        "Saisie des notes et bulletins",
        "Aperçu de la logique secondaire : moyennes, matières et classement.",
        ["Élève", "Matière", "Moyenne", "Rang"],
        notes.map((item) => (
          <TR key={`${item.eleve}-${item.matiere}`}>
            <TD bold>{item.eleve}</TD>
            <TD>{item.matiere}</TD>
            <TD>{item.moyenne}</TD>
            <TD>{item.rang}</TD>
          </TR>
        )),
      );
    }

    if (tab === "compta") {
      return tableCard(
        "Comptabilité et salaires",
        "Exemple de génération des états de salaire et des bons déjà déduits.",
        ["Nom", "Fonction", "Montant", "Bon", "Net à payer"],
        salaires.map((item) => (
          <TR key={item.nom}>
            <TD bold>{item.nom}</TD>
            <TD>{item.role}</TD>
            <TD>{item.montant}</TD>
            <TD>{item.bon}</TD>
            <TD style={{ color: "#0f766e", fontWeight: 700 }}>{item.net}</TD>
          </TR>
        )),
      );
    }

    if (tab === "parents") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "#0A1628" }}>Portail parent</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b" }}>
              Un parent voit les bulletins, les paiements, les absences et les messages de l'école dans un seul espace.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {parentFeed.map((item) => (
                <div key={item.titre} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: "#0A1628", fontSize: 14 }}>{item.titre}</strong>
                    <Badge color="blue">Lecture seule</Badge>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>
          {tableCard(
            "Paiements et situation des élèves",
            "Exemple d'aperçu parent/comptabilité sur la même école.",
            ["Élève", "Classe", "Montant du mois", "Statut"],
            paiements.map((item) => (
              <TR key={item.eleve}>
                <TD bold>{item.eleve}</TD>
                <TD>{item.classe}</TD>
                <TD>{item.montant}</TD>
                <TD>
                  <Badge color={item.statut === "À jour" ? "green" : "amber"}>{item.statut}</Badge>
                </TD>
              </TR>
            )),
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {kpis.map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} sub={item.sub} />
          ))}
        </div>
        {tableCard(
          "Paiements du mois",
          "Exemple de suivi simple pour la direction et la comptabilité.",
          ["Élève", "Classe", "Montant", "Statut"],
          paiements.map((item) => (
            <TR key={item.eleve}>
              <TD bold>{item.eleve}</TD>
              <TD>{item.classe}</TD>
              <TD>{item.montant}</TD>
              <TD>
                <Badge color={item.statut === "À jour" ? "green" : "amber"}>{item.statut}</Badge>
              </TD>
            </TR>
          )),
        )}
      </div>
    );
  }, [tab]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#eef4fb 0%,#f8fbff 100%)", color: "#0A1628" }}>
      <GlobalStyles />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 18px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo width={160} height={46} />
            <Badge color="purple">Démo publique</Badge>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn v="ghost" onClick={onRetour}>Retour</Btn>
            <Btn v="ghost" onClick={onConnexion}>Connexion</Btn>
            <Btn onClick={onInscription}>Créer mon école</Btn>
          </div>
        </div>

        <Card style={{ padding: 22, marginBottom: 18, background: "linear-gradient(135deg,#0A1628,#14335f)", color: "#fff", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 640 }}>
              <Badge color="teal">École démo en lecture seule</Badge>
              <h1 style={{ margin: "16px 0 10px", fontSize: "clamp(28px,4vw,42px)", lineHeight: 1.1 }}>
                Découvrez EduGest sans inscription
              </h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.82)" }}>
                Cette démo vous montre comment une direction suit les élèves, les notes, la comptabilité et le portail parent.
                Tout est en lecture seule, avec des données de démonstration.
              </p>
            </div>
            <div style={{ minWidth: 240, alignSelf: "stretch", display: "grid", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>École</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>Groupe scolaire Djoma Démo</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parcours</div>
                <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>Direction, enseignant, comptable et parent sur un même espace.</div>
              </div>
            </div>
          </div>
        </Card>

        <LectureSeule />

        <Card style={{ padding: 18 }}>
          <Tabs items={tabs} actif={tab} onChange={setTab} />
          {tabContent}
        </Card>
      </div>
    </div>
  );
}

export { DemoEduGest };
