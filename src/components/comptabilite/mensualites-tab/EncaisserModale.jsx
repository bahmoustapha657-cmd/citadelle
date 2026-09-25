import { useMemo, useState } from "react";
import { C, fmt } from "../../../constants";
import { Btn, Modale } from "../../ui";
import {
  acompteInscription, getEleveMensualiteSnapshot, getFraisAnnexesEleve, getTarifConfigForClasse,
  getTarifInscriptionForEleve, getTarifMensuelForClasse, montantDuInscription,
} from "../../../mensualite-utils";
import { etatsMois, periodeTranche, planVersement } from "../../../paiements-scolarite";
import { getRecuFormat, labelRecuFormat } from "./recu-format";
import { imprimerRecuEleve } from "./recu-eleve";

const aujourdhui = () => new Date().toLocaleDateString("fr-FR");

// Ce qu'un versement peut payer, avec le reste dû de chaque cible :
// les mensualités (du plus ancien mois), chaque tranche, l'inscription et
// chaque frais annexe pas encore soldé.
function ciblesVersement({ eleve, moisAnnee, tarifsClasses, tranches }) {
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const etats = etatsMois(eleve, moisAnnee, mensualite);
  const resteDe = (mois) => etats.filter((e) => mois.includes(e.mois)).reduce((s, e) => s + e.reste, 0);
  const cibles = [{
    cle: "mois", type: "mois", label: "Mensualités", detail: "à partir du plus ancien mois impayé",
    mois: moisAnnee, reste: resteDe(moisAnnee),
  }];
  tranches.forEach((t, i) => cibles.push({
    cle: `tranche-${i}`, type: "mois", label: t.nom, detail: periodeTranche(t), mois: t.mois, reste: resteDe(t.mois),
  }));
  if (!eleve.inscriptionPayee) {
    const duNet = montantDuInscription(eleve, getTarifInscriptionForEleve(eleve, tarifsClasses));
    cibles.push({
      cle: "inscription", type: "poste", poste: "inscription",
      label: eleve.typeInscription === "Réinscription" ? "Réinscription" : "Inscription",
      duNet, reste: Math.max(0, duNet - acompteInscription(eleve)),
    });
  }
  for (const frais of getFraisAnnexesEleve(eleve, getTarifConfigForClasse(tarifsClasses, eleve.classe))) {
    if (frais.paye) continue;
    cibles.push({ cle: `frais-${frais.id}`, type: "poste", poste: frais.id, label: frais.label, duNet: frais.duNet, reste: frais.reste });
  }
  return { cibles, etats, mensualite };
}

// Montant proposé en choisissant une cible : un mois pour les mensualités (le
// cas le plus courant), tout le reste pour une tranche ou un frais.
function montantPropose(cible, etats) {
  if (!cible) return "";
  if (cible.cle === "mois") return String(etats.find((e) => e.reste > 0)?.reste || "");
  return cible.reste > 0 ? String(cible.reste) : "";
}

// ══════════════════════════════════════════════════════════════
//  Encaisser un versement — montant libre, tranche ou acompte
// ══════════════════════════════════════════════════════════════
// Le parent apporte un montant : on choisit ce qu'il paie, l'aperçu montre
// comment il se répartit (mois soldés, acompte sur le suivant), puis le reçu
// du versement s'imprime avec le reste à payer.
export function EncaisserModale({
  eleve, moisAnnee, tarifsClasses, tranches = [], schoolInfo, canEdit,
  encaisserVersement, retirerAcompte, fermer,
}) {
  const nomEleve = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  const { cibles, etats, mensualite } = useMemo(
    () => ciblesVersement({ eleve, moisAnnee, tarifsClasses, tranches }),
    [eleve, moisAnnee, tarifsClasses, tranches],
  );
  const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
  const resteTotal = snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;

  const premiere = cibles.find((c) => c.reste > 0) || cibles[0];
  const [cibleCle, setCibleCle] = useState(premiere?.cle);
  const [montant, setMontant] = useState(() => montantPropose(premiere, etats));
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // { plan, date, eleveApres }

  const cible = cibles.find((c) => c.cle === cibleCle) || premiere;
  const plan = cible ? planVersement({ eleve, cible, montant, date: aujourdhui(), mensualite }) : null;

  const choisir = (c) => { setCibleCle(c.cle); setMontant(montantPropose(c, etats)); setResultat(null); };

  const encaisser = async () => {
    if (!plan?.ok || enCours) return;
    const detail = plan.lignes.map((l) => `• ${l.libelle} : ${fmt(l.montant)}`).join("\n");
    if (!confirm(`Encaisser ${fmt(plan.total)} pour ${nomEleve} ?\n\n${detail}`)) return;
    setEnCours(true);
    try {
      const date = aujourdhui();
      const fait = await encaisserVersement(eleve._id, { plan, nomEleve, eleve });
      if (fait) {
        setResultat({ plan, date, eleveApres: { ...eleve, ...plan.champs } });
        setMontant("");
      }
    } finally {
      setEnCours(false);
    }
  };

  const imprimer = () => imprimerRecuEleve({
    eleve: resultat.eleveApres, tarifsClasses, moisAnnee, schoolInfo, format: getRecuFormat(),
    versement: {
      date: resultat.date, total: resultat.plan.total,
      lignes: resultat.plan.lignes.map(({ libelle, montant: m }) => ({ libelle, montant: m })),
    },
  });

  // Acomptes en cours : mois, inscription et frais entamés — annulables en cas
  // d'erreur de saisie (verrou admin).
  const acomptes = [
    ...etats.filter((e) => e.statut === "partiel").map((e) => ({ type: "mois", cle: e.mois, label: e.mois, montant: e.verse, reste: e.reste })),
    ...(!eleve.inscriptionPayee && acompteInscription(eleve) > 0
      ? [{ type: "inscription", cle: "inscription", label: "Inscription", montant: acompteInscription(eleve), reste: cibles.find((c) => c.cle === "inscription")?.reste || 0 }]
      : []),
    ...getFraisAnnexesEleve(eleve, getTarifConfigForClasse(tarifsClasses, eleve.classe))
      .filter((f) => !f.paye && f.verse > 0)
      .map((f) => ({ type: "frais", cle: f.id, label: f.label, montant: f.verse, reste: f.reste })),
  ];

  const puce = (active) => ({
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 12px", borderRadius: 10,
    border: `1.5px solid ${active ? C.blue : "#cbd5e1"}`, background: active ? "#e0ebf8" : "var(--lc-surface, #fff)",
    cursor: "pointer", textAlign: "start", minWidth: 150,
  });

  return (
    <Modale large titre={`💰 Encaisser — ${nomEleve}`} fermer={fermer}>
      <div style={{ textAlign: "start" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 12.5, color: "#475569" }}>
        <span><strong>{eleve.classe}</strong>{eleve.matricule ? ` · ${eleve.matricule}` : ""}</span>
        <span>Reste à payer : <strong style={{ color: resteTotal > 0 ? "#b91c1c" : C.greenDk }}>{fmt(resteTotal)}</strong></span>
        <span style={{ color: "#64748b" }}>
          (mensualités {fmt(snapshot.soldeMensualites)} · inscription {fmt(snapshot.soldeInscription)} · frais {fmt(snapshot.soldeAutre)})
        </span>
      </div>

      {resultat && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: "#065f46", marginBottom: 6 }}>
            ✅ Versement de {fmt(resultat.plan.total)} enregistré le {resultat.date}
          </div>
          <ul style={{ margin: "0 0 10px", paddingInlineStart: 18, fontSize: 12.5, color: "#065f46" }}>
            {resultat.plan.lignes.map((l) => <li key={`${l.type}-${l.mois}`}>{l.libelle} : {fmt(l.montant)}</li>)}
          </ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn sm v="amber" onClick={imprimer}>🖨️ Imprimer le reçu ({labelRecuFormat(getRecuFormat())})</Btn>
            <Btn sm v="ghost" onClick={fermer}>Fermer</Btn>
          </div>
        </div>
      )}

      {resteTotal <= 0 && !resultat ? (
        <p style={{ fontSize: 13, color: C.greenDk, fontWeight: 700 }}>✓ Cet élève est à jour : rien à encaisser.</p>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Que paie-t-il ?
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {cibles.filter((c) => c.reste > 0).map((c) => (
              <button key={c.cle} type="button" onClick={() => choisir(c)} style={puce(c.cle === cible?.cle)}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: C.blueDark }}>{c.label}</span>
                {c.detail && <span style={{ fontSize: 10.5, color: "#64748b" }}>{c.detail}</span>}
                <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>reste {fmt(c.reste)}</span>
              </button>
            ))}
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
            Montant versé
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <input type="number" min={0} step={500} value={montant} autoFocus
              onChange={(ev) => { setMontant(ev.target.value); setResultat(null); }}
              style={{ width: 180, border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "8px 11px", fontSize: 15, fontWeight: 700 }} />
            {cible && cible.reste > 0 && (
              <Btn sm v="ghost" onClick={() => setMontant(String(cible.reste))}>Tout le reste ({fmt(cible.reste)})</Btn>
            )}
          </div>

          {/* Aperçu : ce que le versement solde, et ce qui reste en acompte. */}
          {plan?.ok ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 12, background: "#f8fafc" }}>
              {plan.lignes.map((l) => {
                const etat = l.type === "mensualite" ? etats.find((e) => e.mois === l.mois) : null;
                const resteApres = etat ? etat.reste - l.montant : cible.reste - l.montant;
                return (
                  <div key={`${l.type}-${l.mois}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ fontWeight: 600 }}>{l.libelle}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: l.solde ? C.greenDk : "#92400e" }}>
                      {fmt(l.montant)} {l.solde ? "✓ soldé" : `◐ reste ${fmt(resteApres)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : plan && plan.raison === "depasse" ? (
            <p style={{ fontSize: 12.5, color: "#b91c1c", fontWeight: 700, margin: "0 0 12px" }}>
              Le montant dépasse le reste à payer pour « {cible.label} » ({fmt(plan.reste)}).
            </p>
          ) : null}

          <Btn v="success" onClick={encaisser} disabled={!plan?.ok || enCours}>
            {enCours ? "Enregistrement…" : plan?.ok ? `Encaisser ${fmt(plan.total)}` : "Encaisser"}
          </Btn>
        </>
      )}

      {acomptes.length > 0 && (
        <div style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#92400e" }}>◐ Acomptes en cours</p>
          {acomptes.map((a) => (
            <div key={`${a.type}-${a.cle}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0" }}>
              <span>{a.label} : <strong>{fmt(a.montant)}</strong> versés, reste {fmt(a.reste)}</span>
              {canEdit && (
                <Btn sm v="ghost" onClick={() => retirerAcompte(eleve._id, { type: a.type, cle: a.cle, label: a.label, nomEleve, eleve })}>
                  Annuler l'acompte
                </Btn>
              )}
            </div>
          ))}
          {!canEdit && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
              Annuler un acompte demande l'autorisation de l'administrateur (verrou).
            </p>
          )}
        </div>
      )}
      </div>
    </Modale>
  );
}
