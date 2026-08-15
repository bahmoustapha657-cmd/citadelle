import { C } from "../../../constants";
import { isSupabase } from "../../../backend";

// Barre d'outils : recherche + actions globales (création, actualisation,
// sync écoles publiques, migration année legacy).
//
// Les deux dernières sont des outils de l'ÈRE FIREBASE et n'ont plus d'objet :
//   • « Sync ecoles publiques » appelle /ecole-public-sync, fonction Vercel
//     disparue avec le passage à Cloudflare — elle ne répondait plus qu'un 405.
//     Sur Supabase la vitrine lit la RPC etat_ecole : aucun miroir à alimenter.
//   • « Migrer annee legacy » balaie tout Firestore en writeBatch pour poser le
//     champ `annee`. Le lancer aujourd'hui ne toucherait plus les vraies données.
// On les masque côté Supabase plutôt que de les supprimer : Firebase reste la
// production tant que toutes les écoles ne sont pas basculées.
export function EcolesToolbar({
  recherche, setRecherche,
  setCreationOuverte,
  chargerEcoles,
  lancerBackfillPublic, backfillEnCours,
  lancerMigrationAnnee, migrationAnneeEnCours,
  S,
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
      <input value={recherche} onChange={e => setRecherche(e.target.value)}
        placeholder="Rechercher une ecole..."
        style={{ ...S.input, flex: 1, minWidth: 200 }} />
      <button onClick={() => setCreationOuverte(true)}
        style={{ ...S.btn(C.blue), padding: "8px 18px", fontSize: 13, background: `linear-gradient(90deg,${C.blue},${C.green})` }}>
        + Nouvelle ecole
      </button>
      <button onClick={chargerEcoles}
        style={{ ...S.btn("#6b7280"), background: "#f3f4f6", color: "#374151", padding: "8px 14px", fontSize: 13 }}>
        Actualiser
      </button>
      {!isSupabase && (
        <>
          <button onClick={lancerBackfillPublic} disabled={backfillEnCours}
            style={{ ...S.btn("#6b7280"), background: "#eef2ff", color: "#3730a3", padding: "8px 14px", fontSize: 13, opacity: backfillEnCours ? 0.6 : 1 }}>
            {backfillEnCours ? "Synchro..." : "Sync ecoles publiques"}
          </button>
          <button onClick={lancerMigrationAnnee} disabled={migrationAnneeEnCours}
            style={{ ...S.btn("#6b7280"), background: "#fef3c7", color: "#92400e", padding: "8px 14px", fontSize: 13, opacity: migrationAnneeEnCours ? 0.6 : 1 }}
            title="Assigne le champ `annee` à toutes les données legacy (notes, recettes, dépenses, salaires, bons, versements, livrets).">
            {migrationAnneeEnCours ? "Migration..." : "Migrer annee legacy"}
          </button>
        </>
      )}
    </div>
  );
}
