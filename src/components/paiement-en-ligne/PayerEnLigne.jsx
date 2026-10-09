import { useEffect, useState } from "react";
import { fmt } from "../../constants";
import { Btn, Modale } from "../ui";
import {
  ciblesPaiement, etatPaiementEnLigne, fraisPaiement, initierPaiement,
} from "../../backend/paiement-en-ligne";

// ══════════════════════════════════════════════════════════════
//  « Payer en ligne » — portail parent, onglet Paiements
// ══════════════════════════════════════════════════════════════
// Le parent choisit ce qu'il paie (mensualités, une tranche, l'inscription,
// un frais), le montant (proposé comme à la caisse, jamais au-delà du reste)
// et voit les frais de l'opérateur, à sa charge. Il part ensuite sur la page
// de paiement de l'opérateur (Orange Money, MTN MoMo…) ; au retour,
// RetourPaiement affiche le résultat.
export function PayerEnLigne({ eleve, c1 }) {
  const [etat, setEtat] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let actif = true;
    etatPaiementEnLigne().then((e) => { if (actif) setEtat(e); }).catch(() => {});
    return () => { actif = false; };
  }, []);
  if (!etat?.actif || !eleve?._id) return null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", marginBottom: 16, borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
        <div style={{ fontSize: 13, color: "#065f46" }}>
          <strong>💳 Payer en ligne</strong> — Orange Money, MTN MoMo… depuis votre téléphone.
          {etat.mode === "test" && <span style={{ marginInlineStart: 8, fontSize: 11, color: "#b45309" }}>(mode test : aucun argent réel)</span>}
        </div>
        <Btn v="success" onClick={() => setOuvert(true)}>Payer en ligne</Btn>
      </div>
      {ouvert && <PayerModale eleve={eleve} etat={etat} c1={c1} fermer={() => setOuvert(false)} />}
    </>
  );
}

function PayerModale({ eleve, etat, c1, fermer }) {
  const [cibles, setCibles] = useState(null);
  const [erreur, setErreur] = useState("");
  const [cle, setCle] = useState("");
  const [montant, setMontant] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    ciblesPaiement(eleve._id).then((r) => {
      if (!actif) return;
      setCibles(r.cibles);
      if (r.cibles[0]) { setCle(r.cibles[0].cle); setMontant(String(r.cibles[0].propose)); }
    }).catch((e) => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, [eleve._id]);

  const cible = (cibles || []).find((c) => c.cle === cle);
  const somme = Math.round(Number(montant) || 0);
  const frais = fraisPaiement(somme, etat.fraisPourcent);
  const valide = cible && somme > 0 && somme <= cible.reste;

  const payer = async () => {
    if (!valide || enCours) return;
    setEnCours(true); setErreur("");
    try {
      const { lien } = await initierPaiement({ eleveId: eleve._id, cle, montant: somme });
      window.location.assign(lien);
    } catch (e) {
      setErreur(e.message);
      setEnCours(false);
    }
  };

  const nom = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim();
  return (
    <Modale titre={`💳 Payer en ligne — ${nom}`} fermer={fermer}>
      {!cibles && !erreur && <p style={{ fontSize: 13 }}>Chargement…</p>}
      {cibles && !cibles.length && <p style={{ fontSize: 13 }}>Rien à payer pour le moment : tout est réglé. 👍</p>}
      {cibles?.length > 0 && (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Que voulez-vous payer ?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {cibles.map((c) => (
              <label key={c.cle} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${c.cle === cle ? c1 : "#e2e8f0"}` }}>
                <input type="radio" name="cible" checked={c.cle === cle}
                  onChange={() => { setCle(c.cle); setMontant(String(c.propose)); }} />
                <span style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{c.label}</strong>
                  {c.detail && <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>{c.detail}</span>}
                  <span style={{ display: "block", fontSize: 11, color: "#b91c1c" }}>Reste à payer : {fmt(c.reste)}</span>
                </span>
              </label>
            ))}
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }} htmlFor="montant-en-ligne">
            Montant
          </label>
          <input id="montant-en-ligne" inputMode="numeric" value={montant}
            onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ""))}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 16, fontWeight: 700 }} />
          {cible && somme > cible.reste && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c" }}>Au plus {fmt(cible.reste)} sur ce choix.</p>}
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#f8fafc", fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Scolarité</span><strong>{fmt(somme)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
              <span>Frais de l'opérateur ({etat.fraisPourcent} %)</span><span>{fmt(frais)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", marginTop: 4, paddingTop: 4 }}>
              <span>Total à payer</span><strong style={{ fontSize: 15 }}>{fmt(somme + frais)}</strong>
            </div>
          </div>
        </>
      )}
      {erreur && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        {cibles?.length > 0 && (
          <Btn v="success" onClick={payer} disabled={!valide || enCours}>
            {enCours ? "Ouverture…" : `Payer ${fmt(somme + frais)}`}
          </Btn>
        )}
      </div>
    </Modale>
  );
}
