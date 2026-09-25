import { useState } from "react";
import { C } from "../../../constants";
import { Btn } from "../../ui";
import { nomTrancheParDefaut, periodeTranche, proposerTranches } from "../../../paiements-scolarite";

// Brouillon d'édition : une tranche = son nom et l'index de son DERNIER mois.
// Les tranches se suivent sans trou ni chevauchement et couvrent toute
// l'année : le début de chacune est le lendemain de la fin de la précédente.
const versBrouillon = (tranches, moisAnnee) => {
  let attendu = 0;
  const brouillon = [];
  for (const t of tranches) {
    const debut = moisAnnee.indexOf(t.mois[0]);
    const fin = moisAnnee.indexOf(t.mois[t.mois.length - 1]);
    if (debut !== attendu || fin < debut) return null;
    brouillon.push({ nom: t.nom, fin });
    attendu = fin + 1;
  }
  return attendu === moisAnnee.length ? brouillon : null;
};
const depuisBrouillon = (brouillon, moisAnnee) => brouillon.map((b, i) => ({
  nom: b.nom.trim() || nomTrancheParDefaut(i),
  mois: moisAnnee.slice(i === 0 ? 0 : brouillon[i - 1].fin + 1, b.fin + 1),
}));
const proposition = (moisAnnee, nb) => proposerTranches(moisAnnee, nb)
  .map((t) => ({ nom: t.nom, fin: moisAnnee.indexOf(t.mois[t.mois.length - 1]) }));

// Réglage des tranches de paiement (ex. T1 = Octobre–Décembre). Payer une
// tranche paie ses mois d'un coup ; la grille garde les mois. C'est un réglage
// d'école : seules la direction et l'administration le modifient.
export function TranchesPaiement({ tranches = [], moisAnnee = [], peutRegler, sauverTranches, toast }) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState(null); // null : pas d'édition en cours
  const [enCours, setEnCours] = useState(false);

  const editer = () => setBrouillon(versBrouillon(tranches, moisAnnee) || proposition(moisAnnee, 3));
  const nb = brouillon?.length || 0;
  const changerNombre = (n) => setBrouillon(n > 0 ? proposition(moisAnnee, n) : []);
  // Fin de la tranche i : chaque tranche suivante garde au moins un mois.
  const changerFin = (i, fin) => setBrouillon((b) => b.map((t, j) => {
    if (j === i) return { ...t, fin };
    if (j > i) return { ...t, fin: Math.max(t.fin, fin + (j - i)) };
    return t;
  }));
  const renommer = (i, nom) => setBrouillon((b) => b.map((t, j) => (j === i ? { ...t, nom } : t)));

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await sauverTranches(depuisBrouillon(brouillon, moisAnnee));
      toast?.(brouillon.length ? "Tranches de paiement enregistrées." : "Tranches supprimées.", "success");
      setBrouillon(null);
    } catch (e) {
      toast?.(e?.message || "Enregistrement impossible.", "error");
    } finally {
      setEnCours(false);
    }
  };

  const champ = { border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 6px", fontSize: 12 };

  return (
    <div style={{ marginBottom: 16, border: "1px solid #b0c4d8", borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setOuvert((o) => !o)}
        style={{ width: "100%", background: "#f0f6ff", border: "none", padding: "11px 16px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.blueDark }}>
        <span style={{ textAlign: "start" }}>
          Tranches de paiement{" "}
          <span style={{ fontWeight: 400, color: "#64748b" }}>
            {tranches.length ? `— ${tranches.map((t) => `${t.nom} : ${periodeTranche(t)}`).join(" · ")}` : "— aucune (paiement au mois)"}
          </span>
        </span>
        <span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280" }}>{ouvert ? "Fermer" : "Voir / Modifier"}</span>
      </button>
      {ouvert && (
        <div style={{ padding: "14px 18px", background: "var(--lc-surface, #fff)", fontSize: 12.5, color: "#475569", textAlign: "start" }}>
          <p style={{ margin: "0 0 10px" }}>
            Une tranche regroupe des mois qui se paient ensemble (ex. 1re tranche = Octobre–Décembre).
            Dans la fenêtre 💰 Encaisser, choisir une tranche paie tous ses mois d'un coup ; un montant
            partiel se répartit sur ses mois dans l'ordre. La grille garde l'affichage mois par mois.
          </p>
          {!peutRegler && (
            <p style={{ margin: "0 0 10px", color: "#94a3b8" }}>
              Réglage d'école : seules la direction et l'administration peuvent modifier les tranches.
            </p>
          )}

          {brouillon === null ? (
            peutRegler && <Btn sm onClick={editer}>{tranches.length ? "Modifier les tranches" : "Définir des tranches"}</Btn>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 700 }}>Nombre de tranches :</span>
                <select value={nb} onChange={(ev) => changerNombre(Number(ev.target.value))} style={champ}>
                  <option value={0}>Aucune</option>
                  {[2, 3, 4, 5, 6].filter((n) => n <= moisAnnee.length).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {brouillon.map((t, i) => {
                const debut = i === 0 ? 0 : brouillon[i - 1].fin + 1;
                const derniere = i === nb - 1;
                // Fins possibles : de son premier mois jusqu'à laisser un mois
                // à chacune des tranches suivantes.
                const finMax = moisAnnee.length - 1 - (nb - 1 - i);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <input value={t.nom} onChange={(ev) => renommer(i, ev.target.value)} style={{ ...champ, width: 130 }}
                      aria-label={`Nom de la tranche ${i + 1}`} />
                    <span>de <strong>{moisAnnee[debut]}</strong> à</span>
                    {derniere ? <strong>{moisAnnee[moisAnnee.length - 1]}</strong> : (
                      <select value={t.fin} onChange={(ev) => changerFin(i, Number(ev.target.value))} style={champ}
                        aria-label={`Dernier mois de la tranche ${i + 1}`}>
                        {moisAnnee.map((m, idx) => (idx >= debut && idx <= finMax
                          ? <option key={m} value={idx}>{m}</option> : null))}
                      </select>
                    )}
                    <span style={{ color: "#94a3b8" }}>({(derniere ? moisAnnee.length - 1 : t.fin) - debut + 1} mois)</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn sm v="success" onClick={enregistrer} disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer"}</Btn>
                <Btn sm v="ghost" onClick={() => setBrouillon(null)} disabled={enCours}>Annuler</Btn>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
