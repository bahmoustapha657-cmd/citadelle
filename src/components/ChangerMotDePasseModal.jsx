import { useChangerMdp } from "./changer-mdp/use-changer-mdp";
import * as s from "./changer-mdp/changer-mdp-styles";

function ChangerMotDePasseModal({ utilisateur, onDone }) {
  const { mdp1, setMdp1, mdp2, setMdp2, err, ok, busy, soumettre } = useChangerMdp({ onDone });

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#0A1628" }}>
            Changement de mot de passe requis
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
            Votre compte {utilisateur?.login ? <strong>{utilisateur.login}</strong> : "utilisateur"} utilise un mot de passe temporaire.
            Définissez un nouveau mot de passe avant de continuer.
          </p>
        </div>
        {ok ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <p style={{ color: "#059669", fontWeight: 700 }}>Mot de passe mis à jour.</p>
          </div>
        ) : (
          <form onSubmit={soumettre}>
            <label style={s.label}>Nouveau mot de passe</label>
            <input
              type="password"
              value={mdp1}
              onChange={(e) => setMdp1(e.target.value)}
              placeholder="Minimum 8 caractères"
              style={s.input}
              required
              autoFocus
            />
            <label style={s.label}>Confirmer le mot de passe</label>
            <input
              type="password"
              value={mdp2}
              onChange={(e) => setMdp2(e.target.value)}
              placeholder="Répétez le mot de passe"
              style={s.input}
              required
            />
            {err && <p style={s.erreur}>{err}</p>}
            <button type="submit" disabled={busy} style={s.submit(busy)}>
              {busy ? "Enregistrement..." : "Changer le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export { ChangerMotDePasseModal };
