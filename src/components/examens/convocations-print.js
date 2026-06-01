// Génère et imprime les convocations d'examen (une fiche A5 par élève) dans une
// fenêtre dédiée. Module d'impression pur : produit le HTML et déclenche print().
export function imprimerConvocations(exam, tousEleves, schoolInfo) {
  const elevesCible = tousEleves.filter(e => exam.classe === "Toutes" || e.classe === exam.classe);
  if (!elevesCible.length) { alert("Aucun élève pour cette classe."); return; }
  const c1p = schoolInfo.couleur1 || "#0A1628";
  const c2p = schoolInfo.couleur2 || "#00C48C";
  const logo = schoolInfo.logo || "";
  const nomEcole = schoolInfo.nom || "École";
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="fr"><head>
  <meta charset="utf-8"/>
  <title>Convocations — ${exam.titre}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    @page{size:A5 portrait;margin:0}
    @media print{html,body{margin:0}}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;background:#fff;margin:0;padding:5mm}
    .convoc{width:138mm;min-height:95mm;border:2px solid ${c1p};border-radius:6mm;padding:7mm;page-break-after:always;page-break-inside:avoid;display:flex;flex-direction:column;gap:4mm}
    .convoc:last-child{page-break-after:auto}
    .header{display:flex;align-items:center;gap:5mm;border-bottom:2px solid ${c2p};padding-bottom:4mm}
    .logo{width:14mm;height:14mm;object-fit:contain}
    .logo-ph{width:14mm;height:14mm;background:${c1p};border-radius:2mm;display:flex;align-items:center;justify-content:center;color:${c2p};font-size:8pt;font-weight:900}
    .ecole-name{font-size:11pt;font-weight:900;color:${c1p}}
    .ecole-sub{font-size:7pt;color:#64748b}
    .titre{text-align:center;font-size:9pt;font-weight:900;color:${c1p};text-transform:uppercase;letter-spacing:.08em;background:${c2p}22;padding:2mm 4mm;border-radius:2mm;border-left:3mm solid ${c2p}}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
    .info-item{background:#f8fafc;padding:2mm 3mm;border-radius:2mm}
    .info-label{font-size:6pt;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}
    .info-val{font-size:9pt;font-weight:800;color:${c1p}}
    .footer{margin-top:auto;display:flex;justify-content:space-between;padding-top:3mm;border-top:1px solid #e2e8f0;font-size:7pt;color:#94a3b8}
    .signature{text-align:center}
    .sig-label{font-size:7pt;color:#64748b;margin-bottom:4mm}
    .sig-line{width:30mm;height:.3mm;background:#94a3b8;margin:0 auto}
  </style></head><body>
  ${elevesCible.map(e => `
  <div class="convoc">
    <div class="header">
      ${logo ? `<img src="${logo}" class="logo"/>` : `<div class="logo-ph">${nomEcole.slice(0, 2).toUpperCase()}</div>`}
      <div>
        <div class="ecole-name">${nomEcole}</div>
        <div class="ecole-sub">CONVOCATION D'EXAMEN</div>
      </div>
    </div>
    <div class="titre">${exam.titre}</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Élève</div><div class="info-val">${e.nom} ${e.prenom}</div></div>
      <div class="info-item"><div class="info-label">Matricule</div><div class="info-val">${e.matricule || "—"}</div></div>
      <div class="info-item"><div class="info-label">Classe</div><div class="info-val">${e.classe || "—"}</div></div>
      <div class="info-item"><div class="info-label">Date</div><div class="info-val">${exam.date || "—"}</div></div>
      ${exam.heure ? `<div class="info-item"><div class="info-label">Heure</div><div class="info-val">${exam.heure}</div></div>` : ""}
      ${exam.salle ? `<div class="info-item"><div class="info-label">Salle</div><div class="info-val">${exam.salle}</div></div>` : ""}
      ${exam.matiere ? `<div class="info-item"><div class="info-label">Matière</div><div class="info-val">${exam.matiere}</div></div>` : ""}
      ${exam.duree ? `<div class="info-item"><div class="info-label">Durée</div><div class="info-val">${exam.duree}</div></div>` : ""}
    </div>
    ${exam.consignes ? `<div style="font-size:8pt;color:#475569;padding:2mm 3mm;background:#f8fafc;border-radius:2mm;"><strong>Consignes :</strong> ${exam.consignes}</div>` : ""}
    <div class="footer">
      <span>Pièce à présenter le jour de l'examen</span>
      <div class="signature"><div class="sig-label">Signature Direction</div><div class="sig-line"></div></div>
    </div>
  </div>`).join("")}
  <script>window.onload=()=>{setTimeout(()=>window.print(),400);}</script>
  </body></html>`);
  w.document.close();
}
