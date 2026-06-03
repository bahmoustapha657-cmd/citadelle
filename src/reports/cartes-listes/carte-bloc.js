// Pré-génération des QR codes et fabrique du fragment HTML d'une carte élève.
import { loadQRCode, tr } from "../print-helpers.js";

// Génère la data URL du QR (matricule) pour chaque élève. Tolérant aux erreurs.
export async function genererQrMap(eleves) {
  const qrMap = {};
  const QRCode = await loadQRCode();
  await Promise.all(eleves.map(async e => {
    try {
      qrMap[e._id] = await QRCode.toDataURL(e.matricule || e._id, {
        width: 80, margin: 0, color: { dark: "#0A1628", light: "#ffffff" },
      });
    } catch { qrMap[e._id] = ""; }
  }));
  return qrMap;
}

// Fragment HTML d'une carte élève. ctx = { logo, nomEcole, ville, annee, qrMap }.
export function carteEleve(e, { logo, nomEcole, ville, annee, qrMap }) {
  return `
  <div class="carte">
    <!-- Bande déco gauche couleur 2 -->
    <div class="bande-gauche"></div>

    <div class="carte-inner">
      <!-- EN-TÊTE -->
      <div class="carte-header">
        <div class="logo-wrap">
          ${logo
            ? `<img src="${logo}" class="carte-logo"/>`
            : `<div class="logo-initiales">${nomEcole.slice(0, 2).toUpperCase()}</div>`}
        </div>
        <div class="carte-titre">
          <div class="carte-ecole">${nomEcole}</div>
          ${ville ? `<div class="carte-ville">${ville}</div>` : ""}
          <div class="carte-sous">${tr("reports.card.title").toUpperCase()}</div>
        </div>
        <div class="annee-badge">${annee}</div>
      </div>

      <!-- SÉPARATEUR -->
      <div class="separateur"></div>

      <!-- CORPS -->
      <div class="carte-body">
        <div class="carte-photo">
          ${e.photo
            ? `<img src="${e.photo}" class="photo-img"/>`
            : `<div class="photo-initiales">${(e.prenom || "?")[0].toUpperCase()}${(e.nom || "?")[0].toUpperCase()}</div>`}
        </div>
        <div class="carte-infos">
          <div class="carte-nom">${(e.prenom || "").toUpperCase()} ${(e.nom || "").toUpperCase()}</div>
          <div class="info-ligne"><span class="info-label">${tr("school.bulletins.matricule")}</span><span class="info-val">${e.matricule || "—"}</span></div>
          ${e.ien ? `<div class="info-ligne"><span class="info-label">IEN</span><span class="info-val ien">${e.ien}</span></div>` : ""}
          <div class="info-ligne"><span class="info-label">${tr("reports.class")}</span><span class="info-val">${e.classe || "—"}</span></div>
          <div class="info-ligne"><span class="info-label">${tr("reports.dateOfBirth")}</span><span class="info-val">${e.dateNaissance || "—"}</span></div>
          ${e.sexe ? `<div class="info-ligne"><span class="info-label">${tr("common.status")}</span><span class="info-val">${e.sexe}</span></div>` : ""}
        </div>
      </div>

      <!-- PIED -->
      <div class="carte-footer">
        <div class="footer-left">
          <span class="footer-label">${tr("reports.signature")} — ${tr("reports.director")}</span>
          <div class="footer-ligne"></div>
        </div>
        <div class="footer-center">
          ${qrMap[e._id]
            ? `<div class="qr-wrap"><img src="${qrMap[e._id]}" class="qr-img"/><div class="mat-badge">${e.matricule || ""}</div></div>`
            : `<div class="mat-badge">${e.matricule || ""}</div>`}
        </div>
        <div class="footer-right">
          <span class="footer-label">${tr("reports.signature")} — ${tr("reports.studentName")}</span>
          <div class="footer-ligne"></div>
        </div>
      </div>
    </div>
  </div>`;
}
