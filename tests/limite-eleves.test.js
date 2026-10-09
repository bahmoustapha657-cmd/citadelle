// Limite d'élèves du plan : le compteur d'élèves actifs (suivreCompteur, tenu
// à jour à chaque changement de la table eleves) et la règle de blocage
// (computePlanInfo). Sur Supabase, le compteur restait à 0 : la limite du plan
// gratuit n'était plus appliquée — une école gratuite à 432 élèves pouvait
// toujours inscrire.
//
// Le branchement réel (comptage Supabase / miroir PowerSync, surveillance de
// la table) est couvert par compteur-eleves-supabase.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { suivreCompteur } from "../src/hooks/suivre-compteur.js";
import { computePlanInfo } from "../src/components/app/app-shell-plan.js";

// Laisse aboutir les comptages asynchrones en attente.
const vider = () => new Promise((resoudre) => setImmediate(resoudre));

// Comptage piloté par le test : chaque appel renvoie une promesse que le test
// résout (ou rejette) quand il veut — c'est ce qui permet de rejouer des
// réponses dans le désordre.
function monter(t, delaiMs = 600) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const appels = [];
  const publiees = [];
  let signaler = null;
  let detache = 0;
  const arreter = suivreCompteur({
    compter: () => new Promise((resolve, reject) => appels.push({ resolve, reject })),
    surveiller: (fn) => { signaler = fn; return () => { detache++; }; },
    onValeur: (v) => publiees.push(v),
    delaiMs,
  });
  return {
    appels, publiees, arreter,
    signaler: () => signaler(),
    detache: () => detache,
    tick: (ms) => t.mock.timers.tick(ms),
  };
}

test("compteur : compté dès le montage, sans attendre de changement", async (t) => {
  const c = monter(t);
  assert.equal(c.appels.length, 1);
  c.appels[0].resolve(432);
  await vider();
  assert.deepEqual(c.publiees, [432]);
});

test("compteur : un changement relance le comptage, une rafale n'en relance qu'un", async (t) => {
  const c = monter(t);
  c.appels[0].resolve(10);
  await vider();

  // Import Excel : cinq élèves d'affilée → un seul recomptage.
  for (let i = 0; i < 5; i++) c.signaler();
  c.tick(599);
  assert.equal(c.appels.length, 1, "rien avant la fin de la fenêtre");
  c.tick(1);
  assert.equal(c.appels.length, 2);
  c.appels[1].resolve(15);
  await vider();
  assert.deepEqual(c.publiees, [10, 15]);

  // Départ d'un élève, plus tard : nouveau recomptage.
  c.signaler();
  c.tick(600);
  c.appels[2].resolve(14);
  await vider();
  assert.deepEqual(c.publiees, [10, 15, 14]);
});

test("compteur : un changement pendant un comptage en vol est recompté après, réponses dans le désordre", async (t) => {
  const c = monter(t);
  c.appels[0].resolve(49);
  await vider();

  c.signaler();
  c.tick(600);
  assert.equal(c.appels.length, 2, "comptage n°2 en vol");
  c.signaler(); // l'élève suivant arrive pendant le comptage n°2
  c.tick(600);
  assert.equal(c.appels.length, 3, "le changement tardif a son propre comptage");

  // Le n°3 (plus récent) répond d'abord, le n°2 ensuite : sa valeur périmée
  // ne doit pas écraser la bonne.
  c.appels[2].resolve(51);
  await vider();
  c.appels[1].resolve(50);
  await vider();
  assert.deepEqual(c.publiees, [49, 51]);
});

test("compteur : un comptage en échec ou illisible garde la dernière valeur connue", async (t) => {
  const c = monter(t);
  c.appels[0].resolve(40);
  await vider();

  c.signaler();
  c.tick(600);
  c.appels[1].reject(new Error("réseau coupé"));
  await vider();
  c.signaler();
  c.tick(600);
  c.appels[2].resolve(null);
  await vider();
  assert.deepEqual(c.publiees, [40], "ni erreur ni null ne remplacent 40");

  c.signaler();
  c.tick(600);
  c.appels[3].resolve(41);
  await vider();
  assert.deepEqual(c.publiees, [40, 41]);
});

test("compteur : l'arrêt détache la surveillance et ne publie plus rien", async (t) => {
  const c = monter(t);
  c.signaler(); // recomptage programmé…
  c.arreter(); // …puis démontage (déconnexion, changement d'école)
  assert.equal(c.detache(), 1);
  c.tick(600);
  assert.equal(c.appels.length, 1, "le recomptage programmé est annulé");
  c.appels[0].resolve(12); // réponse arrivée après l'arrêt
  await vider();
  assert.deepEqual(c.publiees, []);
  c.signaler(); // signal tardif de la surveillance
  c.tick(600);
  assert.equal(c.appels.length, 1);
});

// ── Règle de blocage ────────────────────────────────────────────────────────
const JOUR = 86400000;
const MAINTENANT = 1_800_000_000_000;
const traduire = (_cle, defaut) => defaut;
const plan = (schoolInfoState, totalElevesActifs) =>
  computePlanInfo({ schoolInfoState, nowTs: MAINTENANT, totalElevesActifs, t: traduire });

test("plan gratuit : l'ajout se ferme à 50 élèves actifs", () => {
  assert.equal(plan({ plan: "gratuit" }, 49).peutAjouterEleve, true);
  assert.equal(plan({ plan: "gratuit" }, 50).peutAjouterEleve, false, "limite atteinte = bloqué");
  const grosseEcole = plan({ plan: "gratuit" }, 432);
  assert.equal(grosseEcole.peutAjouterEleve, false);
  assert.equal(grosseEcole.totalElevesActifs, 432);
  assert.equal(grosseEcole.eleveLimit, 50);
  assert.equal(plan({}, 60).peutAjouterEleve, false, "sans plan = gratuit");
});

test("plans payants : limite du plan, illimité en premium", () => {
  const expiry = MAINTENANT + 100 * JOUR;
  assert.equal(plan({ plan: "starter", planExpiry: expiry }, 199).peutAjouterEleve, true);
  assert.equal(plan({ plan: "starter", planExpiry: expiry }, 200).peutAjouterEleve, false);
  assert.equal(plan({ plan: "standard", planExpiry: expiry }, 432).peutAjouterEleve, true);
  assert.equal(plan({ plan: "standard", planExpiry: expiry }, 500).peutAjouterEleve, false);
  assert.equal(plan({ plan: "premium", planExpiry: expiry }, 5000).peutAjouterEleve, true);
});

test("plan échu : limite du plan pendant la grâce, puis retour à 50", () => {
  const enGrace = plan({ plan: "starter", planExpiry: MAINTENANT - 2 * JOUR }, 120);
  assert.equal(enGrace.eleveLimit, 200);
  assert.equal(enGrace.peutAjouterEleve, true);
  const expire = plan({ plan: "starter", planExpiry: MAINTENANT - 4 * JOUR }, 120);
  assert.equal(expire.eleveLimit, 50);
  assert.equal(expire.peutAjouterEleve, false);
});

test("effectif pas encore compté : rien n'est bloqué, et il n'est pas affiché comme 0", () => {
  for (const inconnu of [null, undefined, Number.NaN]) {
    const info = plan({ plan: "gratuit" }, inconnu);
    assert.equal(info.peutAjouterEleve, true, String(inconnu));
    assert.equal(info.totalElevesActifs, null, String(inconnu));
  }
  assert.equal(plan({ plan: "gratuit" }, 0).totalElevesActifs, 0, "0 compté reste 0");
});
