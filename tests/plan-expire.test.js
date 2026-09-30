import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlanInfo } from "../src/components/app/app-shell-plan.js";

const JOUR = 86400000;
const MAINTENANT = 1_800_000_000_000;
const t = (_cle, repli) => repli;
const info = (plan, planExpiry) =>
  computePlanInfo({ schoolInfoState: { plan, planExpiry }, nowTs: MAINTENANT, totalElevesActifs: 10, t });

test("plan payant échu depuis plus de 3 jours = expiré", () => {
  const p = info("premium", MAINTENANT - 4 * JOUR);
  assert.equal(p.planEstExpire, true);
  assert.equal(p.enPeriodeGrace, false);
  assert.equal(p.eleveLimit, 50);
});

test("pendant la grâce, pas encore expiré", () => {
  const p = info("premium", MAINTENANT - 2 * JOUR);
  assert.equal(p.planEstExpire, false);
  assert.equal(p.enPeriodeGrace, true);
});

test("échéance reçue en chaîne : la grâce finit quand même", () => {
  // `"1799…" + GRACE` concaténait : la grâce ne finissait jamais.
  const p = info("premium", String(MAINTENANT - 4 * JOUR));
  assert.equal(p.planEstExpire, true);
});

test("gratuit et premium sans échéance n'expirent jamais", () => {
  assert.ok(!info("gratuit", MAINTENANT - 100 * JOUR).planEstExpire);
  assert.ok(!info("premium", null).planEstExpire);
});
