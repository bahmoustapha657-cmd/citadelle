import { HERO_STATS } from "./landing-content";

// Maquette "tableau de bord" illustrative affichée sous le hero.
export function LandingHeroDashboard() {
  return (
    <div className="landing-fade-up landing-delay-4 landing-dashboard" style={{ padding: "18px 18px 20px" }}>
      <div className="landing-dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 16, position: "relative" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1.3px", fontWeight: 800 }}>Vue direction</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Votre école, en un seul tableau clair</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="landing-bounce-1" style={{ width: 10, height: 10, borderRadius: "50%", background: "#00C48C", display: "inline-block" }} />
          <span className="landing-bounce-2" style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
          <span className="landing-bounce-3" style={{ width: 10, height: 10, borderRadius: "50%", background: "#60A5FA", display: "inline-block" }} />
        </div>
      </div>
      <div className="landing-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, position: "relative" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="landing-grid-chip" style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.45)", fontWeight: 800 }}>Aujourd'hui</div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
              {HERO_STATS.map((stat, idx) => (
                <div key={stat.label}>
                  <div className="landing-stat-value" style={{ fontSize: 22, fontWeight: 900, color: "#00C48C", animationDelay: `${700 + idx * 150}ms` }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", lineHeight: 1.5 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-grid-chip" style={{ textAlign: "left", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Notes</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Bulletins prêts</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Paiements</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Suivi instantané</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>EDT</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Vue par section</div>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="landing-grid-chip" style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Aperçu</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.62)" }}>Encaissements</span>
                <strong>+ 4 aujourd'hui</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.62)" }}>Salaires</span>
                <strong>Prêts à imprimer</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.62)" }}>Parents</span>
                <strong>Portail actif</strong>
              </div>
            </div>
          </div>
          <div className="landing-grid-chip" style={{ textAlign: "left", background: "linear-gradient(135deg, rgba(0,196,140,0.14), rgba(96,165,250,0.09))" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800 }}>Promesse EduGest</div>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 800, lineHeight: 1.4 }}>Moins de confusion, plus de visibilité pour la direction, les enseignants et les parents.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
