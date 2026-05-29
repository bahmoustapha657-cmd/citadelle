import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge, Btn, Card, Stat, THead, TR, TD } from "../ui";
import { kpis, repartitionSections, evolPaiements, paiements, notes, salaires, edt, discipline, parentFeed } from "./demo-data";

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

export function DemoTabContent({ tab, onApercuBulletin }) {
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
            <Btn v="vert" onClick={onApercuBulletin}>📄 Aperçu d'un bulletin</Btn>
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
}
