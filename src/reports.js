// eslint-disable-next-line no-unused-vars
import { MOIS_ANNEE, fmt, fmtN, getAnnee, today } from "./constants.js";
import { getGeneralAverage, getSubjectAverage } from "./note-utils.js";

const loadXLSX = () => import("xlsx");
const loadQRCode = async () => (await import("qrcode")).default;

// ══════════════════════════════════════════════════════════════
//  IMPRESSION / EXPORT  — fonctions pures (pas de React)
// ══════════════════════════════════════════════════════════════

// Supprime les en-têtes / pieds automatiques du navigateur ("about:blank",
// URL, date, n° de page). Doit être présent dans chaque <style> de doc
// imprimable. La compensation des marges se fait via padding sur le contenu.
export const PRINT_RESET = `@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}}`;

// Devise nationale de la République de Guinée aux couleurs du drapeau
// (rouge / jaune / vert).
const DEVISE_GUINEE_HTML = `<em style="-webkit-print-color-adjust:exact;print-color-adjust:exact"><span style="color:#CE1126;font-weight:700">Travail</span> - <span style="color:#B8860B;font-weight:700">Justice</span> - <span style="color:#009460;font-weight:700">Solidarité</span></em>`;

export const MINISTERE_DEFAUT = "Ministère de l'Éducation Nationale, de l'Alphabétisation, de l'Enseignement Technique et de la Formation Professionnelle";

// Helpers défensifs : tolèrent null/undefined/"" et chaînes blanches
const orDefault = (v, def) => (typeof v === "string" && v.trim() ? v : def);

export const enteteDoc = (si = {}, logoUrl) => {
  const pays = orDefault(si.pays, "République de Guinée");
  const ministere = orDefault(si.ministere, MINISTERE_DEFAUT);
  return `
<div style="display:flex;align-items:flex-start;gap:14px;border-bottom:3px solid #0A1628;padding-bottom:12px;margin-bottom:16px">
  <div style="flex:1;font-size:10px;color:#444;line-height:1.8;min-width:0">
    <strong style="font-size:11px;color:#0A1628">${pays}</strong><br/>
    ${DEVISE_GUINEE_HTML}<br/>
    <strong>${ministere}</strong><br/>
    ${si.ire?`${si.ire}<br/>`:""}
    ${si.dpe||""}
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    ${logoUrl?`<img src="${logoUrl}" alt="Logo" style="width:78px;height:78px;object-fit:contain"/>`:`<div style="width:78px;height:78px"></div>`}
  </div>
  <div style="flex:1;text-align:right;min-width:0">
    <strong style="display:block;font-size:15px;color:#0A1628;line-height:1.3">${si.nom||""}</strong>
    ${si.agrement?`<span style="font-size:10px;color:#555">Agrément : ${si.agrement}</span>`:""}
  </div>
</div>`;
};

export const getRecuTotals = (eleve, montantUnit, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const moisPayes = moisAnnee.filter(m=>mens[m]==="Payé");
  const fraisIns = Number(fraisAnnexes?.inscription||0);
  const fraisAutre = Number(fraisAnnexes?.autre||0);
  const totalMensualites = moisPayes.length*montantUnit;
  const totalGeneral = totalMensualites
    + (eleve.inscriptionPayee&&fraisIns>0?fraisIns:0)
    + (eleve.autrePayee&&fraisAutre>0?fraisAutre:0);
  return { moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral };
};

export const imprimerRecu = (eleve, montantUnit, schoolInfo={}, moisAnnee=MOIS_ANNEE, fraisAnnexes={}) => {
  const mens = eleve.mens||{};
  const mensDates = eleve.mensDates||{};
  const {moisPayes, fraisIns, fraisAutre, totalMensualites, totalGeneral} = getRecuTotals(eleve, montantUnit, moisAnnee, fraisAnnexes);
  const w = window.open("","_blank");

  // En-tête compacte pour les reçus (logo + infos en ligne) — sans doublon type/nom
  const enteteCompact = () => `
  <div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid #0A1628;padding-bottom:6px;margin-bottom:6px">
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" alt="" style="width:38px;height:38px;object-fit:contain;flex-shrink:0"/>`:''}
    <div style="flex:1;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:8px;color:#444;line-height:1.5">
        <strong style="font-size:9px;color:#0A1628">${schoolInfo.pays||"République de Guinée"}</strong><br/>
        ${DEVISE_GUINEE_HTML}<br/>
        ${schoolInfo.ministere||MINISTERE_DEFAUT}${schoolInfo.ire?` / ${schoolInfo.ire}`:""}${schoolInfo.dpe?` / ${schoolInfo.dpe}`:""}
      </div>
      <div style="text-align:right">
        <strong style="font-size:13px;color:#0A1628;display:block">${schoolInfo.nom||""}</strong>
        ${schoolInfo.agrement?`<span style="font-size:7px;color:#555">Agrém. : ${schoolInfo.agrement}</span>`:""}
      </div>
    </div>
  </div>`;

  // Bloc reçu compact — deux par page A4
  const bloc = (titre) => `
  <div class="recu">
    ${schoolInfo.logo?`<div class="watermark"><img src="${schoolInfo.logo}" alt=""/></div>`:""}
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%">
    ${enteteCompact()}
    <div class="badge">REÇU DE PAIEMENT DE MENSUALITÉS</div>
    <div class="exemplaire">${titre}</div>
    <div class="grid">
      <div class="row"><span class="lbl">Élève : </span>${eleve.nom} ${eleve.prenom}</div>
      <div class="row"><span class="lbl">Matricule : </span>${eleve.matricule||"—"}</div>
      <div class="row"><span class="lbl">Classe : </span>${eleve.classe}</div>
      <div class="row"><span class="lbl">Impression : </span>${today()}</div>
      <div class="row"><span class="lbl">Tuteur : </span>${eleve.tuteur||"—"}</div>
      <div class="row"><span class="lbl">Contact : </span>${eleve.contactTuteur||"—"}</div>
    </div>
    <table class="mois-table"><thead><tr><th>Mois</th><th>Statut</th><th>Date de paiement</th></tr></thead><tbody>
      ${moisAnnee.map(m=>{
        const paye=mens[m]==="Payé";
        const datePaie=mensDates[m]||"—";
        return `<tr class="${paye?"paye":"impaye"}">
          <td style="font-weight:700">${m}</td>
          <td style="text-align:center">${paye?"✓ Payé":"✗ Impayé"}</td>
          <td style="text-align:center">${paye?datePaie:"—"}</td>
        </tr>`;
      }).join("")}
    </tbody></table>
    ${eleve.inscriptionPayee&&fraisIns>0?`
    <div class="total" style="font-size:9px;padding:4px 8px;background:#f0f9ff;border-color:#7dd3fc">
      ${eleve.typeInscription==="Réinscription"?"Réinscription":"Inscription"} : <strong>${fmt(fraisIns)}</strong>
      <span style="font-weight:400;margin-left:4px">✓ Payée</span>
    </div>`:""}
    ${eleve.autrePayee&&fraisAutre>0?`
    <div class="total" style="font-size:9px;padding:4px 8px;background:#f8fafc;border-color:#94a3b8">
      Autre frais : <strong>${fmt(fraisAutre)}</strong>
      <span style="font-weight:400;margin-left:4px">✓ Payé</span>
    </div>`:""}
    <div class="total">Mensualités versées : ${fmt(totalMensualites)} <span style="font-weight:400;font-size:9px">(${moisPayes.length}/${moisAnnee.length} mois)</span></div>
    <div class="total" style="background:#e0f2fe;border-color:#38bdf8">Total général : <strong>${fmt(totalGeneral)}</strong></div>
    <div class="sigs">
      <div class="sig">Le/La Comptable<br/><br/><br/>Signature &amp; cachet</div>
      <div class="sig">Le/La Payant(e)<br/><br/><br/>Signature</div>
    </div>
    </div>
  </div>`;

  w.document.write(`<!DOCTYPE html><html><head><title>Reçu</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:6mm;background:#fff;
         height:282mm;display:flex;flex-direction:column;gap:3mm}
    .recu{flex:1;padding:8px 12px;border:1px solid #bbb;border-radius:3px;display:flex;flex-direction:column;position:relative}
    .watermark{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark img{width:160px;height:160px;object-fit:contain;opacity:0.09}
    .badge{text-align:center;background:#0A1628;color:#fff;padding:4px;font-size:10px;font-weight:bold;margin:5px 0 2px;border-radius:3px}
    .exemplaire{text-align:right;font-size:8px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-bottom:6px}
    .row{font-size:8.5px}.lbl{font-weight:bold;color:#0A1628}
    .mois-table{width:100%;border-collapse:collapse;margin-bottom:5px;font-size:8px}
    .mois-table th{background:#0A1628;color:#fff;padding:3px 6px;text-align:left;font-size:7.5px}
    .mois-table td{padding:2px 6px;border-bottom:1px solid #eee}
    .mois-table tr.paye td{color:#166534;background:#f0fdf4}
    .mois-table tr.impaye td{color:#9ca3af}
    .total{text-align:right;font-size:10px;font-weight:bold;padding:4px 8px;background:#e8f0e8;color:#0A1628;margin-top:4px;border-radius:2px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:auto;padding-top:10px}
    .sig{border-top:1.5px solid #0A1628;padding-top:4px;text-align:center;font-size:8.5px;color:#333;font-weight:600}
    @media print{body{height:282mm}button{display:none}}
  </style></head><body>
  ${bloc("Exemplaire — Comptable")}
  ${bloc("Exemplaire — Payant")}
  <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
};

export const imprimerCartesEleves = async (eleves, schoolInfo={}, annee="") => {
  if(!eleves.length){alert("Aucun élève à imprimer.");return;}
  // Pré-générer les QR codes (data URL) pour chaque élève
  const qrMap = {};
  const QRCode = await loadQRCode();
  await Promise.all(eleves.map(async e => {
    try {
      qrMap[e._id] = await QRCode.toDataURL(e.matricule||e._id, {
        width:80, margin:0, color:{dark:"#0A1628",light:"#ffffff"}
      });
    } catch { qrMap[e._id] = ""; }
  }));
  const w = window.open("","_blank");
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const nomEcole = schoolInfo.nom||"École";
  const ville = schoolInfo.ville||"";
  const logo = schoolInfo.logo||"";

  // Génère une version claire de c1 pour le fond du corps
  const carte = (e) => `
  <div class="carte">
    <!-- Bande déco gauche couleur 2 -->
    <div class="bande-gauche"></div>

    <div class="carte-inner">
      <!-- EN-TÊTE -->
      <div class="carte-header">
        <div class="logo-wrap">
          ${logo
            ?`<img src="${logo}" class="carte-logo"/>`
            :`<div class="logo-initiales">${nomEcole.slice(0,2).toUpperCase()}</div>`}
        </div>
        <div class="carte-titre">
          <div class="carte-ecole">${nomEcole}</div>
          ${ville?`<div class="carte-ville">${ville}</div>`:""}
          <div class="carte-sous">CARTE D'IDENTITÉ SCOLAIRE</div>
        </div>
        <div class="annee-badge">${annee}</div>
      </div>

      <!-- SÉPARATEUR -->
      <div class="separateur"></div>

      <!-- CORPS -->
      <div class="carte-body">
        <div class="carte-photo">
          ${e.photo
            ?`<img src="${e.photo}" class="photo-img"/>`
            :`<div class="photo-initiales">${(e.prenom||"?")[0].toUpperCase()}${(e.nom||"?")[0].toUpperCase()}</div>`}
        </div>
        <div class="carte-infos">
          <div class="carte-nom">${(e.prenom||"").toUpperCase()} ${(e.nom||"").toUpperCase()}</div>
          <div class="info-ligne"><span class="info-label">Matricule</span><span class="info-val">${e.matricule||"—"}</span></div>
          ${e.ien?`<div class="info-ligne"><span class="info-label">IEN</span><span class="info-val ien">${e.ien}</span></div>`:""}
          <div class="info-ligne"><span class="info-label">Classe</span><span class="info-val">${e.classe||"—"}</span></div>
          <div class="info-ligne"><span class="info-label">Né(e) le</span><span class="info-val">${e.dateNaissance||"—"}</span></div>
          ${e.sexe?`<div class="info-ligne"><span class="info-label">Sexe</span><span class="info-val">${e.sexe}</span></div>`:""}
        </div>
      </div>

      <!-- PIED -->
      <div class="carte-footer">
        <div class="footer-left">
          <span class="footer-label">Signature Direction</span>
          <div class="footer-ligne"></div>
        </div>
        <div class="footer-center">
          ${qrMap[e._id]
            ?`<div class="qr-wrap"><img src="${qrMap[e._id]}" class="qr-img"/><div class="mat-badge">${e.matricule||""}</div></div>`
            :`<div class="mat-badge">${e.matricule||""}</div>`}
        </div>
        <div class="footer-right">
          <span class="footer-label">Signature Élève</span>
          <div class="footer-ligne"></div>
        </div>
      </div>
    </div>
  </div>`;

  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Cartes d'identité scolaires — ${nomEcole}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    ${PRINT_RESET}
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;background:#f0f0f0;padding:8mm}

    .grille{display:grid;grid-template-columns:repeat(2,86mm);gap:5mm;justify-content:center}

    /* Carte principale */
    .carte{
      width:86mm;height:54mm;border-radius:3mm;overflow:hidden;
      display:flex;flex-direction:row;
      break-inside:avoid;page-break-inside:avoid;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      background:#fff;
      border:.3mm solid rgba(0,0,0,.1);
    }

    /* Bande verticale gauche */
    .bande-gauche{
      width:3.5mm;flex-shrink:0;
      background:linear-gradient(180deg,${c2},${c1});
    }

    /* Contenu principal */
    .carte-inner{flex:1;display:flex;flex-direction:column;overflow:hidden}

    /* En-tête */
    .carte-header{
      background:${c1};
      padding:2mm 2.5mm;
      display:flex;align-items:center;gap:2mm;
      flex-shrink:0;
    }
    .logo-wrap{
      width:10mm;height:10mm;flex-shrink:0;
      background:rgba(255,255,255,0.15);
      border-radius:1.5mm;
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;border:.3mm solid rgba(255,255,255,0.3);
    }
    .carte-logo{width:100%;height:100%;object-fit:contain;padding:.5mm}
    .logo-initiales{font-size:7pt;font-weight:900;color:${c2};letter-spacing:-.02em}
    .carte-titre{flex:1;min-width:0}
    .carte-ecole{color:${c2};font-size:6pt;font-weight:900;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .carte-ville{color:rgba(255,255,255,.55);font-size:4pt;margin-top:.3mm}
    .carte-sous{color:rgba(255,255,255,.5);font-size:3.5pt;letter-spacing:.12em;text-transform:uppercase;margin-top:.4mm}
    .annee-badge{
      background:${c2};color:${c1};
      font-size:4pt;font-weight:900;
      padding:1mm 1.8mm;border-radius:1mm;
      white-space:nowrap;flex-shrink:0;
    }

    /* Séparateur */
    .separateur{height:.4mm;background:linear-gradient(90deg,${c2},${c1});flex-shrink:0}

    /* Corps */
    .carte-body{
      flex:1;display:flex;padding:2mm 2.5mm;gap:2.5mm;align-items:center;
      background:linear-gradient(135deg,#ffffff 70%,${c1}08 100%);
    }
    .carte-photo{
      width:16mm;height:20mm;flex-shrink:0;
      border-radius:1.5mm;overflow:hidden;
      border:1mm solid ${c1};
      background:${c1+"22"};
      display:flex;align-items:center;justify-content:center;
    }
    .photo-img{width:100%;height:100%;object-fit:cover}
    .photo-initiales{
      font-size:10pt;font-weight:900;
      color:${c1};opacity:.45;letter-spacing:-.03em;
    }
    .carte-infos{flex:1;overflow:hidden}
    .carte-nom{
      font-size:6.5pt;font-weight:900;color:${c1};
      line-height:1.25;margin-bottom:1.5mm;
      word-break:break-word;letter-spacing:.02em;
    }
    .info-ligne{display:flex;align-items:baseline;gap:1mm;margin-bottom:.7mm}
    .info-label{font-size:4pt;color:#999;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
    .info-val{font-size:5pt;color:${c1};font-weight:700}
    .ien{font-family:monospace;color:#3730a3;background:#eef2ff;padding:0 2px;border-radius:1mm}

    /* Pied */
    .carte-footer{
      background:${c1+"0d"};
      border-top:.3mm solid ${c1+"22"};
      padding:1.2mm 2.5mm;
      display:flex;justify-content:space-between;align-items:center;
      flex-shrink:0;
    }
    .footer-left,.footer-right{display:flex;flex-direction:column;align-items:center;gap:.5mm}
    .footer-label{font-size:3.5pt;color:#aaa;text-transform:uppercase;letter-spacing:.06em}
    .footer-ligne{width:16mm;height:.3mm;background:${c1}44}
    .footer-center{display:flex;align-items:center;justify-content:center}
    .qr-wrap{display:flex;flex-direction:column;align-items:center;gap:.5mm}
    .qr-img{width:9mm;height:9mm;image-rendering:pixelated}
    .mat-badge{
      font-family:monospace;font-size:4pt;font-weight:800;
      color:${c1};background:${c2}33;
      padding:.5mm 1.5mm;border-radius:1mm;
      letter-spacing:.08em;
    }

    @media print{
      body{background:#fff;padding:0}
      button{display:none}
    }
  </style></head><body>
  <div class="grille">${eleves.map(carte).join("")}</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400);}</script>
  </body></html>`);
  w.document.close();
};


export const imprimerListeClasse = (classe, eleves, schoolInfo={}) => {
  const liste = eleves.filter(e=>e.classe===classe);
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Liste ${classe}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;margin:0}
  h2{color:#0A1628;text-align:center}table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#0A1628;color:#fff;padding:7px 10px;font-size:11px;text-align:left}
  td{padding:7px 10px;border-bottom:1px solid #eee}tr:nth-child(even){background:#f0f4f8}
  .footer{margin-top:30px;display:flex;justify-content:space-between;font-size:11px;color:#555}
  @media print{button{display:none}}</style></head><body>
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>Liste des élèves — Classe : ${classe}</h2>
  <table><thead><tr><th>N°</th><th>Matricule</th><th>Nom & Prénom</th><th>Sexe</th><th>Date Naissance</th><th>Lieu Naissance</th><th>Filiation</th><th>Tuteur</th><th>Contact</th><th>Statut</th></tr></thead>
  <tbody>${liste.map((e,i)=>`<tr><td>${i+1}</td><td>${e.matricule||"—"}</td><td><strong>${e.nom} ${e.prenom}</strong></td><td>${e.sexe||"—"}</td><td>${e.dateNaissance||"—"}</td><td>${e.lieuNaissance||"—"}</td><td>${e.filiation||"—"}</td><td>${e.tuteur||"—"}</td><td>${e.contactTuteur||"—"}</td><td>${e.statut||"Actif"}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer"><span>Effectif : ${liste.length} élève(s)</span><span>Date d'impression : ${today()}</span><span>Le Directeur</span></div>
  <script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

/**
 * Rapport mensuel complet : absences + paiements par classe
 * @param {string} mois  — ex: "Novembre"
 * @param {Array}  eleves — tous les élèves (primaire + collège fusionnés)
 * @param {Array}  absences — collection absences
 * @param {string} annee — ex: "2025-2026"
 * @param {Object} schoolInfo
 * @param {Array}  moisAnnee — liste des mois de l'année scolaire
 */
export const genererRapportMensuel = (mois, eleves, absences, annee, schoolInfo={}, _moisAnnee=[]) => {
  if(!eleves.length){ alert("Aucun élève."); return; }
  void _moisAnnee;
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const nomEcole = schoolInfo.nom||"École";
  const logo = schoolInfo.logo||"";

  // Absences du mois sélectionné
  const absences_mois = absences.filter(a => a.date && a.date.startsWith
    ? a.date.includes(mois) || (() => {
        try { return new Date(a.date).toLocaleDateString("fr-FR",{month:"long"}).toLowerCase() === mois.toLowerCase(); } catch { return false; }
      })()
    : false
  );

  // Grouper par classe
  const classes = [...new Set(eleves.map(e=>e.classe||"Sans classe"))].sort();

  const lignesClasse = classes.map(classe => {
    const elevesClasse = eleves.filter(e=>(e.classe||"Sans classe")===classe);
    const absClasse = absences_mois.filter(a => elevesClasse.some(e=>e._id===a.eleveId||(e.nom+" "+e.prenom)===a.eleveNom));
    const absJustif = absClasse.filter(a=>a.justifie==="Oui").length;
    const absNonJust = absClasse.filter(a=>a.justifie!=="Oui").length;
    // Paiements : compter payés vs impayés pour ce mois
    const payesMois = elevesClasse.filter(e=>(e.mens||{})[mois]==="Payé").length;
    const tauxPaye = elevesClasse.length ? Math.round(payesMois/elevesClasse.length*100) : 0;
    return { classe, effectif:elevesClasse.length, absJustif, absNonJust, total:absJustif+absNonJust, payesMois, tauxPaye };
  });

  const totEffectif = lignesClasse.reduce((s,l)=>s+l.effectif,0);
  const totAbsJ = lignesClasse.reduce((s,l)=>s+l.absJustif,0);
  const totAbsN = lignesClasse.reduce((s,l)=>s+l.absNonJust,0);
  const totPaye = lignesClasse.reduce((s,l)=>s+l.payesMois,0);
  const tauxGlobal = totEffectif ? Math.round(totPaye/totEffectif*100) : 0;

  // Élèves avec absences répétées (≥ 3 ce mois)
  const elevesConcernes = eleves.map(e => {
    const abs = absences_mois.filter(a=>a.eleveId===e._id||(e.nom+" "+e.prenom)===a.eleveNom);
    return { ...e, nbAbs: abs.length };
  }).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs).slice(0,15);

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="fr"><head>
  <meta charset="utf-8"/>
  <title>Rapport Mensuel ${mois} ${annee} — ${nomEcole}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    ${PRINT_RESET}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;color:#1e293b;font-size:11px;line-height:1.5;background:#fff;padding:15mm 12mm}

    /* En-tête */
    .header{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid ${c1};margin-bottom:16px}
    .header-logo{width:52px;height:52px;flex-shrink:0;object-fit:contain}
    .header-logo-ph{width:52px;height:52px;flex-shrink:0;background:${c1};border-radius:8px;display:flex;align-items:center;justify-content:center;color:${c2};font-size:14px;font-weight:900}
    .header-text{flex:1}
    .header-ecole{font-size:16px;font-weight:900;color:${c1}}
    .header-sub{font-size:10px;color:#64748b;margin-top:2px}
    .header-badge{background:${c1};color:${c2};padding:6px 14px;border-radius:8px;text-align:center}
    .header-badge-title{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.7}
    .header-badge-val{font-size:13px;font-weight:900}

    /* KPI cards */
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:center}
    .kpi-val{font-size:22px;font-weight:900;color:${c1};line-height:1}
    .kpi-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .kpi-sub{font-size:10px;color:#94a3b8;margin-top:2px}
    .kpi.vert .kpi-val{color:#059669}
    .kpi.rouge .kpi-val{color:#dc2626}
    .kpi.amber .kpi-val{color:#d97706}

    /* Section titre */
    .section-title{font-size:11px;font-weight:800;color:${c1};text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;padding-left:8px;border-left:3px solid ${c2}}

    /* Tables */
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}
    thead tr{background:${c1};color:#fff}
    th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
    tr:nth-child(even) td{background:#f8fafc}
    .pct-bar{display:inline-block;height:6px;border-radius:3px;background:${c2};vertical-align:middle;margin-right:4px}

    /* Alerte */
    .alert-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:12px}
    .alert-title{font-size:11px;font-weight:800;color:#991b1b;margin-bottom:6px}

    /* Footer */
    .page-footer{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}

    @media print{button{display:none}}
  </style></head><body>

  <div class="header">
    ${logo
      ?`<img src="${logo}" class="header-logo"/>`
      :`<div class="header-logo-ph">${nomEcole.slice(0,2).toUpperCase()}</div>`}
    <div class="header-text">
      <div class="header-ecole">${nomEcole}</div>
      <div class="header-sub">Rapport mensuel • Année scolaire ${annee}</div>
    </div>
    <div class="header-badge">
      <div class="header-badge-title">Période</div>
      <div class="header-badge-val">${mois}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${totEffectif}</div><div class="kpi-label">Élèves</div><div class="kpi-sub">${classes.length} classe(s)</div></div>
    <div class="kpi amber"><div class="kpi-val">${totAbsJ+totAbsN}</div><div class="kpi-label">Absences</div><div class="kpi-sub">${totAbsJ} justifiées · ${totAbsN} non just.</div></div>
    <div class="kpi ${tauxGlobal>=80?"vert":tauxGlobal>=50?"amber":"rouge"}"><div class="kpi-val">${tauxGlobal}%</div><div class="kpi-label">Taux paiement</div><div class="kpi-sub">${totPaye}/${totEffectif} payés</div></div>
    <div class="kpi"><div class="kpi-val">${elevesConcernes.length}</div><div class="kpi-label">Alertes absences</div><div class="kpi-sub">≥ 3 absences ce mois</div></div>
  </div>

  <div class="section-title">Récapitulatif par classe</div>
  <table>
    <thead><tr>
      <th>Classe</th><th>Effectif</th><th>Abs. justifiées</th><th>Abs. non justif.</th><th>Total abs.</th><th>Paiements</th><th>Taux</th>
    </tr></thead>
    <tbody>
      ${lignesClasse.map(l=>`<tr>
        <td><strong>${l.classe}</strong></td>
        <td style="text-align:center">${l.effectif}</td>
        <td style="text-align:center;color:#059669">${l.absJustif}</td>
        <td style="text-align:center;color:#dc2626">${l.absNonJust}</td>
        <td style="text-align:center;font-weight:700">${l.total}</td>
        <td style="text-align:center">${l.payesMois}/${l.effectif}</td>
        <td>
          <span class="pct-bar" style="width:${l.tauxPaye*0.5}px"></span>
          <strong style="color:${l.tauxPaye>=80?"#059669":l.tauxPaye>=50?"#d97706":"#dc2626"}">${l.tauxPaye}%</strong>
        </td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9;font-weight:800">
        <td>TOTAL</td><td style="text-align:center">${totEffectif}</td>
        <td style="text-align:center;color:#059669">${totAbsJ}</td>
        <td style="text-align:center;color:#dc2626">${totAbsN}</td>
        <td style="text-align:center">${totAbsJ+totAbsN}</td>
        <td style="text-align:center">${totPaye}/${totEffectif}</td>
        <td><strong style="color:${tauxGlobal>=80?"#059669":tauxGlobal>=50?"#d97706":"#dc2626"}">${tauxGlobal}%</strong></td>
      </tr>
    </tbody>
  </table>

  ${elevesConcernes.length>0?`
  <div class="alert-box">
    <div class="alert-title">🚨 Élèves avec absences répétées (≥ 3 ce mois)</div>
    <table style="margin-bottom:0">
      <thead><tr><th>Nom & Prénom</th><th>Classe</th><th>Nb absences</th><th>Tuteur</th><th>Contact</th></tr></thead>
      <tbody>
        ${elevesConcernes.map(e=>`<tr>
          <td><strong>${e.nom} ${e.prenom}</strong></td>
          <td>${e.classe||"—"}</td>
          <td style="text-align:center;font-weight:800;color:#dc2626">${e.nbAbs}</td>
          <td>${e.tuteur||"—"}</td>
          <td>${e.contactTuteur||"—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}

  <div class="page-footer">
    <span>Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>
    <span>${nomEcole} — Rapport confidentiel</span>
    <span>Signature Direction : ___________________</span>
  </div>

  <script>window.onload=()=>{setTimeout(()=>window.print(),400);}</script>
  </body></html>`);
  w.document.close();
};

export const telechargerExcel = async (wb, nomFichier) => {
  try {
    const XLSX = await loadXLSX();
    const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const blob = new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
  } catch(err) {
    alert("Impossible de générer le fichier Excel : " + err.message);
  }
};

export const exportExcel = async (nomFichier, colonnes, lignes) => {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.aoa_to_sheet([colonnes, ...lignes]);
  ws["!cols"] = colonnes.map(()=>({wch:22}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Données");
  await telechargerExcel(wb, `${nomFichier}_${new Date().toLocaleDateString("fr-FR").replace(/\//g,"-")}.xlsx`);
};

export const imprimerAttestation = (eleve, niveau, annee, schoolInfo={}) => {
  const niveauLabel = niveau === "college" ? "Collège" : "Primaire";
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Attestation ${eleve.nom}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:18mm 14mm;font-size:13px;max-width:700px;margin:0 auto}
  h2{color:#0A1628;text-align:center;font-size:18px;text-transform:uppercase;letter-spacing:2px;margin:24px 0}
  .body-txt{line-height:2;font-size:14px;text-align:justify;margin:20px 0}
  .infos{background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #0A1628}
  .row{font-size:13px;margin:5px 0}.lbl{font-weight:bold;color:#0A1628}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:50px}
  .sig{border-top:2px solid #0A1628;padding-top:8px;text-align:center;font-size:11px;color:#555}
  .stamp{border:3px solid #0A1628;padding:8px 16px;display:inline-block;border-radius:4px;font-weight:bold;color:#0A1628;margin-top:6px;font-size:13px}
  .devise{text-align:center;font-size:11px;margin-top:20px;font-style:italic;color:#00C48C;font-weight:bold}
  @media print{button{display:none}}</style></head><body>
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>Attestation de Niveau</h2>
  <div class="body-txt">
    <p>Le Directeur du ${schoolInfo.type||"Groupe Scolaire Privé"} <strong>${schoolInfo.nom||""}</strong>, soussigné, certifie que l'élève :</p>
    <div class="infos">
      <div class="row"><span class="lbl">Nom & Prénom : </span><strong>${eleve.nom} ${eleve.prenom}</strong></div>
      <div class="row"><span class="lbl">Matricule : </span>${eleve.matricule||"—"}</div>
      <div class="row"><span class="lbl">Date de naissance : </span>${eleve.dateNaissance||"—"}</div>
      <div class="row"><span class="lbl">Lieu de naissance : </span>${eleve.lieuNaissance||"—"}</div>
      <div class="row"><span class="lbl">Classe : </span>${eleve.classe}</div>
      <div class="row"><span class="lbl">Niveau : </span>${niveauLabel}</div>
      <div class="row"><span class="lbl">Tuteur / Parent : </span>${eleve.tuteur||"—"}</div>
      <div class="row"><span class="lbl">Statut : </span>${eleve.statut||"—"}</div>
    </div>
    <p>est régulièrement inscrit(e) dans notre établissement pour l'année scolaire <strong>${annee||getAnnee()}</strong>
    et suit normalement les cours de la classe de <strong>${eleve.classe}</strong> au niveau <strong>${niveauLabel}</strong>.</p>
    <p>La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>
    <p style="text-align:right;margin-top:20px">Fait à ${schoolInfo.ville||"—"}, le ${today()}</p>
  </div>
  <div class="sigs">
    <div class="sig">Le/La Tuteur / Parent<br/><br/><br/>Signature</div>
    <div class="sig">Le Directeur Général<br/><div class="stamp">${schoolInfo.nom||""}</div></div>
  </div>
  <div class="devise">Travail – Rigueur – Réussite</div>
  <script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════
//  BULLETINS — version 2 (refonte 2026-05-02)
// ══════════════════════════════════════════════════════════════

const PERIODES_ORDRE = ["T1", "T2", "T3"];

function getMention(moy, maxNote) {
  if (moy === "—" || moy == null || moy === "") return "Non évalué";
  const v = Number(moy);
  if (!Number.isFinite(v)) return "Non évalué";
  if (v >= maxNote * 0.8) return "Très Bien";
  if (v >= maxNote * 0.7) return "Bien";
  if (v >= maxNote * 0.6) return "Assez Bien";
  if (v >= maxNote * 0.5) return "Passable";
  return "Insuffisant";
}

function getMentionColors(mention) {
  switch (mention) {
    case "Très Bien":  return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
    case "Bien":       return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
    case "Assez Bien": return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
    case "Passable":   return { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" };
    case "Insuffisant":return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
    default:           return { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" };
  }
}

function getInitiales(eleve = {}) {
  const p = (eleve.prenom || "").trim()[0] || "";
  const n = (eleve.nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "•";
}

function getNumeroBulletin(eleve, periode, schoolInfo, annee) {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const per = String(periode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const ref = eleve.matricule || (String(eleve._id || "").slice(-6).toUpperCase());
  return `BUL-${code}-${an}-${per}-${ref}`;
}

function ordinalFr(rang) {
  return rang === 1 ? "er" : "e";
}

function getStatsClasse(elevesClasse, notes, matieres, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return getGeneralAverage(notesE, matieres, classe, niveau);
    })
    .filter((v) => v != null);
  if (moyennes.length === 0) return null;
  const sum = moyennes.reduce((s, v) => s + v, 0);
  return {
    effectif: elevesClasse.length,
    nbEvalues: moyennes.length,
    moyenneClasse: sum / moyennes.length,
    min: Math.min(...moyennes),
    max: Math.max(...moyennes),
  };
}

function getMoyenneClasseParMatiere(elevesClasse, notes, matiereNom, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const nm = notes.filter((n) => n.eleveId === e._id && n.periode === periode && n.matiere === matiereNom);
      return getSubjectAverage(nm, classe, niveau);
    })
    .filter((v) => v != null);
  return moyennes.length ? moyennes.reduce((s, v) => s + v, 0) / moyennes.length : null;
}

function getRangEleve(eleve, elevesClasse, notes, matieres, periode, classe, niveau) {
  const avecMoy = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return { id: e._id, moy: getGeneralAverage(notesE, matieres, classe, niveau) };
    })
    .filter((x) => x.moy != null);
  if (avecMoy.length === 0) return null;
  avecMoy.sort((a, b) => b.moy - a.moy);
  let rang = 1;
  for (let i = 0; i < avecMoy.length; i++) {
    if (i > 0 && avecMoy[i].moy < avecMoy[i - 1].moy) rang = i + 1;
    if (avecMoy[i].id === eleve._id) return { rang, effectif: avecMoy.length };
  }
  return null;
}

function getEvolutionPeriode(eleve, allNotes, matieres, classe, niveau, periodeActuelle) {
  const idx = PERIODES_ORDRE.indexOf(periodeActuelle);
  if (idx <= 0) return null;
  const periodePrec = PERIODES_ORDRE[idx - 1];
  const notesActu = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodeActuelle);
  const notesPrec = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodePrec);
  const moyActu = getGeneralAverage(notesActu, matieres, classe, niveau);
  const moyPrec = getGeneralAverage(notesPrec, matieres, classe, niveau);
  if (moyActu == null || moyPrec == null) return null;
  return { periodePrec, moyPrec, moyActu, ecart: moyActu - moyPrec };
}

function buildBulletinPageHTML({
  eleve,
  notes,
  matieres,
  periode,
  niveau,
  maxNote,
  schoolInfo,
  rang = null,
  evolution = null,
  classStats = null,
  matiereClasseAvg = {},
  appreciation = "",
}) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const annee = getAnnee();

  const notesEleve = notes.filter((n) => n.eleveId === eleve._id && n.periode === periode);
  const lignes = matieres.map((mat) => {
    const noteMat = notesEleve.filter((n) => n.matiere === mat.nom);
    const moyenneMatiere = getSubjectAverage(noteMat, eleve.classe, niveau);
    const moy = moyenneMatiere != null ? moyenneMatiere.toFixed(2) : "—";
    return { mat: mat.nom, coef: mat.coefficient || 1, moy, moyClasse: matiereClasseAvg[mat.nom] };
  });
  const totalCoef = matieres.reduce((s, mat) => s + Number(mat.coefficient || 1), 0);
  const moyenneGenerale = getGeneralAverage(notesEleve, matieres, eleve.classe, niveau);
  const moyGene = moyenneGenerale != null ? moyenneGenerale.toFixed(2) : "—";
  const mention = getMention(moyGene, maxNote);
  const ms = getMentionColors(mention);
  const numero = getNumeroBulletin(eleve, periode, schoolInfo, annee);

  const tbody = lignes.map((l) => {
    const moyVal = l.moy === "—" ? null : Number(l.moy);
    const mLigne = getMention(l.moy, maxNote);
    const lc = getMentionColors(mLigne);
    const pct = moyVal != null ? Math.min(100, Math.max(0, (moyVal / maxNote) * 100)) : 0;
    const compare = (moyVal != null && l.moyClasse != null)
      ? (moyVal > l.moyClasse + 0.05
          ? `<span style="color:#16a34a;font-weight:700">↑ +${(moyVal - l.moyClasse).toFixed(1)}</span>`
          : moyVal < l.moyClasse - 0.05
            ? `<span style="color:#dc2626;font-weight:700">↓ ${(moyVal - l.moyClasse).toFixed(1)}</span>`
            : `<span style="color:#6b7280">=</span>`)
      : "";
    const moyClasseDisplay = l.moyClasse != null ? l.moyClasse.toFixed(1) : "—";
    return `<tr>
      <td>${l.mat}</td>
      <td style="text-align:center">${l.coef}</td>
      <td style="text-align:center">
        <div style="display:inline-flex;align-items:center;gap:6px">
          <strong style="color:${lc.color};min-width:32px;display:inline-block;text-align:right">${l.moy}</strong>
          <div style="width:48px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${lc.color}"></div>
          </div>
        </div>
      </td>
      <td style="text-align:center">${l.moy !== "—" ? (Number(l.moy) * l.coef).toFixed(2) : "—"}</td>
      <td style="text-align:center;font-size:10px;color:#6b7280">${moyClasseDisplay} ${compare}</td>
      <td style="background:${lc.bg};color:${lc.color};font-weight:600;font-size:10.5px">${mLigne}</td>
    </tr>`;
  }).join("");

  return `
  <div class="page">
    ${enteteDoc(schoolInfo, schoolInfo.logo)}

    <div style="background:linear-gradient(135deg,${c1},${c1}dd);color:#fff;padding:9px 16px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:800;letter-spacing:0.04em">BULLETIN DE NOTES</div>
        <div style="font-size:11px;opacity:0.85">${periode} — Année scolaire ${annee}</div>
      </div>
      <div style="font-size:9.5px;opacity:0.78;font-family:monospace;text-align:right">N° ${numero}</div>
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:flex;gap:12px;align-items:center">
        ${eleve.photo
          ? `<img src="${eleve.photo}" alt="" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid ${c1};flex-shrink:0"/>`
          : `<div style="width:60px;height:60px;border-radius:8px;background:${c1};color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${getInitiales(eleve)}</div>`}
        <div style="flex:1;font-size:10.5px;line-height:1.6;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${c1};margin-bottom:2px">${eleve.nom || ""} ${eleve.prenom || ""}</div>
          <div><strong>Classe :</strong> ${eleve.classe || "—"} &nbsp;·&nbsp; <strong>Matricule national :</strong> ${eleve.ien || "—"}</div>
          <div><strong>Né(e) le :</strong> ${eleve.dateNaissance || "—"}${eleve.lieuNaissance ? ` à ${eleve.lieuNaissance}` : ""}</div>
        </div>
      </div>

      <div style="border:2px solid ${ms.border};border-radius:8px;padding:10px 8px;text-align:center;background:${ms.bg}">
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:0.08em;color:${ms.color};font-weight:700;margin-bottom:1px">Moyenne générale</div>
        <div style="font-size:30px;font-weight:900;color:${ms.color};line-height:1.05">${moyGene}<span style="font-size:13px;opacity:0.65">/${maxNote}</span></div>
        <div style="font-size:11px;font-weight:800;color:${ms.color};margin-top:3px;text-transform:uppercase;letter-spacing:0.04em">${mention}</div>
        ${rang ? `<div style="font-size:10px;margin-top:5px;padding-top:4px;border-top:1px solid ${ms.border};color:${ms.color}"><strong>Rang : ${rang.rang}<sup>${ordinalFr(rang.rang)}</sup> / ${rang.effectif}</strong></div>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="background:${c1}">Matière</th>
          <th style="background:${c1};text-align:center;width:50px">Coef.</th>
          <th style="background:${c1};text-align:center;width:140px">Moyenne /${maxNote}</th>
          <th style="background:${c1};text-align:center;width:80px">Moy × Coef</th>
          <th style="background:${c1};text-align:center;width:90px">Moy. classe</th>
          <th style="background:${c1};width:100px">Appréciation</th>
        </tr>
      </thead>
      <tbody>
        ${tbody}
        <tr style="background:${c1}1A;font-weight:800">
          <td colspan="2" style="color:${c1}">MOYENNE GÉNÉRALE</td>
          <td style="text-align:center;color:${c1};font-size:14px">${moyGene}/${maxNote}</td>
          <td style="text-align:center;color:${c1}">${totalCoef}</td>
          <td style="text-align:center;font-size:10px;color:#6b7280">${classStats && classStats.moyenneClasse != null ? classStats.moyenneClasse.toFixed(2) : "—"}</td>
          <td style="background:${ms.bg};color:${ms.color}">${mention}</td>
        </tr>
      </tbody>
    </table>

    ${(classStats || evolution) ? `
    <div style="display:flex;gap:8px;margin-top:8px;font-size:10px">
      ${classStats ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Statistiques de la classe</div>
        Effectif : <strong>${classStats.effectif}</strong> &nbsp;·&nbsp;
        Moy. classe : <strong>${classStats.moyenneClasse.toFixed(2)}</strong> &nbsp;·&nbsp;
        Min : <strong>${classStats.min.toFixed(1)}</strong> &nbsp;·&nbsp;
        Max : <strong>${classStats.max.toFixed(1)}</strong>
      </div>` : ""}
      ${evolution ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Évolution</div>
        ${evolution.periodePrec} : ${evolution.moyPrec.toFixed(2)} → ${periode} : <strong>${evolution.moyActu.toFixed(2)}</strong>
        ${evolution.ecart >= 0
          ? ` <span style="color:#16a34a;font-weight:700">↑ +${evolution.ecart.toFixed(2)}</span>`
          : ` <span style="color:#dc2626;font-weight:700">↓ ${evolution.ecart.toFixed(2)}</span>`}
      </div>` : ""}
    </div>` : ""}

    <div style="margin-top:10px;border:1px dashed #cbd5e1;border-radius:6px;padding:8px 12px;min-height:36px">
      <div style="font-size:8.5px;font-weight:700;color:${c1};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Appréciation du conseil de classe</div>
      <div style="font-size:11px;color:#374151;line-height:1.5">${appreciation || `<span style="color:#cbd5e1">__________________________________________________________________________</span>`}</div>
    </div>

    <div class="sigs">
      <div class="sig">Le/La Directeur(rice)<br/><br/><br/>Signature</div>
      <div class="sig">Le/La Professeur(e) Principal(e)<br/><br/><br/>Signature</div>
      <div class="sig">Le/La Parent/Tuteur<br/><br/><br/>Signature</div>
    </div>

    <div class="devise" style="color:${c2}">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>
  </div>`;
}

function getBulletinStyles() {
  return `
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px;color:#1f2937}
    .page{padding:14mm 12mm;page-break-after:always;box-sizing:border-box}
    .page:last-child{page-break-after:auto}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{color:#fff;padding:7px 9px;font-size:10.5px;text-align:left;border:1px solid rgba(0,0,0,0.05)}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f9;font-size:11px;vertical-align:middle}
    tbody tr:nth-child(odd){background:#fafafa}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px}
    .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#555}
    .devise{text-align:center;font-size:10px;margin-top:8px;font-style:italic;font-weight:700}
    @media print{body{margin:0}button{display:none}.page{padding:18px 22px}}
  `;
}

export const imprimerBulletin = (eleve, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, options = {}) => {
  const allEleves = Array.isArray(options.allEleves) ? options.allEleves : null;
  const allNotes = Array.isArray(options.allNotes) ? options.allNotes : notes;
  const elevesClasse = allEleves ? allEleves.filter((e) => e.classe === eleve.classe) : null;

  const rang = elevesClasse
    ? getRangEleve(eleve, elevesClasse, allNotes, matieres, periode, eleve.classe, niveau)
    : null;
  const classStats = elevesClasse
    ? getStatsClasse(elevesClasse, allNotes, matieres, periode, eleve.classe, niveau)
    : null;
  const matiereClasseAvg = elevesClasse
    ? Object.fromEntries(matieres.map((mat) => [
        mat.nom,
        getMoyenneClasseParMatiere(elevesClasse, allNotes, mat.nom, periode, eleve.classe, niveau),
      ]))
    : {};
  const evolution = allNotes.length > notes.length || allEleves
    ? getEvolutionPeriode(eleve, allNotes, matieres, eleve.classe, niveau, periode)
    : null;

  const html = buildBulletinPageHTML({
    eleve, notes: allNotes, matieres, periode, niveau, maxNote, schoolInfo,
    rang, classStats, matiereClasseAvg, evolution,
    appreciation: options.appreciation || "",
  });

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Bulletin ${eleve.nom || ""} ${eleve.prenom || ""} — ${periode}</title>
    <style>${getBulletinStyles()}</style>
  </head><body>${html}<script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

// ── IMPRESSION GROUPÉE : tous les bulletins d'une classe en un seul PDF ──
export const imprimerBulletinsGroupes = (eleves, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, classe = "", matieresParClasseFn = null, appreciationsParEleve = {}) => {
  if (!eleves.length) { alert("Aucun élève pour cette sélection."); return; }
  const getMat = (eleve) => (matieresParClasseFn ? matieresParClasseFn(eleve.classe) : matieres);

  // Cache par classe : stats + moyennes par matière
  const classCache = new Map();
  const getCacheClasse = (cl) => {
    if (!classCache.has(cl)) {
      const matsCl = matieresParClasseFn ? matieresParClasseFn(cl) : matieres;
      const elevesClasse = eleves.filter((e) => e.classe === cl);
      classCache.set(cl, {
        stats: getStatsClasse(elevesClasse, notes, matsCl, periode, cl, niveau),
        matieresAvg: Object.fromEntries(matsCl.map((mat) => [
          mat.nom,
          getMoyenneClasseParMatiere(elevesClasse, notes, mat.nom, periode, cl, niveau),
        ])),
        elevesClasse,
      });
    }
    return classCache.get(cl);
  };

  const pages = eleves.map((eleve) => {
    const matsEleve = getMat(eleve);
    const cache = getCacheClasse(eleve.classe);
    const rang = getRangEleve(eleve, cache.elevesClasse, notes, matsEleve, periode, eleve.classe, niveau);
    const evolution = getEvolutionPeriode(eleve, notes, matsEleve, eleve.classe, niveau, periode);
    return buildBulletinPageHTML({
      eleve, notes, matieres: matsEleve, periode, niveau, maxNote, schoolInfo,
      rang, classStats: cache.stats, matiereClasseAvg: cache.matieresAvg, evolution,
      appreciation: (appreciationsParEleve && appreciationsParEleve[eleve._id]) || "",
    });
  }).join("");

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Bulletins ${classe || niveau} — ${periode} — Année ${getAnnee()}</title>
  <style>${getBulletinStyles()}</style>
  </head><body>${pages}<script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

export const imprimerFicheCompositions = (classe, periode, notes, matieres, eleves, maxNote=20, schoolInfo={}) => {
  const mi = maxNote / 2;
  const apprec = (v) => Number(v)>=(maxNote*0.8)?"Très Bien":Number(v)>=(maxNote*0.7)?"Bien":Number(v)>=(maxNote*0.6)?"Assez Bien":Number(v)>=mi?"Passable":"Insuffisant";
  const mentionColor = (m) => m==="Très Bien"?"#166534":m==="Bien"?"#1e40af":m==="Assez Bien"?"#92400e":m==="Passable"?"#0369a1":"#991b1b";
  const mentionBg    = (m) => m==="Très Bien"?"#dcfce7":m==="Bien"?"#dbeafe":m==="Assez Bien"?"#fef3c7":m==="Passable"?"#e0f2fe":"#fee2e2";

  const elevesClasse = classe==="all" ? eleves : eleves.filter(e=>e.classe===classe);

  // Calcul des résultats par élève (notes de type Composition)
  const resultats = elevesClasse.map(e => {
    const ne = notes.filter(n=>n.eleveId===e._id && n.periode===periode && n.type==="Composition");
    let tot=0, totC=0;
    const notesMat = matieres.map(mat => {
      const nm = ne.filter(n=>n.matiere===mat.nom);
      const moy = nm.length ? nm.reduce((s,n)=>s+Number(n.note),0)/nm.length : null;
      const coef = mat.coefficient||1;
      totC+=coef; // toutes les matières comptent au dénominateur
      if(moy!==null){ tot+=moy*coef; }
      return {nom:mat.nom, coef, moy};
    });
    const moyGene = totC>0 ? tot/totC : null;
    return {eleve:e, notesMat, moyGene};
  }).filter(r=>r.moyGene!==null).sort((a,b)=>b.moyGene-a.moyGene);

  if(resultats.length===0){ alert("Aucun résultat de composition trouvé pour cette sélection."); return; }

  // Stats récapitulatives
  const nb = resultats.length;
  const moyClasse = resultats.reduce((s,r)=>s+r.moyGene,0)/nb;
  const plus_haute = Math.max(...resultats.map(r=>r.moyGene));
  const plus_basse = Math.min(...resultats.map(r=>r.moyGene));
  const admis = resultats.filter(r=>r.moyGene>=mi).length;
  const dist = {"Très Bien":0,"Bien":0,"Assez Bien":0,"Passable":0,"Insuffisant":0};
  resultats.forEach(r=>{ dist[apprec(r.moyGene.toFixed(2))]++; });

  // Colonnes matières
  const thMat = matieres.map(m=>`<th style="text-align:center;font-size:10px;padding:6px 4px">${m.nom}<br/><small style="font-weight:normal">Coef ${m.coefficient||1}</small></th>`).join("");

  // Lignes élèves avec rang
  let rang=1;
  const rows = resultats.map((r,i)=>{
    if(i>0 && r.moyGene.toFixed(2)!==resultats[i-1].moyGene.toFixed(2)) rang=i+1;
    const m = apprec(r.moyGene.toFixed(2));
    const tdMat = r.notesMat.map(n=>`<td style="text-align:center;font-size:12px">${n.moy!==null?n.moy.toFixed(2):"—"}</td>`).join("");
    return `<tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
      <td style="text-align:center;font-weight:800;color:${rang===1?"#d97706":rang===2?"#6b7280":rang===3?"#92400e":"#374151"};font-size:14px">${rang===1?"🥇":rang===2?"🥈":rang===3?"🥉":rang}</td>
      <td style="font-weight:700;padding:7px 8px">${r.eleve.nom} ${r.eleve.prenom}</td>
      <td style="text-align:center;font-size:11px;color:#555">${r.eleve.matricule||"—"}</td>
      ${tdMat}
      <td style="text-align:center;font-weight:800;font-size:14px;color:${r.moyGene>=mi?"#1a6b30":"#b91c1c"}">${r.moyGene.toFixed(2)}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${mentionBg(m)};color:${mentionColor(m)}">${m}</span></td>
    </tr>`;
  }).join("");

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Fiche Compositions — ${periode}</title>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;color:#1a1a1a;margin:0}
    h2{color:#0A1628;text-align:center;margin:10px 0 4px;font-size:16px}
    h3{text-align:center;margin:0 0 14px;font-size:13px;color:#555;font-weight:normal}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
    th{background:#0A1628;color:#fff;padding:7px 6px;text-align:left}
    td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle}
    .recap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
    .recap-card{background:#f0f6f2;border-left:4px solid #0A1628;border-radius:6px;padding:10px 14px}
    .recap-card .val{font-size:20px;font-weight:800;color:#0A1628}
    .recap-card .lbl{font-size:10px;color:#555;margin-top:2px}
    .dist{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .dist-item{flex:1;min-width:80px;padding:8px;border-radius:6px;text-align:center}
    .dist-item .dv{font-size:18px;font-weight:800}
    .dist-item .dl{font-size:10px;margin-top:2px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
    .sig{border-top:2px solid #0A1628;padding-top:8px;text-align:center;font-size:11px;color:#555}
    @media print{button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>RÉSULTATS DES ÉVALUATIONS — ${periode} — Année ${getAnnee()}</h2>
  <h3>Classe : <strong>${classe==="all"?"Toutes les classes":classe}</strong> &nbsp;|&nbsp; Effectif évalué : <strong>${nb} élève${nb>1?"s":""}</strong></h3>

  <table>
    <thead><tr>
      <th style="text-align:center;width:40px">Rang</th>
      <th>Nom & Prénom</th>
      <th style="text-align:center">Matricule</th>
      ${thMat}
      <th style="text-align:center">Moy/${maxNote}</th>
      <th style="text-align:center">Mention</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:24px;border-top:2px solid #0A1628;padding-top:14px">
    <strong style="font-size:13px;color:#0A1628;display:block;margin-bottom:10px">TABLEAU RÉCAPITULATIF</strong>
    <div class="recap">
      <div class="recap-card"><div class="val">${nb}</div><div class="lbl">Élèves évalués</div></div>
      <div class="recap-card"><div class="val">${moyClasse.toFixed(2)}/${maxNote}</div><div class="lbl">Moyenne de classe</div></div>
      <div class="recap-card"><div class="val">${admis} <small style="font-size:12px">(${Math.round(admis/nb*100)}%)</small></div><div class="lbl">Admis (moy ≥ ${mi})</div></div>
      <div class="recap-card"><div class="val">${nb-admis} <small style="font-size:12px">(${Math.round((nb-admis)/nb*100)}%)</small></div><div class="lbl">Non admis</div></div>
      <div class="recap-card"><div class="val">${plus_haute.toFixed(2)}</div><div class="lbl">Note la plus haute</div></div>
      <div class="recap-card"><div class="val">${plus_basse.toFixed(2)}</div><div class="lbl">Note la plus basse</div></div>
    </div>
    <div class="dist" style="margin-top:12px">
      ${Object.entries(dist).map(([men,cnt])=>`<div class="dist-item" style="background:${mentionBg(men)}"><div class="dv" style="color:${mentionColor(men)}">${cnt}</div><div class="dl" style="color:${mentionColor(men)}">${men}</div></div>`).join("")}
    </div>
  </div>

  <div class="sigs">
    <div class="sig">Le/La Directeur(rice)<br/><br/><br/>Signature & Cachet</div>
    <div class="sig">Le/La Prof. Principal(e)<br/><br/><br/>Signature</div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════
//  IMPRESSION — ORDRE DE MUTATION
// ══════════════════════════════════════════════════════════════
export const imprimerOrdreMutation = (eleve, schoolInfo={}, ecoleDestination="", annee="") => {
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Ordre de mutation</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;color:#111;font-size:12px;padding:18mm}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #0A1628;padding-bottom:12px}
    .entete-col{flex:1;font-size:10px;line-height:1.7}
    h1{text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#0A1628;margin:20px 0 8px;text-decoration:underline}
    .sub{text-align:center;font-size:11px;color:#444;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-bottom:18px}
    td{padding:7px 10px;border:1px solid #ccc;font-size:11px}
    td:first-child{font-weight:700;background:#f5f7fa;width:40%}
    .sigs{display:flex;justify-content:space-between;margin-top:36px}
    .sig{text-align:center;font-size:11px;flex:1}
    @media print{button{display:none}}
  </style></head><body>
  <div class="entete">
    <div class="entete-col">
      <strong>${schoolInfo.pays||"République de Guinée"}</strong><br/>
      ${schoolInfo.ministere||MINISTERE_DEFAUT}<br/>
      ${schoolInfo.ire||""} ${schoolInfo.dpe?`/ ${schoolInfo.dpe}`:""}
    </div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:55px;object-fit:contain"/>`:""}
    <div class="entete-col" style="text-align:right">
      <strong>${schoolInfo.nom||""}</strong><br/>
      ${schoolInfo.agrement?`Agrém. : ${schoolInfo.agrement}`:""}
    </div>
  </div>
  <h1>Ordre de Mutation</h1>
  <p class="sub">Année scolaire : <strong>${annee||getAnnee()}</strong></p>
  <table>
    <tr><td>Nom & Prénom</td><td><strong>${eleve.nom||""} ${eleve.prenom||""}</strong></td></tr>
    <tr><td>Matricule</td><td>${eleve.matricule||"—"}</td></tr>
    ${eleve.ien?`<tr><td>Identifiant National (IEN)</td><td>${eleve.ien}</td></tr>`:""}
    <tr><td>Date de naissance</td><td>${eleve.dateNaissance||"—"}</td></tr>
    <tr><td>Lieu de naissance</td><td>${eleve.lieuNaissance||"—"}</td></tr>
    <tr><td>Classe actuelle</td><td>${eleve.classe||"—"}</td></tr>
    <tr><td>Tuteur / Parent</td><td>${eleve.tuteur||"—"} — ${eleve.contactTuteur||"—"}</td></tr>
    <tr><td>École d'origine</td><td><strong>${schoolInfo.nom||""}</strong></td></tr>
    <tr><td>École de destination</td><td><strong>${ecoleDestination||"À compléter"}</strong></td></tr>
    <tr><td>Date de la mutation</td><td>${today()}</td></tr>
    <tr><td>Motif</td><td>${eleve.motifDepart||"Mutation volontaire"}</td></tr>
  </table>
  <p style="font-size:11px;margin-bottom:30px">
    Le Directeur soussigné certifie que l'élève ci-dessus mentionné a été régulièrement inscrit dans son établissement
    et qu'il est autorisé à rejoindre l'établissement d'accueil dans les conditions prévues par la réglementation en vigueur.
  </p>
  <div class="sigs">
    <div class="sig">Le/La Directeur(rice) de l'école d'origine<br/><br/><br/><br/>Signature & Cachet</div>
    <div class="sig">Lu et approuvé par le/la parent/tuteur<br/><br/><br/><br/>Signature</div>
  </div>
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:#0A1628;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimer</button>
  </body></html>`);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════
//  IMPRESSION — CERTIFICAT DE RADIATION
// ══════════════════════════════════════════════════════════════
export const imprimerCertificatRadiation = (eleve, schoolInfo={}, annee="", soldeRestant=0) => {
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Certificat de radiation</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;color:#111;font-size:12px;padding:20mm}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0A1628;padding-bottom:12px;margin-bottom:20px}
    .entete-col{flex:1;font-size:10px;line-height:1.7}
    h1{text-align:center;font-size:15px;text-transform:uppercase;letter-spacing:1.5px;color:#0A1628;margin:16px 0;text-decoration:underline}
    .corps{line-height:2;font-size:12px;margin:20px 0}
    .corps strong{border-bottom:1px solid #111}
    .fin{margin-top:40px;text-align:right;font-size:11px}
    .sig{margin-top:30px;text-align:center;font-size:11px}
    @media print{button{display:none}}
  </style></head><body>
  <div class="entete">
    <div class="entete-col">
      <strong>${schoolInfo.pays||"République de Guinée"}</strong><br/>
      ${schoolInfo.ministere||MINISTERE_DEFAUT}<br/>
      ${schoolInfo.ire||""} ${schoolInfo.dpe?`/ ${schoolInfo.dpe}`:""}
    </div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:55px;object-fit:contain"/>`:""}
    <div class="entete-col" style="text-align:right">
      <strong>${schoolInfo.nom||""}</strong><br/>
      ${schoolInfo.agrement?`Agrém. : ${schoolInfo.agrement}`:""}
    </div>
  </div>
  <h1>Certificat de Radiation</h1>
  <div class="corps">
    Nous, Directeur(rice) du ${schoolInfo.type||"Groupe Scolaire Privé"} <strong>${schoolInfo.nom||""}</strong>,
    certifions que l'élève :<br/><br/>
    &nbsp;&nbsp;&nbsp;Nom & Prénom : <strong>${eleve.nom||""} ${eleve.prenom||""}</strong><br/>
    &nbsp;&nbsp;&nbsp;Matricule : <strong>${eleve.matricule||"—"}</strong><br/>
    ${eleve.ien?`&nbsp;&nbsp;&nbsp;IEN : <strong>${eleve.ien}</strong><br/>`:""}
    &nbsp;&nbsp;&nbsp;Né(e) le : <strong>${eleve.dateNaissance||"—"}</strong> à <strong>${eleve.lieuNaissance||"—"}</strong><br/>
    &nbsp;&nbsp;&nbsp;Classe fréquentée : <strong>${eleve.classe||"—"}</strong><br/>
    &nbsp;&nbsp;&nbsp;Année scolaire : <strong>${annee||getAnnee()}</strong><br/><br/>
    …a été radié(e) des listes de notre établissement en date du <strong>${today()}</strong>
    pour motif de : <strong>${eleve.motifDepart||"départ volontaire"}</strong>.<br/><br/>
    Situation financière : <strong>${soldeRestant<=0?"Situation apurée — aucun solde dû":"Solde restant dû : "+fmt(soldeRestant)}</strong>
  </div>
  <p style="font-size:11px;font-style:italic">
    Ce certificat est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
  </p>
  <div class="fin">Fait à ${schoolInfo.ville||"—"}, le ${today()}</div>
  <div class="sig"><br/>Le/La Directeur(rice)<br/><br/><br/><br/>Signature & Cachet officiel</div>
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:#0A1628;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimer</button>
  </body></html>`);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════
//  IMPRESSION — LIVRET SCOLAIRE OFFICIEL
// ══════════════════════════════════════════════════════════════
export const imprimerLivret = (livret, schoolInfo={}) => {
  const c1 = schoolInfo.couleur1||"#0A1628";
  const annees = livret.annees||[];
  const pagesAnnees = annees.map((an, idx) => {
    const notesRows = (an.notes||[]).map(n=>`
      <tr>
        <td>${n.matiere||""}</td>
        <td style="text-align:center">${n.coef||1}</td>
        <td style="text-align:center">${n.T1!=null?n.T1:"—"}</td>
        <td style="text-align:center">${n.T2!=null?n.T2:"—"}</td>
        <td style="text-align:center">${n.T3!=null?n.T3:"—"}</td>
        <td style="text-align:center;font-weight:700;color:${Number(n.annuelle||0)>=Number(n.maxNote||20)/2?"#14532d":"#b91c1c"}">${n.annuelle!=null?Number(n.annuelle).toFixed(2):"—"}</td>
      </tr>`).join("");
    const decisionColor = an.decision==="Admis avec félicitations"?"#14532d":an.decision==="Admis"?"#1d4ed8":an.decision==="Redoublant"?"#b45309":"#b91c1c";
    return `
    <div class="page-annee" style="page-break-before:${idx>0?"always":"auto"}">
      <div class="bandeau" style="background:${c1}">
        <span>Livret scolaire — ${schoolInfo.nom||""}</span>
        <span>Année ${an.anneeScolaire||"—"}</span>
      </div>
      <div class="info-row">
        <span><b>Classe :</b> ${an.classe||"—"}</span>
        <span><b>Enseignant(e) principal(e) :</b> ${an.enseignantPrincipal||"—"}</span>
        <span><b>Effectif :</b> ${an.effectifClasse||"—"}</span>
        <span><b>Rang :</b> ${an.rang||"—"}</span>
      </div>
      <table class="notes-tbl">
        <thead><tr style="background:${c1};color:#fff">
          <th style="text-align:left">Matière</th>
          <th>Coef</th><th>T1</th><th>T2</th><th>T3</th><th>Annuelle</th>
        </tr></thead>
        <tbody>${notesRows}</tbody>
      </table>
      <div class="abs-row">
        <span>Absences justifiées : <b>${an.absences?.justifiees||0}</b></span>
        <span>Absences non justifiées : <b>${an.absences?.nonJustifiees||0}</b></span>
      </div>
      <div class="appreciation">
        <strong>Appréciation générale de l'enseignant :</strong><br/>
        <div style="min-height:40px;padding-top:6px">${an.appreciation||""}</div>
      </div>
      <div class="decision-box" style="border-color:${decisionColor}">
        <strong>Décision du conseil de classe :</strong>
        <span class="decision-badge" style="background:${decisionColor}">${an.decision||"—"}</span>
      </div>
      <div class="sigs-livret">
        <div class="sig-livret">Le/La Directeur(rice)<br/><br/>${an.signe?`<em style="font-size:9px;color:#14532d">✅ Signé le ${an.dateSigne||""}</em>`:"<br/>Signature & Cachet"}</div>
        <div class="sig-livret">Le/La parent / tuteur<br/><br/><br/>Signature</div>
        <div class="sig-livret">Visa de l'Inspecteur<br/><br/><br/>&nbsp;</div>
      </div>
    </div>`;
  }).join("");

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Livret scolaire — ${livret.eleveNom||""}</title>
  <meta charset="utf-8"/>
  <style>
    ${PRINT_RESET}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111;font-size:11px;margin:0;padding:12mm}
    .couverture{display:flex;flex-direction:column;align-items:center;justify-content:center;height:250mm;text-align:center;border:3px solid ${c1};padding:30px;page-break-after:always}
    .couv-school{font-size:11px;color:#444;margin-bottom:4px}
    .couv-titre{font-size:22px;font-weight:900;color:${c1};text-transform:uppercase;letter-spacing:3px;margin:16px 0 8px}
    .couv-num{font-size:12px;color:#6b7280;margin-bottom:20px}
    .couv-photo{width:90px;height:110px;border:2px solid ${c1};border-radius:4px;object-fit:cover;margin-bottom:16px}
    .couv-nom{font-size:18px;font-weight:900;color:#111;margin-bottom:6px}
    .couv-info{font-size:12px;color:#444;line-height:2}
    .bandeau{display:flex;justify-content:space-between;padding:7px 12px;color:#fff;font-weight:700;font-size:11px;border-radius:4px;margin-bottom:10px}
    .info-row{display:flex;gap:20px;font-size:11px;margin-bottom:10px;flex-wrap:wrap}
    .notes-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
    .notes-tbl td,.notes-tbl th{border:1px solid #ccc;padding:4px 7px}
    .abs-row{display:flex;gap:30px;font-size:11px;margin-bottom:10px;color:#374151}
    .appreciation{border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11px}
    .decision-box{display:flex;align-items:center;gap:14px;border:2px solid;border-radius:8px;padding:8px 14px;margin-bottom:12px}
    .decision-badge{padding:4px 14px;border-radius:14px;color:#fff;font-weight:900;font-size:12px}
    .sigs-livret{display:flex;justify-content:space-between;margin-top:16px}
    .sig-livret{text-align:center;flex:1;font-size:10px;border-top:1px solid #999;padding-top:6px;margin:0 8px}
    @media print{button{display:none}.page-annee{page-break-before:always}}
  </style></head><body>
  <!-- COUVERTURE -->
  <div class="couverture">
    <div class="couv-school">${schoolInfo.pays||"République de Guinée"} · ${schoolInfo.ministere||MINISTERE_DEFAUT}</div>
    ${schoolInfo.logo?`<img src="${schoolInfo.logo}" style="height:50px;margin-bottom:8px"/>`:""}
    <div style="font-size:13px;font-weight:700;color:#111">${schoolInfo.nom||""}</div>
    <div style="font-size:10px;color:#6b7280;margin-bottom:12px">${schoolInfo.agrement?`Agrém. ${schoolInfo.agrement}`:""}</div>
    <div class="couv-titre">Livret Scolaire</div>
    <div class="couv-num">N° ${livret.numeroLivret||"—"}</div>
    ${livret.photo?`<img src="${livret.photo}" class="couv-photo"/>`:`<div class="couv-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px;background:#f0f4f8">👤</div>`}
    <div class="couv-nom">${livret.eleveNom||"—"}</div>
    <div class="couv-info">
      Né(e) le : <strong>${livret.dateNaissance||"—"}</strong> à <strong>${livret.lieuNaissance||"—"}</strong><br/>
      Matricule : <strong>${livret.matricule||"—"}</strong>
      ${livret.ien?`&nbsp;·&nbsp;IEN : <strong>${livret.ien}</strong>`:""}<br/>
      Section : <strong>${livret.section==="primaire"?"Enseignement Primaire":livret.section==="lycee"?"Lycée":"Collège"}</strong>
    </div>
  </div>
  <!-- PAGES ANNUELLES -->
  ${pagesAnnees||`<div style="padding:40px;text-align:center;color:#9ca3af">Aucune année saisie dans ce livret.</div>`}
  <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:8px 20px;background:${c1};color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨️ Imprimer</button>
  </body></html>`);
  w.document.close();
};

