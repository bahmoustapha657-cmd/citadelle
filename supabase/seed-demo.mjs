// ════════════════════════════════════════════════════════════════════════
//  EduGest — Seed de démonstration (école « demo », données FICTIVES)
// ════════════════════════════════════════════════════════════════════════
// Peuple l'école demo avec des classes, élèves, matières, notes, tarifs et
// quelques paiements pour une démo réaliste (aucune donnée réelle). Idempotent :
// purge d'abord les données de démo. node supabase/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const ANNEE = "2025-2026";

const PRENOMS_M = ["Mamadou", "Ousmane", "Ibrahima", "Alpha", "Sékou", "Mohamed", "Amadou", "Thierno", "Fodé", "Lansana"];
const PRENOMS_F = ["Fatoumata", "Aïssatou", "Mariama", "Kadiatou", "Hawa", "Fanta", "Djénabou", "Ramatoulaye", "Néné", "Oumou"];
const NOMS = ["Diallo", "Barry", "Bah", "Camara", "Sow", "Baldé", "Condé", "Touré", "Keïta", "Cissé", "Sylla", "Traoré", "Kaba", "Soumah"];
const pick = (arr, i) => arr[i % arr.length];
const rnote = () => Math.round((7 + Math.random() * 10) * 4) / 4; // 7 à 17, pas 0.25

const MATIERES = {
  college: [["Français", 4], ["Mathématiques", 4], ["Anglais", 2], ["Histoire-Géographie", 2], ["SVT", 2], ["Physique-Chimie", 2], ["Éducation Civique", 1], ["EPS", 1]],
  primaire: [["Français", 3], ["Mathématiques", 3], ["Éveil", 2], ["Lecture", 2], ["Éducation Physique", 1]],
};
const TYPES = ["Devoir", "Composition"];
const MOIS = ["Oct", "Nov", "Déc", "Jan", "Fév"];

async function main() {
  const { data: ec } = await sb.from("ecoles").select("id").eq("code", "demo").single();
  const ecole_id = ec.id;
  console.log("École demo:", ecole_id);

  // Purge des données de démo existantes.
  await sb.from("notes").delete().eq("ecole_id", ecole_id);
  await sb.from("eleves").delete().eq("ecole_id", ecole_id);
  await sb.from("classes").delete().eq("ecole_id", ecole_id);
  await sb.from("matieres").delete().eq("ecole_id", ecole_id);
  await sb.from("tarifs").delete().eq("ecole_id", ecole_id);
  console.log("Purge OK");

  const classes = [
    { section: "college", nom: "7ème Année A", n: 16, montant: 150000, ins: 100000, rev: 10000, frais: { uniforme: 75000, cantine: 50000 } },
    { section: "college", nom: "8ème Année A", n: 14, montant: 150000, ins: 100000, rev: 10000, frais: { uniforme: 75000 } },
    { section: "primaire", nom: "CM2 A", n: 12, montant: 120000, ins: 80000, rev: 0, frais: { uniforme: 60000, transport: 40000 } },
  ];

  for (const cl of classes) {
    await sb.from("classes").insert({ ecole_id, section: cl.section, nom: cl.nom, effectif: cl.n, extra: {} });
    await sb.from("tarifs").insert({ ecole_id, section: cl.section, classe: cl.nom, montant: cl.montant,
      extra: { inscription: cl.ins, reinscription: Math.round(cl.ins * 0.8), revision: cl.rev, fraisDivers: cl.frais } });

    const eleves = [];
    for (let i = 0; i < cl.n; i++) {
      const f = i % 2 === 0;
      eleves.push({
        ecole_id, section: cl.section, classe: cl.nom,
        nom: pick(NOMS, i * 3 + 1), prenom: f ? pick(PRENOMS_F, i) : pick(PRENOMS_M, i),
        sexe: f ? "F" : "M",
        matricule: `${cl.section === "primaire" ? "P" : "C"}25-${String(100 + i)}`,
        date_naissance: `${2011 - (cl.section === "primaire" ? 0 : 2)}-0${(i % 9) + 1}-15`,
        tuteur: `${pick(PRENOMS_M, i + 3)} ${pick(NOMS, i)}`,
        contact_tuteur: `62${(2 + (i % 7))} ${String(100000 + i * 137).slice(0, 2)} ${String(100000 + i * 311).slice(0, 2)} ${String(10 + i).slice(0, 2)}`,
        statut: "Actif",
        // Paiements : ~70% des élèves ont réglé octobre→décembre, inscription payée.
        extra: i % 10 < 7 ? {
          inscriptionPayee: true, inscriptionDate: "05/10/2025",
          mens: Object.fromEntries(MOIS.slice(0, 3).map((m) => [m, "Payé"])),
          mensDates: Object.fromEntries(MOIS.slice(0, 3).map((m) => [m, "10/" + m])),
        } : { inscriptionPayee: i % 3 === 0 },
      });
    }
    const { data: eleveRows } = await sb.from("eleves").insert(eleves).select("id");
    console.log(`  ${cl.nom}: ${eleveRows.length} élèves`);

    // Notes T1 : Devoir + Composition par matière pour chaque élève.
    const notes = [];
    for (const el of eleveRows) {
      for (const [matiere] of MATIERES[cl.section]) {
        for (const type of TYPES) {
          notes.push({ ecole_id, section: cl.section, eleve_id: el.id, matiere, type, periode: "T1", note: rnote(), annee: ANNEE, enseignant_nom: "M. Diallo" });
        }
      }
    }
    // Insertion par lots de 500.
    for (let i = 0; i < notes.length; i += 500) {
      await sb.from("notes").insert(notes.slice(i, i + 500));
    }
    console.log(`  ${cl.nom}: ${notes.length} notes`);

    // Matières de la section (une seule fois par section).
  }

  // Matières (par section, dédupliquées).
  const matieresRows = [];
  for (const section of ["college", "primaire"]) {
    for (const [nom, coefficient] of MATIERES[section]) {
      matieresRows.push({ ecole_id, section, nom, coefficient, extra: {} });
    }
  }
  await sb.from("matieres").insert(matieresRows);
  console.log(`Matières: ${matieresRows.length}`);

  console.log("\n🎉 Seed démo terminé. Connexion : code « demo », identifiant « direction », mdp « Demo1234! ».");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
