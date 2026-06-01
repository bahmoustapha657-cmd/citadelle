// Section galerie photos avec lightbox (navigation précédent/suivant).
export function GalerieSection({ photos, c2, galIndex, setGalIndex }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ padding: "60px 24px", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: c2, marginBottom: 8 }}>Notre établissement</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,4vw,32px)", fontWeight: 900, color: "#0A1628" }}>📸 Galerie</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {photos.map((p, i) => (
            <div key={i} onClick={() => setGalIndex(i)} style={{ cursor: "zoom-in", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", background: "#e2e8f0" }}>
              <img src={p.url} alt={p.caption || ""} style={{ width: "100%", height: 160, objectFit: "cover", display: "block", transition: "transform .3s" }}
                onMouseEnter={e => e.target.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.target.style.transform = ""} />
              {p.caption && <div style={{ padding: "8px 12px", fontSize: 12, color: "#475569", fontWeight: 600 }}>{p.caption}</div>}
            </div>
          ))}
        </div>
      </div>
      {/* Lightbox */}
      {galIndex !== null && (
        <div onClick={() => setGalIndex(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <button onClick={e => { e.stopPropagation(); setGalIndex(i => Math.max(0, i - 1)); }}
            style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 24, width: 48, height: 48, borderRadius: "50%", cursor: "pointer" }}>‹</button>
          <img src={photos[galIndex]?.url} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
          <button onClick={e => { e.stopPropagation(); setGalIndex(i => Math.min(photos.length - 1, i + 1)); }}
            style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 24, width: 48, height: 48, borderRadius: "50%", cursor: "pointer" }}>›</button>
          {photos[galIndex]?.caption && <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.7)", fontSize: 13, background: "rgba(0,0,0,0.5)", padding: "6px 16px", borderRadius: 20 }}>{photos[galIndex].caption}</div>}
        </div>
      )}
    </div>
  );
}
