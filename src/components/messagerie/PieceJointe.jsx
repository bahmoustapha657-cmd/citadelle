import { useEffect, useState } from "react";
import { urlStockage } from "../../backend/messagerie-supabase";
import { formatTaille, iconeFichier, imageAffichable, SEUIL_APERCU_AUTO } from "./documents";

// clair : sur la bulle « moi », couleur de l'école → écriture assortie.
const bouton = (clair) => ({
  background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 20%, transparent)" : "var(--lc-surface)",
  color: clair ? "var(--msg-encre, #fff)" : "var(--msg-accent, var(--sc1))",
  border: clair ? "none" : "1px solid var(--lc-border)", borderRadius: 8, padding: "4px 10px",
  fontSize: 11.5, fontWeight: 700, cursor: "pointer",
});

// Visionneuse plein écran : fond noir, boutons toujours blancs.
const boutonVisionneuse = { ...bouton(true), background: "rgba(255,255,255,0.2)", color: "#fff" };

function telecharger(url, nom) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nom || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Document partagé (discussion ou annonce) : vignette pour les photos
// (téléchargée d'office si légère, sinon sur demande), carte sinon, avec
// Ouvrir / Télécharger. Le fichier vient du bucket privé (blob: local).
export function PieceJointe({ chemin, nom, type, taille, clair = false }) {
  const photo = imageAffichable(type);
  const [url, setUrl] = useState(null);
  const [etat, setEtat] = useState("repos"); // repos | chargement | erreur
  const [agrandie, setAgrandie] = useState(false);

  const charger = async () => {
    if (url) return url;
    setEtat("chargement");
    try {
      const u = await urlStockage(chemin);
      setUrl(u);
      setEtat("repos");
      return u;
    } catch {
      setEtat("erreur");
      return null;
    }
  };

  // Photo légère : affichée sans attendre un geste.
  useEffect(() => {
    if (!photo || (taille || 0) > SEUIL_APERCU_AUTO) return undefined;
    let annule = false;
    urlStockage(chemin).then((u) => { if (!annule) setUrl(u); }).catch(() => { if (!annule) setEtat("erreur"); });
    return () => { annule = true; };
  }, [chemin, photo, taille]);

  const ouvrir = async (e) => {
    e.stopPropagation();
    const u = await charger();
    if (!u) return;
    if (photo) { setAgrandie(true); return; }
    // PDF, texte : lecture dans un onglet ; sinon (Word, Excel…) téléchargement.
    if (type === "application/pdf" || type?.startsWith("text/")) {
      if (!window.open(u, "_blank")) telecharger(u, nom);
    } else {
      telecharger(u, nom);
    }
  };

  const enregistrer = async (e) => {
    e.stopPropagation();
    const u = await charger();
    if (u) telecharger(u, nom);
  };

  if (photo && url) {
    return (
      <>
        <img src={url} alt={nom} onClick={(e) => { e.stopPropagation(); setAgrandie(true); }}
          style={{ display: "block", maxWidth: "min(260px, 100%)", maxHeight: 260, borderRadius: 10, cursor: "zoom-in", objectFit: "cover" }} />
        {agrandie && (
          <div onClick={(e) => { e.stopPropagation(); setAgrandie(false); }} role="dialog" aria-label={nom}
            style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16, textAlign: "start" }}>
            <img src={url} alt={nom} style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 8 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={boutonVisionneuse} onClick={enregistrer}>⬇️ Télécharger</button>
              <button type="button" style={boutonVisionneuse} onClick={() => setAgrandie(false)}>✕ Fermer</button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, minWidth: 200, maxWidth: 300, padding: "8px 10px", borderRadius: 10,
      background: clair ? "color-mix(in srgb, var(--msg-encre, #fff) 14%, transparent)" : "var(--lc-surface-alt)", border: clair ? "none" : "1px solid var(--lc-border)",
    }}>
      <span style={{ fontSize: 26, lineHeight: 1 }}>{iconeFichier(type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nom}>{nom}</div>
        <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>
          {etat === "erreur" ? "Fichier indisponible" : etat === "chargement" ? "Téléchargement…" : formatTaille(taille)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button type="button" style={bouton(clair)} onClick={ouvrir} disabled={etat === "chargement"}>
            {photo ? "🖼️ Afficher" : "Ouvrir"}
          </button>
          <button type="button" style={bouton(clair)} onClick={enregistrer} disabled={etat === "chargement"}>⬇️</button>
        </div>
      </div>
    </div>
  );
}
