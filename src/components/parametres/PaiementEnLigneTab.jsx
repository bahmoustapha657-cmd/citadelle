import { useEffect, useState } from "react";
import { C } from "../../constants";
import { configurerPaiement, lireConfigPaiement } from "../../backend/paiement-en-ligne";

// Champs d'identifiants par opérateur (compte marchand DE L'ÉCOLE).
const CHAMPS = {
  cinetpay: [
    { cle: "api_key", label: "Clé API", aide: "sk_test_… pour essayer, sk_live_… pour encaisser réellement", secret: false },
    { cle: "api_password", label: "Mot de passe API", aide: "Celui de l'API, pas celui de votre connexion CinetPay", secret: true },
  ],
  orange_money: [
    { cle: "client_id", label: "Client ID", aide: "Application « Orange Money Web Payment » sur developer.orange.com", secret: false },
    { cle: "client_secret", label: "Client Secret", aide: "Même application Orange Developer", secret: true },
    { cle: "merchant_key", label: "Clé marchand (merchant key)", aide: "Remise par Orange pour le compte marchand Orange Money de l'école", secret: true },
  ],
};

// Mode d'emploi court, par opérateur.
const AIDES = {
  cinetpay: "Ouvrez un compte marchand sur cinetpay.com (pays : Guinée), puis copiez ci-dessous la clé API et le mot de passe API de votre espace marchand. Plafond CinetPay : 2 500 000 par paiement.",
  orange_money: "L'argent arrive directement sur le compte marchand Orange Money de l'école, sans intermédiaire (Orange Money seulement, pas MTN). Il faut : un compte marchand Orange Money (agence Orange) et l'abonnement « Orange Money Web Payment » (developer.orange.com), qui donne le Client ID, le Client Secret et la clé marchand.",
};

const champ = { width: "100%", boxSizing: "border-box", border: "1px solid var(--lc-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13 };

// ══════════════════════════════════════════════════════════════
//  Paramètres → Paiement en ligne (direction)
// ══════════════════════════════════════════════════════════════
// Les parents paient la scolarité par Orange Money / MTN MoMo depuis leur
// portail ; l'argent arrive sur le compte marchand de l'école et le
// paiement s'enregistre tout seul (fiche + journal de caisse). Les
// identifiants saisis ici partent au serveur et n'en reviennent jamais :
// seule une forme masquée est affichée.
export function PaiementEnLigneTab({ sec, lbl, toast }) {
  const [config, setConfig] = useState(null);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState(null);
  const [ids, setIds] = useState({});
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    lireConfigPaiement().then((c) => {
      if (!actif) return;
      setConfig(c);
      const premier = c.fournisseurs.find((f) => f.nom !== "simulation")?.nom || c.fournisseurs[0]?.nom || "";
      setForm({ fournisseur: c.fournisseur || premier, mode: c.mode, actif: c.actif, fraisPourcent: c.fraisPourcent });
    }).catch((e) => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, []);

  if (erreur) return <div style={sec}><p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{erreur}</p></div>;
  if (!config || !form) return <div style={sec}><p style={{ margin: 0, fontSize: 13 }}>Chargement…</p></div>;

  const champs = CHAMPS[form.fournisseur] || [];
  const memeOperateur = config.fournisseur === form.fournisseur;
  const maj = (cle, valeur) => setForm((f) => ({ ...f, [cle]: valeur }));

  const enregistrer = async () => {
    setEnCours(true);
    try {
      // Seulement les champs de l'opérateur choisi (rien d'un autre compte).
      const identifiants = Object.fromEntries(champs.map((c) => [c.cle, ids[c.cle] || ""]));
      const c = await configurerPaiement({ ...form, fraisPourcent: Number(form.fraisPourcent) || 0, identifiants });
      setConfig(c);
      setIds({});
      toast(c.actif ? "Paiement en ligne activé : les parents voient le bouton « Payer en ligne »." : "Réglages enregistrés (paiement en ligne désactivé).", "success");
    } catch (e) {
      toast(e.message || "Enregistrement impossible.", "error");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={sec}>
      <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "10px 14px", marginBottom: 6, fontSize: 12.5, color: "#065f46", lineHeight: 1.6 }}>
        <strong>💳 Les parents paient depuis leur téléphone</strong> (Orange Money, MTN MoMo). L'argent arrive
        directement sur <strong>le compte marchand de l'école</strong> — EduGest ne le touche jamais — et le paiement
        s'enregistre tout seul sur la fiche de l'élève et au journal de caisse.
      </div>

      {config.actif ? (
        <p style={{ fontSize: 12.5, color: "#065f46", margin: "10px 0 0" }}>
          ✅ Actif — {config.mode === "production" ? "encaissements réels" : "mode test (aucun argent réel)"}.
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--lc-text-muted)", margin: "10px 0 0" }}>Désactivé : les parents ne voient pas le bouton « Payer en ligne ».</p>
      )}

      <label style={lbl} htmlFor="pel-operateur">Opérateur</label>
      <select id="pel-operateur" value={form.fournisseur} onChange={(e) => { maj("fournisseur", e.target.value); setIds({}); }} style={champ}>
        {config.fournisseurs.map((f) => <option key={f.nom} value={f.nom}>{f.libelle}</option>)}
      </select>
      {AIDES[form.fournisseur] && (
        <p style={{ fontSize: 11.5, color: "var(--lc-text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
          {AIDES[form.fournisseur]}
        </p>
      )}

      <span style={lbl}>Mode</span>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" name="pel-mode" checked={form.mode === "test"} onChange={() => maj("mode", "test")} /> Test (aucun argent réel)
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" name="pel-mode" checked={form.mode === "production"} onChange={() => maj("mode", "production")} /> Production (encaissements réels)
        </label>
      </div>

      <label style={lbl} htmlFor="pel-frais">Frais de l'opérateur payés par le parent (%)</label>
      <input id="pel-frais" type="number" min={0} max={20} step="0.1" value={form.fraisPourcent}
        onChange={(e) => maj("fraisPourcent", e.target.value)} style={{ ...champ, width: 120 }} />
      <p style={{ fontSize: 11.5, color: "var(--lc-text-muted)", margin: "6px 0 0" }}>
        Ajoutés au montant que paie le parent ; mettez le taux que l'opérateur facture à l'école (0 = l'école les prend en charge).
      </p>

      {champs.map((c) => {
        const deja = memeOperateur ? config.identifiants?.[c.cle] : null;
        return (
          <div key={c.cle}>
            <label style={lbl} htmlFor={`pel-${c.cle}`}>{c.label}</label>
            <input id={`pel-${c.cle}`} type={c.secret ? "password" : "text"} value={ids[c.cle] || ""}
              autoComplete={c.secret ? "new-password" : "off"} spellCheck={false}
              placeholder={deja ? (c.secret ? "•••••••• (enregistré — laisser vide pour le garder)" : `${deja} (laisser vide pour le garder)`) : ""}
              onChange={(e) => setIds((v) => ({ ...v, [c.cle]: e.target.value }))} style={champ} />
            <span style={{ display: "block", fontSize: 11, color: "var(--lc-text-muted)", marginTop: 3 }}>{c.aide}</span>
          </div>
        );
      })}

      <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        <input type="checkbox" checked={form.actif} onChange={(e) => maj("actif", e.target.checked)} style={{ width: 18, height: 18 }} />
        Activer le paiement en ligne pour les parents
      </label>
      {form.actif && champs.length > 0 && (
        <p style={{ fontSize: 11.5, color: "var(--lc-text-muted)", margin: "6px 0 0 28px" }}>
          Les identifiants sont d'abord essayés auprès de l'opérateur : une erreur de saisie s'affiche tout de suite.
        </p>
      )}

      <button onClick={enregistrer} disabled={enCours}
        style={{ width: "100%", marginTop: 18, background: `linear-gradient(90deg,${C.blue},${C.green})`, color: "#fff", border: "none", padding: "13px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enCours ? 0.7 : 1 }}>
        {enCours ? "Vérification…" : "💾 Enregistrer le paiement en ligne"}
      </button>
    </div>
  );
}
