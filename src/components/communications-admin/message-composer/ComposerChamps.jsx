import { NIVEAUX } from "../communications-constants";
import { inp, lab } from "./composer-styles";

// Champs principaux : titre, niveau et corps du message.
export function ComposerChamps({ titre, setTitre, corps, setCorps, niveau, setNiveau }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lab}>Titre</label>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre court et clair" style={inp} maxLength={120} />
        </div>
        <div>
          <label style={lab}>Niveau</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inp}>
            {NIVEAUX.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lab}>Message</label>
        <textarea
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder="Texte professionnel, sans mise en forme. Les retours à la ligne sont conservés."
          rows={5}
          maxLength={2000}
          style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
          {corps.length}/2000 caractères
        </div>
      </div>
    </>
  );
}
