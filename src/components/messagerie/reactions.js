// ── Réactions à un message ──────────────────────────────────────────────────
// Portées par le message : { compteId : émoji }, une réaction par personne
// (colonne msg_messages.reactions, écrite par la RPC msg_reagir). La liste
// des émojis est aussi celle que la base accepte.
// Module sans dépendance, testé sous Node : tests/messagerie-reactions.test.js.

export const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "✅"];

// Mes réactions après un toucher : le même émoji la retire, un autre la change.
export function basculerReaction(reactions, moi, emoji) {
  const { [moi]: actuelle, ...autres } = reactions || {};
  if (!emoji || actuelle === emoji) return autres;
  return { ...autres, [moi]: emoji };
}

// Pour l'affichage sous la bulle : un jeton par émoji, dans l'ordre de la
// liste, avec le nombre et qui a réagi. Les émojis inconnus sont ignorés.
export function resumerReactions(reactions, moi) {
  const parEmoji = new Map();
  for (const [compte, emoji] of Object.entries(reactions || {})) {
    if (!REACTIONS.includes(emoji)) continue;
    if (!parEmoji.has(emoji)) parEmoji.set(emoji, []);
    parEmoji.get(emoji).push(compte);
  }
  return REACTIONS.filter((e) => parEmoji.has(e)).map((emoji) => {
    const comptes = parEmoji.get(emoji);
    return { emoji, nombre: comptes.length, deMoi: comptes.includes(moi), comptes };
  });
}
