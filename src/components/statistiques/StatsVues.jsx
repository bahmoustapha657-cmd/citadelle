import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { C, fmt } from "../../constants";
import { Card, Stat, TD, THead, TR, Vide } from "../ui";
import { statsGenre, statsGroupe, statsParClasse, moyenneParMatiere, evolutionMoyenne } from "../ecole/apercu-tab/analytics";

const PALETTE = ["#0A1628", "#00C48C", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
const Bloc = ({ titre, children, aide }) => (
  <Card style={{ marginTop: 14 }}><div style={{ padding: "14px 16px" }}>
    <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 13, color: C.blueDark }}>{titre}</p>
    {aide && <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--lc-text-faint)" }}>{aide}</p>}
    {children}
  </div></Card>
);
const grille = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 };

// ── RÉSULTATS ───────────────────────────────────────────────────────────────
export function VueResultats({ s }) {
  const { eleves, notes, matieresForClasse, classes, periode, periodes, section } = s;
  const seuil = section.seuil;
  const global = statsGroupe(eleves, notes, matieresForClasse, periode, seuil);
  const parClasse = statsParClasse(classes, eleves, notes, matieresForClasse, periode, seuil);
  const parMatiere = moyenneParMatiere(eleves, notes, matieresForClasse, periode);
  const evolution = evolutionMoyenne(eleves, notes, matieresForClasse, periodes, seuil);
  const genre = statsGenre(eleves, notes, matieresForClasse, periode, seuil);

  if (!global.evalues) return <Vide icone="📊" msg={`Aucune note saisie pour ${periode} — rien à analyser sur cette période.`} />;

  return (
    <div>
      <div style={grille}>
        <Stat label="Moyenne de la section" value={global.moyenne ? global.moyenne.toFixed(2) : "—"} sub={`sur ${section.maxNote}`} bg="#e0ebf8" />
        <Stat label="Taux de réussite" value={`${global.taux.toFixed(1)}%`} sub={`seuil ${seuil}/${section.maxNote}`} bg={global.taux >= 50 ? "#eaf4e0" : "#fce8e8"} />
        <Stat label="Élèves évalués" value={global.evalues} sub={`sur ${global.effectif}`} bg="#f3f4f6" />
        <Stat label="Admis" value={global.admis} sub={`${global.evalues - global.admis} sous le seuil`} bg="#eaf4e0" />
      </div>

      <Bloc titre="Réussite par classe" aide="Les classes les plus en difficulté méritent le premier regard.">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={[...parClasse].sort((a, b) => a.taux - b.taux)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="classe" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
            <Tooltip formatter={(v, n) => (n === "taux" ? `${Number(v).toFixed(1)}%` : v)} />
            <Bar dataKey="taux" name="Taux de réussite" radius={[4, 4, 0, 0]}>
              {parClasse.map((c, i) => <Cell key={i} fill={c.taux >= 50 ? C.green : "#ef4444"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Bloc>

      <Bloc titre="Moyenne par matière" aide="Trié du plus faible au plus fort : les premières lignes sont les matières à soutenir.">
        <ResponsiveContainer width="100%" height={Math.max(200, parMatiere.length * 26)}>
          <BarChart data={[...parMatiere].sort((a, b) => a.moyenne - b.moyenne)} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis type="number" domain={[0, section.maxNote]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="matiere" tick={{ fontSize: 11 }} width={130} />
            <Tooltip formatter={(v) => Number(v).toFixed(2)} />
            <Bar dataKey="moyenne" name="Moyenne" fill={C.blue} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Bloc>

      <Bloc titre="Évolution sur l'année" aide="Moyenne de la section et taux de réussite, période par période.">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={evolution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => (v == null ? "—" : Number(v).toFixed(2))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke={C.blue} strokeWidth={2} />
            <Line type="monotone" dataKey="taux" name="Réussite (%)" stroke={C.green} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Bloc>

      <Bloc titre="Filles / Garçons" aide="Un écart durable entre les deux groupes est un signal pédagogique, pas une fatalité.">
        <div style={grille}>
          <Stat label="Filles — moyenne" value={genre.filles.moyenne ? genre.filles.moyenne.toFixed(2) : "—"} sub={`${genre.filles.evalues} évaluées · ${genre.filles.taux.toFixed(0)}% de réussite`} bg="#fdf2f8" />
          <Stat label="Garçons — moyenne" value={genre.garcons.moyenne ? genre.garcons.moyenne.toFixed(2) : "—"} sub={`${genre.garcons.evalues} évalués · ${genre.garcons.taux.toFixed(0)}% de réussite`} bg="#eff6ff" />
        </div>
      </Bloc>
    </div>
  );
}

// ── ASSIDUITÉ ───────────────────────────────────────────────────────────────
export function VueAssiduite({ s }) {
  const a = s.assiduite;
  if (a.vide) {
    return <Vide icone="🗓️" msg="Aucune absence enregistrée pour cette section — le module Discipline n'a pas encore été utilisé. Les analyses apparaîtront dès les premières saisies." />;
  }
  return (
    <div>
      <div style={grille}>
        <Stat label="Absences enregistrées" value={a.total} sub={`${a.moyenneParEleve.toFixed(1)} par élève`} bg="#e0ebf8" />
        <Stat label="Justifiées" value={`${a.tauxJustifie.toFixed(0)}%`} sub={`${a.justifiees} sur ${a.total}`} bg="#eaf4e0" />
        <Stat label="Non justifiées" value={a.total - a.justifiees} sub="à traiter" bg="#fce8e8" />
      </div>

      <Bloc titre="Par classe">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={a.parClasse.slice(0, 15)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="classe" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="valeur" name="Absences" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Bloc>

      <Bloc titre="Élèves les plus absents" aide="Le signal d'alerte le plus utile au surveillant : dix noms valent mieux qu'un total d'école.">
        <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Élève", "Classe", "Absences", "Non justifiées"]} />
          <tbody>{a.alerte.map((e, i) => (
            <TR key={i}><TD bold>{e.nom}</TD><TD>{e.classe}</TD><TD>{e.total}</TD>
              <TD><span style={{ color: e.nonJustifiees > 0 ? "#b91c1c" : "#6b7280", fontWeight: 700 }}>{e.nonJustifiees}</span></TD>
            </TR>
          ))}</tbody>
        </table></div>
      </Bloc>

      {a.parMotif.length > 0 && (
        <Bloc titre="Motifs déclarés">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={a.parMotif} dataKey="valeur" nameKey="motif" cx="50%" cy="50%" outerRadius={80}
                label={({ motif, percent }) => `${motif} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {a.parMotif.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Bloc>
      )}
    </div>
  );
}

// ── FINANCES ────────────────────────────────────────────────────────────────
export function VueFinances({ s }) {
  const f = s.finances;
  return (
    <div>
      <div style={grille}>
        <Stat label="Attendu sur l'année" value={fmt(f.du)} sub="toutes sections" bg="#e0ebf8" />
        <Stat label="Encaissé" value={fmt(f.percu)} sub={`${f.taux.toFixed(1)}% du dû`} bg={f.taux >= 70 ? "#eaf4e0" : "#fef3e0"} />
        <Stat label="Reste à recouvrer" value={fmt(f.impaye)} sub="impayés" bg="#fce8e8" />
        <Stat label="Tarif mensuel moyen" value={fmt(f.tarifMoyen)} sub="par élève" bg="#f3f4f6" />
      </div>

      <Bloc titre="Recouvrement par classe" aide="Les classes les plus en retard en premier — c'est là que la relance est la plus rentable.">
        <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Classe", "Élèves", "À jour", "Attendu", "Encaissé", "Impayé", "Taux"]} />
          <tbody>{f.classes.map((c) => (
            <TR key={c.classe}>
              <TD bold>{c.classe}</TD><TD>{c.eleves}</TD><TD>{c.aJour}</TD>
              <TD>{fmt(c.du)}</TD><TD>{fmt(c.percu)}</TD>
              <TD><span style={{ color: c.impaye > 0 ? "#b91c1c" : "#15803d", fontWeight: 700 }}>{fmt(c.impaye)}</span></TD>
              <TD><span style={{ fontWeight: 800, color: c.taux >= 70 ? "#15803d" : c.taux >= 40 ? "#d97706" : "#b91c1c" }}>{c.taux.toFixed(0)}%</span></TD>
            </TR>
          ))}</tbody>
        </table></div>
      </Bloc>

      {f.parMois.length > 0 && (
        <Bloc titre="Encaissements mois par mois" aide="Source : le journal des paiements. Il ne contient que les encaissements postérieurs à sa mise en service.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={f.parMois}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="montant" name="Encaissé" fill={C.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Bloc>
      )}

      {f.frais.length > 0 && (
        <Bloc titre="Frais annexes encaissés" aide="Nombre d'élèves ayant réglé chaque frais.">
          <ResponsiveContainer width="100%" height={Math.max(180, f.frais.length * 28)}>
            <BarChart data={f.frais} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="frais" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="eleves" name="Élèves" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Bloc>
      )}
    </div>
  );
}

// ── EFFECTIFS ───────────────────────────────────────────────────────────────
export function VueEffectifs({ s }) {
  const e = s.effectifs;
  const mixite = [{ name: "Filles", value: e.sexe.F }, { name: "Garçons", value: e.sexe.M }];
  return (
    <div>
      <div style={grille}>
        <Stat label="Élèves actifs" value={e.actifs} sub={`${e.total} fiches au total`} bg="#e0ebf8" />
        <Stat label="Réinscrits" value={e.reinscrits} sub={`${e.aReinscrire} à réinscrire`} bg={e.aReinscrire ? "#fef3e0" : "#eaf4e0"} />
        <Stat label="Anciens élèves" value={e.anciens} sub="au moins une année archivée" bg="#f3f4f6" />
        <Stat label="Départs" value={e.partis} sub="hors effectif actif" bg="#fce8e8" />
      </div>

      <Bloc titre="Effectif par classe">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={e.parClasse}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="classe" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="valeur" name="Élèves" fill={C.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Bloc>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <Bloc titre="Mixité">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mixite} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                <Cell fill="#ec4899" /><Cell fill="#3b82f6" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Bloc>
        <Bloc titre="Motifs de départ" aide="Ce que disent les fiches des élèves sortis.">
          {e.parMotifDepart.length === 0
            ? <p style={{ fontSize: 12, color: "var(--lc-text-faint)", margin: 0 }}>Aucun motif renseigné.</p>
            : (
              <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
                <THead cols={["Motif", "Élèves"]} />
                <tbody>{e.parMotifDepart.map((m, i) => <TR key={i}><TD>{m.motif}</TD><TD bold>{m.valeur}</TD></TR>)}</tbody>
              </table></div>
            )}
        </Bloc>
      </div>
    </div>
  );
}

// ── ENSEIGNANTS ─────────────────────────────────────────────────────────────
export function VueEnseignants({ s }) {
  const p = s.enseignants;
  if (!p.total) return <Vide icone="👨‍🏫" msg="Aucun enseignant enregistré pour cette section." />;
  return (
    <div>
      <div style={grille}>
        <Stat label="Enseignants" value={p.total} sub={`${p.sansCreneau} sans emploi du temps`} bg="#e0ebf8" />
        <Stat label="Heures hebdomadaires" value={p.heuresTotal} sub="tous enseignants" bg="#eaf4e0" />
        <Stat label="Créneaux" value={p.creneauxTotal} sub="à l'emploi du temps" bg="#f3f4f6" />
      </div>

      <Bloc titre="Charge et activité" aide="Heures issues de l'emploi du temps ; notes saisies sur l'année consultée. Un enseignant sans créneau ni note mérite une vérification.">
        <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Enseignant", "Matière", "Classes", "Créneaux", "Heures/sem.", "Notes saisies"]} />
          <tbody>{p.lignes.map((l, i) => (
            <TR key={i}>
              <TD bold>{l.nom}</TD><TD>{l.matiere}</TD><TD>{l.classes}</TD><TD>{l.creneaux}</TD>
              <TD bold>{l.heures}</TD>
              <TD><span style={{ color: l.notesSaisies ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{l.notesSaisies}</span></TD>
            </TR>
          ))}</tbody>
        </table></div>
      </Bloc>
    </div>
  );
}
