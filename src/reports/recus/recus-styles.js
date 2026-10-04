// Feuille de style des reçus de paiement (deux exemplaires par page A4).
// PRINT_RESET est ajouté en amont par l'appelant.
// Chaque exemplaire occupe exactement une demi-page (flex:1 1 0) : il ne
// grandit jamais au point de pousser le second sur une deuxième feuille.
export const RECU_STYLES = `
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:6mm;background:#fff;
         height:282mm;display:flex;flex-direction:column;gap:3mm}
    .recu{flex:1 1 0;min-height:0;overflow:hidden;padding:8px 12px;border:1px solid #bbb;border-radius:3px;display:flex;flex-direction:column;position:relative}
    .recu-corps{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}
    .watermark{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark img{width:160px;height:160px;object-fit:contain;opacity:0.09}
    .badge{text-align:center;background:#0A1628;color:#fff;padding:4px;font-size:10px;font-weight:bold;margin:5px 0 2px;border-radius:3px}
    .exemplaire{text-align:right;font-size:8px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-bottom:6px}
    .row{font-size:8.5px}.lbl{font-weight:bold;color:#0A1628}
    .mois-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start;margin-bottom:5px}
    .mois-table{width:100%;border-collapse:collapse;font-size:8px}
    .mois-table th{background:#0A1628;color:#fff;padding:3px 6px;text-align:left;font-size:7.5px}
    .mois-table td{padding:2px 6px;border-bottom:1px solid #eee}
    .mois-table tr.paye td{color:#166534;background:#f0fdf4}
    .mois-table tr.impaye td{color:#9ca3af}
    .frais{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:8.5px;padding:4px 8px;background:#f0f9ff;color:#0A1628;border-radius:2px}
    .total{text-align:right;font-size:10px;font-weight:bold;padding:4px 8px;background:#e8f0e8;color:#0A1628;margin-top:4px;border-radius:2px}
    /* Une colonne par bloc, quel qu'en soit le nombre : un second signataire
       (visa, matrice des signatures) s'aligne sans passer à la ligne. */
    .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:12px;margin-top:auto;padding-top:10px}
    .sig{border-top:1.5px solid #0A1628;padding-top:4px;text-align:center;font-size:8.5px;color:#333;font-weight:600}
    @media print{body{height:282mm}button{display:none}}`;

// Filet de sécurité, exécuté avant l'impression : si un reçu reste plus haut
// que sa demi-page (12 mois, beaucoup de frais, plusieurs signataires…), on
// le réduit d'un bloc (zoom) au lieu de le laisser tronquer ou déborder.
export const RECU_AJUSTEMENT = `
  (function(){
    function ajuster(){
      Array.prototype.forEach.call(document.querySelectorAll(".recu"), function(recu){
        var corps = recu.querySelector(".recu-corps");
        if (!corps) return;
        corps.style.zoom = ""; corps.style.height = "auto";
        var cs = getComputedStyle(recu);
        var dispo = recu.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        var naturel = corps.scrollHeight;
        var z = naturel > dispo ? dispo / naturel : 1;
        corps.style.zoom = z < 1 ? String(Math.floor(z * 1000) / 1000) : "";
        corps.style.height = z < 1 ? (dispo / z) + "px" : "";
      });
    }
    ajuster();
    window.addEventListener("load", ajuster);
    window.addEventListener("beforeprint", ajuster);
  })();
`;
