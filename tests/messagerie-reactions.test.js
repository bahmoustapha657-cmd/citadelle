// Réactions à un message : une par personne, posée, changée ou retirée.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { REACTIONS, basculerReaction, resumerReactions } from "../src/components/messagerie/reactions.js";

test("toucher un émoji : poser, changer, retirer ma réaction", () => {
  assert.deepEqual(basculerReaction({}, "moi", "👍"), { moi: "👍" });
  assert.deepEqual(basculerReaction(undefined, "moi", "👍"), { moi: "👍" });
  assert.deepEqual(basculerReaction({ moi: "👍", a: "❤️" }, "moi", "❤️"), { a: "❤️", moi: "❤️" });
  // Le même émoji une seconde fois la retire ; celles des autres ne bougent pas.
  assert.deepEqual(basculerReaction({ moi: "👍", a: "❤️" }, "moi", "👍"), { a: "❤️" });
  assert.deepEqual(basculerReaction({ moi: "👍" }, "moi", null), {});
  const depart = { moi: "👍" };
  basculerReaction(depart, "moi", "❤️");
  assert.deepEqual(depart, { moi: "👍" }, "l'objet de départ n'est pas modifié");
});

test("sous la bulle : un jeton par émoji, compté, dans l'ordre de la liste", () => {
  const r = resumerReactions({ a: "✅", moi: "👍", b: "👍", c: "🤖" }, "moi");
  assert.deepEqual(r.map((x) => [x.emoji, x.nombre, x.deMoi]), [["👍", 2, true], ["✅", 1, false]]);
  assert.deepEqual(r[0].comptes.sort(), ["b", "moi"]);
  assert.deepEqual(resumerReactions(undefined, "moi"), []);
  assert.deepEqual(resumerReactions({}, "moi"), []);
});

test("la base accepte exactement les émojis proposés à l'écran", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_messagerie_reactions.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  const liste = sql.match(/p_emoji not in \(([^)]+)\)/)[1].split(",").map((e) => e.trim().replace(/'/g, ""));
  assert.deepEqual(liste, REACTIONS);
  assert.equal(new Set(REACTIONS).size, REACTIONS.length);
});

test("migration : réaction réservée aux membres, jamais prêtée à un autre", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_messagerie_reactions.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  assert.match(sql, /msg\.conversation_id not in \(select msg_mes_conversations\(\)\)/);
  // Seule MA clé est écrite, en une seule instruction.
  assert.match(sql, /reactions - moi::text/);
  assert.match(sql, /reactions \|\| jsonb_build_object\(moi::text, p_emoji\)/);
  // Un message envoyé avec des réactions préremplies les perd.
  assert.match(sql, /before insert on public\.msg_messages/);
  assert.match(sql, /new\.reactions := '\{\}'::jsonb;/);
  assert.match(sql, /msg\.supprime or msg\.type not in \('texte', 'audio', 'fichier'\)/);
  assert.match(sql, /revoke all on function public\.msg_reagir\(uuid, text\) from public, anon/);
});

test("écran : réaction affichée tout de suite, retirée si la base la refuse", () => {
  const etat = readFileSync("src/components/messagerie/use-messagerie-etat.js", "utf8");
  assert.match(etat, /reactions: basculerReaction\(avant, moi, emoji\)/);
  assert.match(etat, /reactions: avant \}\);/);
  const bulle = readFileSync("src/components/messagerie/BulleMessage.jsx", "utf8");
  assert.match(bulle, /message\.supprime \|\| provisoire \? \[\] : resumerReactions\(message\.reactions, moi\)/);
  assert.match(bulle, /REACTIONS\.map\(\(emoji\) =>/);
});
