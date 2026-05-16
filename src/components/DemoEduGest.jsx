import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import Logo from "../Logo";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, LectureSeule, Modale, Stat, Tabs, THead, TR, TD } from "./ui";

// ═══════════════════════════════════════════════════════════
//  DONNÉES DE DÉMO — riches et cohérentes
// ═══════════════════════════════════════════════════════════
const kpis = [
  { label: "Élèves actifs", value: "842", sub: "Primaire, collège et lycée" },
  { label: "Paiements du mois", value: "178,5 M GNF", sub: "Encaissés en mai" },
  { label: "Salaires prêts", value: "46", sub: "Fiches générées" },
  { label: "Messages parents", value: "19", sub: "Annonces & rappels" },
  { label: "Taux de présence", value: "94,2 %", sub: "Moyenne école" },
  { label: "Bulletins prêts", value: "812", sub: "2e trimestre" },
];

const repartitionSections = [
  { name: "Primaire", value: 320, color: "#00C48C" },
  { name: "Collège", value: 358, color: "#0A1628" },
  { name: "Lycée", value: 164, color: "#f59e0b" },
];

const evolPaiements = [
  { mois: "Oct", revenus: 142, depenses: 98 },
  { mois: "Nov", revenus: 156, depenses: 102 },
  { mois: "Déc", revenus: 168, depenses: 115 },
  { mois: "Jan", revenus: 172, depenses: 108 },
  { mois: "Fév", revenus: 165, depenses: 112 },
  { mois: "Mar", revenus: 180, depenses: 118 },
  { mois: "Avr", revenus: 175, depenses: 110 },
  { mois: "Mai", revenus: 178, depenses: 105 },
];

const paiements = [
  { eleve: "Aïssatou Diallo",  classe: "6e A",   montant: "450 000 GNF", statut: "À jour" },
  { eleve: "Mamadou Bah",       classe: "CM2",    montant: "320 000 GNF", statut: "Partiel" },
  { eleve: "Mariama Barry",     classe: "2nde S", montant: "600 000 GNF", statut: "À jour" },
  { eleve: "Ibrahima Condé",    classe: "4e B",   montant: "450 000 GNF", statut: "À jour" },
  { eleve: "Fatou Camara",      classe: "Tle A",  montant: "650 000 GNF", statut: "À jour" },
  { eleve: "Sékou Touré",       classe: "CM1",    montant: "320 000 GNF", statut: "Impayé" },
  { eleve: "Kadiatou Sylla",    classe: "3e A",   montant: "500 000 GNF", statut: "À jour" },
  { eleve: "Aminata Bangoura",  classe: "CP",     montant: "280 000 GNF", statut: "Partiel" },
  { eleve: "Mohamed Soumah",    classe: "1ere D", montant: "600 000 GNF", statut: "À jour" },
  { eleve: "Hadja Keita",       classe: "5e A",   montant: "450 000 GNF", statut: "À jour" },
];

const notes = [
  { eleve: "Fatou Camara",    matiere: "Mathématiques", moyenne: 15.33, rang: 5,  effectif: 32 },
  { eleve: "Ibrahima Condé",  matiere: "SVT",           moyenne: 13.67, rang: 9,  effectif: 28 },
  { eleve: "Kadiatou Sylla",  matiere: "Français",      moyenne: 16.00, rang: 3,  effectif: 30 },
  { eleve: "Mariama Barry",   matiere: "Physique",      moyenne: 14.25, rang: 7,  effectif: 26 },
  { eleve: "Mohamed Soumah",  matiere: "Anglais",       moyenne: 17.50, rang: 1,  effectif: 24 },
  { eleve: "Aïssatou Diallo", matiere: "Histoire-Géo",  moyenne: 12.90, rang: 14, effectif: 32 },
  { eleve: "Sékou Touré",     matiere: "Mathématiques", moyenne: 11.20, rang: 18, effectif: 30 },
  { eleve: "Hadja Keita",     matiere: "Philosophie",   moyenne: 15.80, rang: 4,  effectif: 22 },
];

const salaires = [
  { nom: "M. Touré",       role: "Enseignant collège",     montant: "2 450 000", bon: "300 000", net: "2 150 000" },
  { nom: "Mme Diallo",     role: "Titulaire CM2",           montant: "1 800 000", bon: "0",       net: "1 800 000" },
  { nom: "M. Barry",       role: "Surveillant général",     montant: "1 250 000", bon: "150 000", net: "1 100 000" },
  { nom: "Mme Camara",     role: "Titulaire CP",             montant: "1 600 000", bon: "0",       net: "1 600 000" },
  { nom: "M. Bangoura",    role: "Enseignant lycée",         montant: "2 800 000", bon: "200 000", net: "2 600 000" },
  { nom: "Mme Soumah",     role: "Comptable",                montant: "1 900 000", bon: "0",       net: "1 900 000" },
  { nom: "M. Sylla",       role: "Enseignant philo (Tle)",   montant: "2 100 000", bon: "100 000", net: "2 000 000" },
  { nom: "Mme Keita",      role: "Bibliothécaire",            montant: "950 000",   bon: "0",       net: "950 000"   },
];

const edt = [
  { jour: "Lundi",    creneau: "08h-10h", classe: "6e A",   matiere: "Mathématiques", prof: "M. Touré" },
  { jour: "Lundi",    creneau: "10h-12h", classe: "4e B",   matiere: "SVT",            prof: "Mme Diallo" },
  { jour: "Mardi",    creneau: "08h-09h", classe: "2nde S", matiere: "Physique",       prof: "M. Bangoura" },
  { jour: "Mardi",    creneau: "10h-12h", classe: "Tle A",  matiere: "Philosophie",    prof: "M. Sylla" },
  { jour: "Mercredi", creneau: "08h-10h", classe: "5e A",   matiere: "Français",       prof: "Mme Camara" },
  { jour: "Jeudi",    creneau: "14h-16h", classe: "1ere D", matiere: "Anglais",        prof: "Mme Soumah" },
  { jour: "Vendredi", creneau: "08h-10h", classe: "3e A",   matiere: "Histoire-Géo",   prof: "M. Touré" },
];

const discipline = [
  { date: "2026-05-12", eleve: "Sékou Touré",     classe: "CM1",   type: "Absence",  motif: "Maladie",                  statut: "Justifiée" },
  { date: "2026-05-10", eleve: "Mamadou Bah",     classe: "CM2",   type: "Retard",   motif: "Transport",                statut: "Justifiée" },
  { date: "2026-05-08", eleve: "Ibrahima Condé",  classe: "4e B",  type: "Sanction", motif: "Indiscipline en classe",   statut: "Avertissement" },
  { date: "2026-05-05", eleve: "Aïssatou Diallo", classe: "6e A",  type: "Absence",  motif: "Non précisé",              statut: "Non justifiée" },
  { date: "2026-05-03", eleve: "Fatou Camara",    classe: "Tle A", type: "Retard",   motif: "Embouteillage",            statut: "Justifiée" },
];

const parentFeed = [
  { titre: "Bulletin disponible", detail: "Le bulletin du 2e trimestre est prêt dans le portail parent." },
  { titre: "Rappel de paiement", detail: "Le solde du mois de mai peut être régularisé en caisse." },
  { titre: "Annonce école", detail: "Composition blanche prévue la semaine prochaine pour les classes d'examen." },
  { titre: "Convocation réunion", detail: "Réunion parents-professeurs samedi 24 mai à 9h, salle polyvalente." },
];

// Bulletin mock pour aperçu modal
const bulletinDemo = {
  eleve: { nom: "Camara", prenom: "Fatou", matricule: "EDG-2024-0142", classe: "Terminale A", dateNaissance: "2007-03-14" },
  periode: "2e trimestre",
  annee: "2025-2026",
  ecole: "Groupe scolaire Djoma Démo",
  matieres: [
    { nom: "Mathématiques",   coef: 4, devoirs: 15.5, compo: 16.0, moyenne: 15.83, appreciation: "Très bon trimestre" },
    { nom: "Physique-Chimie", coef: 4, devoirs: 14.0, compo: 13.5, moyenne: 13.67, appreciation: "Travail régulier" },
    { nom: "SVT",             coef: 3, devoirs: 16.0, compo: 17.0, moyenne: 16.67, appreciation: "Excellent" },
    { nom: "Français",        coef: 3, devoirs: 14.5, compo: 15.0, moyenne: 14.83, appreciation: "Bien" },
    { nom: "Anglais",         coef: 2, devoirs: 17.0, compo: 17.5, moyenne: 17.33, appreciation: "Remarquable" },
    { nom: "Histoire-Géo",    coef: 3, devoirs: 13.0, compo: 12.5, moyenne: 12.67, appreciation: "Peut mieux faire" },
    { nom: "Philosophie",     coef: 4, devoirs: 15.0, compo: 15.5, moyenne: 15.33, appreciation: "Bonne réflexion" },
  ],
};

const tabs = [
  { id: "direction",  label: "📊 Direction" },
  { id: "notes",      label: "📝 Notes" },
  { id: "edt",        label: "🗓️ Emploi du temps" },
  { id: "discipline", label: "⚠️ Discipline" },
  { id: "compta",     label: "💰 Comptabilité" },
  { id: "enseignant", label: "👨‍🏫 Enseignant" },
  { id: "parents",    label: "👨‍👩‍👧 Parents" },
];

function tableCard(title, subtitle, header, rows) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 10px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--lc-text-brand, #0A1628)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>{subtitle}</p>
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
  const [bulletinOuvert, setBulletinOuvert] = useState(false);

  const moyGen = useMemo(() => {
    const totalCoef = bulletinDemo.matieres.reduce((s, m) => s + m.coef, 0);
    const totalPond = bulletinDemo.matieres.reduce((s, m) => s + m.moyenne * m.coef, 0);
    return (totalPond / totalCoef).toFixed(2);
  }, []);

  const tabContent = useMemo(() => {
    // ── Notes ────────────────────────────────────────────────
    if (tab === "notes") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ padding: 18, background: "linear-gradient(135deg,#0A1628,#14335f)", color: "#fff", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#fff" }}>Bulletins du 2e trimestre — Terminale A</h3>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>22 élèves, moyenne classe 13,42 / 20</p>
              </div>
              <Btn v="vert" onClick={() => setBulletinOuvert(true)}>📄 Aperçu d'un bulletin</Btn>
            </div>
          </Card>
          {tableCard(
            "Synthèse des moyennes par matière (extraits)",
            "Au secondaire, EduGest applique la formule (moy. cours + 2 × composition) / 3, avec coefficients par matière.",
            ["Élève", "Matière", "Moyenne", "Rang"],
            notes.map((item) => (
              <TR key={`${item.eleve}-${item.matiere}`}>
                <TD bold>{item.eleve}</TD>
                <TD>{item.matiere}</TD>
                <TD><strong style={{ color: item.moyenne >= 10 ? "#15803d" : "#b91c1c" }}>{item.moyenne.toFixed(2)} / 20</strong></TD>
                <TD>{item.rang}<span style={{ color: "var(--lc-text-faint, #94a3b8)", fontSize: 11 }}>/{item.effectif}</span></TD>
              </TR>
            )),
          )}
        </div>
      );
    }

    // ── Emploi du temps ──────────────────────────────────────
    if (tab === "edt") {
      return tableCard(
        "Emploi du temps — extrait de la semaine",
        "Vue partagée direction / enseignant / parent. La saisie se fait en glisser-déposer côté direction.",
        ["Jour", "Créneau", "Classe", "Matière", "Enseignant"],
        edt.map((item, i) => (
          <TR key={i}>
            <TD bold>{item.jour}</TD>
            <TD><Badge color="blue">{item.creneau}</Badge></TD>
            <TD>{item.classe}</TD>
            <TD>{item.matiere}</TD>
            <TD>{item.prof}</TD>
          </TR>
        )),
      );
    }

    // ── Discipline ────────────────────────────────────────────
    if (tab === "discipline") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Stat label="Absences justifiées" value="48" sub="ce mois-ci" />
            <Stat label="Absences non justifiées" value="12" sub="signalées aux parents" />
            <Stat label="Retards" value="27" sub="moyenne / élève : 0,03" />
            <Stat label="Sanctions" value="4" sub="conseil de discipline" />
          </div>
          {tableCard(
            "Derniers incidents enregistrés",
            "Les enseignants signalent depuis leur portail, la direction consolide.",
            ["Date", "Élève", "Classe", "Type", "Motif", "Statut"],
            discipline.map((item, i) => (
              <TR key={i}>
                <TD>{item.date}</TD>
                <TD bold>{item.eleve}</TD>
                <TD>{item.classe}</TD>
                <TD>
                  <Badge color={item.type === "Absence" ? "red" : item.type === "Retard" ? "amber" : "purple"}>{item.type}</Badge>
                </TD>
                <TD>{item.motif}</TD>
                <TD>
                  <Badge color={item.statut === "Justifiée" ? "green" : item.statut === "Avertissement" ? "amber" : "red"}>{item.statut}</Badge>
                </TD>
              </TR>
            )),
          )}
        </div>
      );
    }

    // ── Comptabilité ──────────────────────────────────────────
    if (tab === "compta") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "var(--lc-text-brand, #0A1628)" }}>Évolution recettes vs dépenses (en M GNF)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={evolPaiements}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}M`} />
                <Tooltip formatter={(v) => `${v} M GNF`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenus"  name="Recettes" fill="#00C48C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          {tableCard(
            "État des salaires — mai 2026 (extrait)",
            "Calcul automatique : forfait ou volume horaire × prime, déduction des bons, ajout des révisions.",
            ["Nom", "Fonction", "Montant brut", "Bon", "Net à payer"],
            salaires.map((item) => (
              <TR key={item.nom}>
                <TD bold>{item.nom}</TD>
                <TD>{item.role}</TD>
                <TD>{item.montant} GNF</TD>
                <TD style={{ color: Number(item.bon.replace(/\s/g, "")) > 0 ? "#b91c1c" : "var(--lc-text-faint, #94a3b8)" }}>{item.bon} GNF</TD>
                <TD style={{ color: "#0f766e", fontWeight: 700 }}>{item.net} GNF</TD>
              </TR>
            )),
          )}
        </div>
      );
    }

    // ── Portail enseignant (vue grille de saisie) ─────────────
    if (tab === "enseignant") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--lc-text-brand, #0A1628)" }}>📊 Saisie en grille — Mathématiques · 4e B</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>
                  L'enseignant saisit toute une classe en une fois, type d'évaluation au choix : Devoir, Interrogation, Évaluation orale, Évaluation écrite, Composition…
                </p>
              </div>
              <Badge color="vert">Évaluation écrite · T2</Badge>
            </div>
            <div style={{ border: "1px solid var(--lc-border, #e2e8f0)", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <THead cols={["#", "Élève", "Matricule", "Note /20"]} />
                <tbody>
                  {[
                    ["Aïssatou Diallo",   "EDG-0118", 14],
                    ["Mamadou Bah",       "EDG-0119", 11.5],
                    ["Ibrahima Condé",    "EDG-0120", 16],
                    ["Mariama Barry",     "EDG-0121", 12],
                    ["Kadiatou Sylla",    "EDG-0122", 15.5],
                    ["Mohamed Soumah",    "EDG-0123", 17],
                    ["Hadja Keita",       "EDG-0124", null],
                    ["Sékou Touré",       "EDG-0125", 9],
                  ].map(([nom, mat, val], i) => (
                    <TR key={mat}>
                      <TD center style={{ color: "var(--lc-text-faint, #94a3b8)" }}>{i + 1}</TD>
                      <TD bold>{nom}</TD>
                      <TD style={{ fontFamily: "monospace", fontSize: 11, color: "var(--lc-text-muted, #64748b)" }}>{mat}</TD>
                      <TD center>
                        <span style={{
                          display: "inline-block", width: 60, padding: "4px 8px",
                          border: `1.5px solid ${val == null ? "var(--lc-border, #e2e8f0)" : "#00C48C"}`,
                          borderRadius: 6, fontSize: 13, fontWeight: 700,
                          color: val == null ? "var(--lc-text-faint, #94a3b8)" : val >= 10 ? "#15803d" : "#b91c1c",
                          background: "var(--lc-input-bg, #fafbfc)",
                        }}>{val == null ? "—" : val}</span>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
              7 notes saisies sur 8 élèves — il reste 1 case vide. Cliquer sur 💾 Enregistrer enverra le tout en une seule opération.
            </div>
          </Card>
        </div>
      );
    }

    // ── Portail parent ───────────────────────────────────────
    if (tab === "parents") {
      return (
        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--lc-text-brand, #0A1628)" }}>Portail parent — Mme Camara (mère de Fatou)</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>
              Un parent voit les bulletins, les paiements, les absences et les messages de l'école dans un seul espace.
              Connexion par code école + numéro de téléphone parent.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {parentFeed.map((item) => (
                <div key={item.titre} style={{ border: "1px solid var(--lc-border, #e2e8f0)", borderRadius: 12, padding: "12px 14px", background: "var(--lc-surface-alt, #f8fafc)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: "var(--lc-text-brand, #0A1628)", fontSize: 14 }}>{item.titre}</strong>
                    <Badge color="blue">Lecture seule</Badge>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--lc-text-muted, #475569)", lineHeight: 1.6 }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>
          {tableCard(
            "Paiements et situation des élèves",
            "Exemple d'aperçu parent/comptabilité sur la même école.",
            ["Élève", "Classe", "Montant du mois", "Statut"],
            paiements.slice(0, 6).map((item) => (
              <TR key={item.eleve}>
                <TD bold>{item.eleve}</TD>
                <TD>{item.classe}</TD>
                <TD>{item.montant}</TD>
                <TD>
                  <Badge color={item.statut === "À jour" ? "green" : item.statut === "Partiel" ? "amber" : "red"}>{item.statut}</Badge>
                </TD>
              </TR>
            )),
          )}
        </div>
      );
    }

    // ── Vue direction (par défaut) ───────────────────────────
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {kpis.map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} sub={item.sub} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--lc-text-brand, #0A1628)" }}>Évolution mensuelle (M GNF)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evolPaiements}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
                <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
                <Tooltip />
                <Bar dataKey="revenus" name="Recettes" fill="#00C48C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--lc-text-brand, #0A1628)" }}>Répartition par section</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={repartitionSections} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {repartitionSections.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v} élèves`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
        {tableCard(
          "Paiements récents",
          "Suivi en temps réel pour la direction et la comptabilité.",
          ["Élève", "Classe", "Montant", "Statut"],
          paiements.slice(0, 6).map((item) => (
            <TR key={item.eleve}>
              <TD bold>{item.eleve}</TD>
              <TD>{item.classe}</TD>
              <TD>{item.montant}</TD>
              <TD>
                <Badge color={item.statut === "À jour" ? "green" : item.statut === "Partiel" ? "amber" : "red"}>{item.statut}</Badge>
              </TD>
            </TR>
          )),
        )}
      </div>
    );
  }, [tab]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#eef4fb 0%,#f8fbff 100%)", color: "var(--lc-text-brand, #0A1628)" }}>
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
                Cette démo vous montre comment une direction suit les élèves, les notes, la comptabilité, l'emploi du temps,
                la discipline, le portail enseignant et le portail parent — tout sur le même espace. Données fictives.
              </p>
            </div>
            <div style={{ minWidth: 240, alignSelf: "stretch", display: "grid", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>École</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>Groupe scolaire Djoma Démo</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Kindia · Guinée · 842 élèves</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parcours</div>
                <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>Direction · Enseignant · Comptable · Parent</div>
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

      {/* ── Modal aperçu bulletin ───────────────────────────── */}
      {bulletinOuvert && (
        <Modale xlarge titre={`Bulletin — ${bulletinDemo.eleve.prenom} ${bulletinDemo.eleve.nom} · ${bulletinDemo.periode}`} fermer={() => setBulletinOuvert(false)}>
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
            <Btn v="ghost" onClick={() => setBulletinOuvert(false)}>Fermer</Btn>
            <Btn onClick={onInscription}>Créer ma propre école →</Btn>
          </div>
        </Modale>
      )}
    </div>
  );
}

export { DemoEduGest };
