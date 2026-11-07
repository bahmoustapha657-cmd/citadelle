// ══════════════════════════════════════════════════════════════
//  Tableau d'honneur — AFFICHE pour le mur de l'école
// ══════════════════════════════════════════════════════════════
// Ce n'est pas un document de classeur : il sera punaisé dans un couloir et
// lu debout, à deux mètres. D'où les partis pris — A4 PAYSAGE, un podium au
// centre de la page, des noms en grands caractères, et aucune colonne
// technique (ni matricule ni contact). Ce que la direction affiche pour
// féliciter, pas ce qu'elle archive.
//
// Le style est celui d'un diplôme, comme le bulletin Prestige
// (./ornements.js) : cadre guilloché à la couleur de l'école, emblème dans
// une couronne de laurier, médailles or, argent et bronze, ruban portant le
// nom de la classe. Tout est vectoriel et en polices installées d'office :
// rien n'est chargé depuis Internet, et l'affiche reste lisible imprimée en
// noir et blanc. La seconde couleur de l'école n'écrit jamais de texte : un
// vert citron ou un jaune y deviendraient illisibles sur le blanc.
//
// Une affiche PAR CLASSE (une page chacune, imprimées d'un seul coup), ou une
// seule pour toute la section. Sur l'affiche d'une classe, la classe est dite
// une fois, dans le ruban sous le titre : la répéter sur chaque carte et
// chaque ligne ne ferait que voler la place des noms.
//
// Les mentions suivent le BARÈME de la section (getMention) : le primaire et
// le préscolaire sont notés sur 10, des seuils figés sur 20 y auraient
// affiché « Insuffisant » sous le nom d'un excellent élève — sur un mur.

import { PRINT_TRIGGER, printDir, printLang, printResetFor } from "./print-helpers.js";
import { getMention } from "./bulletins/bulletin-format.js";
import { dateDuJour, echapper, identiteEcole, mentionFr, nb } from "./bulletins/bulletin-pro-commun.js";
import {
  OR, OR_FONCE, SERIF, ajusterPagesScript, cadreGuilloche, laurier, medaille, monogramme, rosace,
} from "./ornements.js";
import { nomAffiche } from "../ordre-eleves.js";

// Ordre du podium à l'italienne : 2e à gauche, 1er au centre surélevé, 3e à
// droite. C'est ce que l'œil attend, et le premier ressort sans le dire.
const ORDRE_PODIUM = [1, 0, 2];
// Densité selon la longueur de la liste sous le podium (ex aequo compris) :
// podium seul agrandi, normal, resserré (.serre), très resserré
// (.tres-serre). Au palmarès de section, chaque ligne porte aussi la classe
// sous le nom et compte plus haut. Le filet de sécurité (ajusterPagesScript)
// réduit encore au besoin.
const densite = (suite, avecClasse) => {
  const poids = avecClasse ? suite + 3 : suite;
  if (!suite) return " seul";
  if (poids > 12) return " serre tres-serre";
  return poids > 8 ? " serre" : "";
};

// Une affiche = une feuille A4 paysage (297 × 210 mm), cadre compris. La
// hauteur est un minimum : une liste d'ex aequo hors norme est d'abord
// réduite (ajusterPagesScript), jamais coupée.
const css = () => `${printResetFor("size:A4 landscape;margin:0")}
body { margin: 0; padding: 0; color: #1d1d1f; font-family: ${SERIF}; font-variant-numeric: lining-nums; background: #fff; }
@media screen { body { background: #e5e7eb; } .affiche { margin: 0 auto 10px; box-shadow: 0 1px 4px rgba(0,0,0,.15); } }
.affiche { position: relative; width: 297mm; min-height: 209mm; box-sizing: border-box; display: flex; flex-direction: column; background: #fff; break-after: page; page-break-after: always; }
/* :last-of-type, pas :last-child — les scripts suivent la dernière affiche. */
.affiche:last-of-type { break-after: auto; page-break-after: auto; }
.affiche sup { font-size: .62em; line-height: 0; }
.cadre { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
/* Centré par calc(), pas par transform : Chrome pagine d'après la boîte AVANT
   transformation, qui dépassait du bas et ajoutait une page blanche. */
.fili { position: absolute; left: calc(50% - 75mm); top: calc(56% - 75mm); width: 150mm; height: 150mm; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none; }
.fili svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.fili img { width: 82mm; height: 82mm; object-fit: contain; opacity: .06; }
.corps { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; padding: 12mm 17mm 12mm; }
.ajustable { flex: 1; display: flex; flex-direction: column; }

/* En-tête : l'État à gauche, l'emblème au centre, l'école à droite. */
.tete { display: grid; grid-template-columns: 1fr 30mm 1fr; align-items: center; gap: 6mm; }
.etat { font-size: 7.4px; line-height: 1.45; color: #3d3d3d; text-align: center; }
.etat .rep { font-size: 9px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #1d1d1f; }
.etat .dev { font-size: 8.6px; margin: .4mm 0 .8mm; }
.etat .tut { margin-top: .6mm; letter-spacing: .08em; color: #555; }
.embleme { position: relative; width: 30mm; height: 27mm; display: flex; align-items: center; justify-content: center; }
.embleme .laurier { position: absolute; left: 1mm; top: -.5mm; width: 28mm; height: 28mm; }
.embleme img { position: relative; width: 16.5mm; height: 16.5mm; object-fit: contain; margin-top: -1mm; }
.mono { position: relative; width: 16mm; height: 16mm; margin-top: -1mm; border-radius: 50%; border: .5mm double var(--c1); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; letter-spacing: .06em; color: var(--c1); }
.ecole { text-align: center; }
.ecole .nom { font-size: 16px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--c1); line-height: 1.2; }
.ecole .coord { font-size: 7.6px; color: #5d5d5d; margin-top: .8mm; letter-spacing: .03em; }

/* Titre, ruban de la classe, période. */
.titre { display: flex; align-items: center; gap: 6mm; margin: 2.6mm 10mm 0; }
.titre i { flex: 1; height: 1.4mm; border-top: .4mm solid ${OR}; border-bottom: .2mm solid ${OR}; }
.titre h1 { margin: 0; font-size: 38px; font-weight: 700; letter-spacing: .2em; padding-left: .2em; text-transform: uppercase; color: var(--c1); line-height: 1.1; white-space: nowrap; }
.sous { text-align: center; margin-top: 1.6mm; }
/* Le nom de la classe : ce que le parent cherche en premier sur le mur. */
.ruban { position: relative; display: inline-block; padding: 1.3mm 12mm 1.5mm; background: var(--c1); color: #fff; font-size: 21px; font-weight: 700; letter-spacing: .06em; line-height: 1.2; }
.ruban::before, .ruban::after { content: ""; position: absolute; top: 1.6mm; bottom: -1.6mm; width: 7mm; background: #222; background: color-mix(in srgb, var(--c1) 72%, #000); z-index: -1; }
.ruban::before { left: -4.5mm; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 2.6mm 50%); }
.ruban::after { right: -4.5mm; clip-path: polygon(0 0, 100% 0, calc(100% - 2.6mm) 50%, 100% 100%, 0 100%); }
.portee { font-size: 21px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--c1); }
.per { margin-top: 1.4mm; font-size: 13px; font-style: italic; color: #444; letter-spacing: .03em; }

/* Scène : le podium, puis la liste des suivants, centrés dans la place
   restante — une petite classe n'a pas de grand vide en bas de l'affiche. */
.scene { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4mm; padding: 3mm 0 2mm; }
.podium { display: flex; justify-content: center; align-items: flex-end; gap: 9mm; }
.place { position: relative; flex: 0 1 74mm; text-align: center; padding: 0 2mm 2.6mm; border-bottom: .5mm solid ${OR}; }
.place .medaille { display: block; margin: 0 auto 1.2mm; }
.place .nom { font-size: 23px; font-weight: 700; color: var(--c1); line-height: 1.12; }
.place .classe { font-size: 11px; color: #666; letter-spacing: .05em; margin-top: .6mm; }
.place .moy { font-size: 27px; font-weight: 700; color: #1d1d1f; margin-top: 1.2mm; line-height: 1; }
.place .moy small { font-size: 12px; font-weight: 400; color: #777; margin-left: .6mm; }
.place .mention { margin-top: .8mm; font-size: 13px; font-style: italic; color: ${OR_FONCE}; }
/* Le premier : au centre, plus grand, posé sur un socle doré plus haut. */
.place.premier { flex-basis: 92mm; padding-bottom: 6mm; border-bottom: 1.2mm double ${OR}; }
.place.premier .nom { font-size: 30px; }
.place.premier .moy { font-size: 35px; }
.place.premier .mention { font-size: 15px; }

/* Les suivants, sur deux colonnes : une liste d'honneur, pas un tableur. */
.liste { display: flex; justify-content: center; gap: 9mm; }
.colonne { flex: 0 1 127mm; }
.ligne { display: grid; grid-template-columns: 11mm 1fr 16mm 21mm; align-items: baseline; gap: 2mm; padding: 1.1mm 1.5mm; border-bottom: .2mm solid #e3dccd; }
.ligne:nth-child(odd) { background: #f7f9fb; background: color-mix(in srgb, var(--c1) 3%, #fff); }
.ligne.entete { background: none; border-bottom: .4mm solid var(--c1); padding-top: 0; font-size: 8.4px; letter-spacing: .14em; text-transform: uppercase; color: ${OR_FONCE}; }
.ligne .r { font-size: 16px; font-weight: 700; color: var(--c1); text-align: center; }
/* Un nom n'est JAMAIS coupé sur une affiche d'honneur : trop long, il passe
   à la ligne. Au palmarès de section, la classe s'écrit sous le nom plutôt
   que dans une colonne qui lui volerait la largeur. */
.ligne .n { font-size: 17px; font-weight: 700; color: #1d1d1f; line-height: 1.15; overflow-wrap: anywhere; }
.ligne .n .cl { display: block; font-size: 11px; font-weight: 400; color: #555; letter-spacing: .03em; }
.ligne .m { font-size: 17px; font-weight: 700; color: var(--c1); text-align: center; font-variant-numeric: lining-nums tabular-nums; }
.ligne .me { font-size: 13px; font-style: italic; color: #555; }
/* Préfixe .liste : l'en-tête garde sa petite taille sous .serre / .tres-serre. */
.liste .ligne.entete .r, .liste .ligne.entete .n, .liste .ligne.entete .m, .liste .ligne.entete .me { font-size: inherit; font-weight: 400; font-style: normal; color: inherit; }

/* Pied : bilan à gauche, devise au centre, date et Direction à droite. */
.pied { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 6mm; margin-top: 2mm; padding-top: 2mm; border-top: .25mm solid #d8cfbf; font-size: 10px; color: #555; }
.pied .devise { font-size: 12px; font-style: italic; font-weight: 700; letter-spacing: .05em; color: var(--c1); text-align: center; }
.pied .d { text-align: right; }
.pied .d b { display: block; margin-top: .6mm; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--c1); }

/* Podium seul (trois lauréats ou moins) : il prend la place de la liste. */
.seul .podium { gap: 14mm; }
.seul .place { flex-basis: 84mm; }
.seul .place.premier { flex-basis: 104mm; }
.seul .place .medaille { width: 19mm; height: 25.1mm; }
.seul .place.premier .medaille { width: 24mm; height: 31.7mm; }
.seul .place .nom { font-size: 28px; }
.seul .place.premier .nom { font-size: 37px; }
.seul .place .moy { font-size: 32px; }
.seul .place.premier .moy { font-size: 43px; }
.seul .place .mention { font-size: 15px; }
.seul .place.premier .mention { font-size: 18px; }

.serre .tete { grid-template-columns: 1fr 26mm 1fr; }
.serre .embleme { width: 26mm; height: 23mm; }
.serre .embleme .laurier { width: 24mm; height: 24mm; }
.serre .embleme img, .serre .mono { width: 14mm; height: 14mm; }
.serre .titre h1 { font-size: 32px; }
.serre .ruban { font-size: 18px; }
.serre .scene { gap: 2.5mm; }
.serre .place .medaille { width: 12mm; height: 15.8mm; }
.serre .place .nom { font-size: 20px; }
.serre .place.premier .nom { font-size: 25px; }
.serre .place .moy { font-size: 23px; }
.serre .place.premier .moy { font-size: 29px; }
.serre .ligne { padding: .6mm 1.5mm; }
.serre .ligne .n, .serre .ligne .m { font-size: 15px; }

/* Longue liste (ex aequo nombreux, palmarès de section) : tout se resserre
   encore, sauf la lisibilité des noms à distance. */
.tres-serre .corps { padding-top: 10.5mm; padding-bottom: 10.5mm; }
.tres-serre .tete { grid-template-columns: 1fr 22mm 1fr; }
.tres-serre .embleme { width: 22mm; height: 19mm; }
.tres-serre .embleme .laurier { width: 20mm; height: 20mm; }
.tres-serre .embleme img, .tres-serre .mono { width: 11.5mm; height: 11.5mm; font-size: 12px; }
.tres-serre .titre { margin-top: 1.5mm; }
.tres-serre .titre h1 { font-size: 28px; }
.tres-serre .ruban { font-size: 16px; padding: .9mm 10mm 1.1mm; }
.tres-serre .per { font-size: 11.5px; margin-top: .8mm; }
.tres-serre .scene { gap: 2mm; padding-top: 2mm; }
.tres-serre .place .medaille { width: 10mm; height: 13.2mm; }
.tres-serre .place .nom { font-size: 18px; }
.tres-serre .place.premier { padding-bottom: 3.5mm; }
.tres-serre .place.premier .nom { font-size: 22px; }
.tres-serre .place .moy { font-size: 20px; }
.tres-serre .place.premier .moy { font-size: 25px; }
.tres-serre .place .mention { font-size: 12px; }
.tres-serre .ligne { padding: .35mm 1.5mm; }
.tres-serre .ligne .r, .tres-serre .ligne .n, .tres-serre .ligne .m { font-size: 14px; }
.tres-serre .ligne .me { font-size: 12px; }
`;

// Rang affiché : celui du classement (ex aequo compris) quand l'appelant le
// fournit, la position sinon.
const rangDe = (e, position) => (Number.isFinite(e.rang) ? e.rang : position + 1);
const ordinal = (rang) => (rang === 1 ? "1<sup>er</sup>" : `${rang}<sup>e</sup>`);
const mentionDe = (moyenne, maxNote) => mentionFr(getMention(moyenne, maxNote));

const carte = (e, position, maxNote, avecClasse, tri) => {
  const rang = rangDe(e, position);
  const premier = rang === 1;
  return `
  <div class="place${premier ? " premier" : ""}">
    ${medaille(rang, premier ? 17 : 14)}
    <div class="nom">${echapper(nomAffiche(e, tri))}</div>
    ${avecClasse ? `<div class="classe">${echapper(e.classe)}</div>` : ""}
    <div class="moy">${nb(e.moyenne)}<small>/${maxNote}</small></div>
    <div class="mention">${mentionDe(e.moyenne, maxNote)}</div>
  </div>`;
};

// Le barème voyage dans l'EN-TÊTE de la colonne Moyenne (« Moyenne /10 »),
// pas dans les cellules : le primaire et le préscolaire sont notés sur 10, et
// une colonne de « 9,40 » sans repère se lit sur 20 — un parent debout devant
// l'affiche croit son enfant en échec. Les cartes du podium, elles, portent
// déjà le barème chacune.
const colonne = (lignes, maxNote, avecClasse, tri) => `<div class="colonne">
  <div class="ligne entete"><span class="r">Rang</span><span class="n">Élève${avecClasse ? " · Classe" : ""}</span><span class="m">Moy. /${maxNote}</span><span class="me">Mention</span></div>
  ${lignes.map(({ e, position }) => `<div class="ligne">
    <span class="r">${ordinal(rangDe(e, position))}</span>
    <span class="n">${echapper(nomAffiche(e, tri))}${avecClasse ? `<span class="cl">${echapper(e.classe)}</span>` : ""}</span>
    <span class="m">${nb(e.moyenne)}</span>
    <span class="me">${mentionDe(e.moyenne, maxNote)}</span>
  </div>`).join("")}
</div>`;

// Une affiche. `classe` présente = affiche de cette classe (sans colonne
// Classe) ; absente = palmarès de toute la section.
//
// Les noms s'écrivent dans l'ordre réglé par l'école (schoolInfo.triEleves,
// « Prénom NOM » ou « NOM Prénom ») : l'affiche reprend mot pour mot ce que
// l'onglet montre.
const affiche = ({ classe = "", classement, evalues }, schoolInfo, { periodeLabel, portee, annee, maxNote }) => {
  const avecClasse = !classe;
  const tri = schoolInfo.triEleves;
  const ecole = identiteEcole(schoolInfo);
  const podium = classement.slice(0, 3);
  // Les suivants en deux colonnes équilibrées (la gauche prend l'impair) ;
  // trois lignes ou moins tiennent sur une seule.
  const suite = classement.slice(3).map((e, i) => ({ e, position: i + 3 }));
  const moitie = suite.length > 3 ? Math.ceil(suite.length / 2) : suite.length;
  const colonnes = [suite.slice(0, moitie), suite.slice(moitie)].filter((c) => c.length);
  const periode = [periodeLabel, annee && `Année scolaire ${annee}`].filter(Boolean).map(echapper).join(" · ");
  const microTexte = echapper(`${schoolInfo.nom || ""} · Tableau d'honneur · ${classe || portee || ""} · ${annee || ""}`.toUpperCase());
  const lieu = ecole.ville ? `Fait à ${ecole.ville}, le ${dateDuJour()}` : `Affiché le ${dateDuJour()}`;
  return `
  <section class="affiche${densite(suite.length, avecClasse)}" style="--c1:${schoolInfo.couleur1 || "#0A1628"}">
    ${cadreGuilloche({ largeur: 297, hauteur: 210, microTexte })}
    <div class="fili" aria-hidden="true">
      <svg viewBox="-60 -60 120 120">${rosace({ n: 48, rCentre: 19, rCercle: 31, epaisseur: 0.16, opacite: 0.12 })}</svg>
      ${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : ""}
    </div>
    <div class="corps"><div class="ajustable">
      <div class="tete">
        <div class="etat">
          <div class="rep">${ecole.pays}</div>
          <div class="dev">${ecole.devise}</div>
          <div>${ecole.ministere}</div>
          ${ecole.tutelle ? `<div class="tut">${ecole.tutelle}</div>` : ""}
        </div>
        <div class="embleme">${laurier(28)}${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : monogramme(schoolInfo.nom)}</div>
        <div class="ecole">
          <div class="nom">${ecole.nom}</div>
          <div class="coord">${[ecole.adresse, ecole.contact, ecole.agrement].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div class="titre"><i></i><h1>Tableau d'honneur</h1><i></i></div>
      <div class="sous">
        ${classe ? `<span class="ruban">${echapper(classe)}</span>` : (portee ? `<div class="portee">${echapper(portee)}</div>` : "")}
        ${periode ? `<div class="per">${periode}</div>` : ""}
      </div>
      <div class="scene">
        <div class="podium">
          ${ORDRE_PODIUM.filter((p) => podium[p]).map((p) => carte(podium[p], p, maxNote, avecClasse, tri)).join("")}
        </div>
        ${colonnes.length ? `<div class="liste">${colonnes.map((c) => colonne(c, maxNote, avecClasse, tri)).join("")}</div>` : ""}
      </div>
      <div class="pied">
        <div>${classement.length} élève${classement.length > 1 ? "s" : ""} à l'honneur${Number.isFinite(evalues) ? ` sur ${evalues} classé${evalues > 1 ? "s" : ""}` : ""} · moyennes sur ${maxNote}</div>
        <div class="devise">${schoolInfo.devise ? echapper(schoolInfo.devise) : ""}</div>
        <div class="d">${lieu}<b>La Direction</b></div>
      </div>
    </div></div>
  </section>`;
};

// Document complet, sans l'ouvrir : séparé de l'impression pour pouvoir
// mesurer la mise en page hors navigateur d'impression.
// `affiches` : [{ classe?, classement, evalues? }] — `classement` déjà TRIÉ
// et limité par l'appelant ([{ nom, prenom, classe, moyenne, rang? }]) : le
// calcul des moyennes reste à l'écran, qui connaît les matières et la
// période. Ce module ne fait que mettre en page.
export function htmlTableauxHonneur(affiches = [], schoolInfo = {}, options = {}) {
  const { periodeLabel = "", portee = "", annee = "", maxNote = 20 } = options;
  const titre = affiches.length === 1 && affiches[0].classe
    ? `Tableau d'honneur — ${affiches[0].classe}`
    : "Tableau d'honneur";
  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${echapper(titre)} — ${echapper(schoolInfo.nom || "École")}</title>
  <style>${css()}</style></head><body>
  ${affiches.map((a) => affiche(a, schoolInfo, { periodeLabel, portee, annee, maxNote })).join("")}
  <script>${ajusterPagesScript(".affiche", 210)}</script>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`;
}

// Imprime plusieurs affiches d'un coup (une par page) — typiquement une par
// classe. Les affiches sans lauréat sont écartées : une page blanche au mur
// ne félicite personne.
export function imprimerTableauxHonneur(affiches = [], schoolInfo = {}, options = {}) {
  const pleines = affiches.filter((a) => a.classement?.length);
  if (!pleines.length) { alert("Aucun élève classé à afficher."); return; }
  const w = window.open("", "_blank");
  w.document.write(htmlTableauxHonneur(pleines, schoolInfo, options));
  w.document.close();
}

// Une seule affiche (palmarès de la section, ou une classe via options.classe).
export function imprimerTableauHonneur(classement = [], schoolInfo = {}, options = {}) {
  const { classe = "", evalues, ...reste } = options;
  imprimerTableauxHonneur([{ classe, classement, evalues }], schoolInfo, reste);
}
