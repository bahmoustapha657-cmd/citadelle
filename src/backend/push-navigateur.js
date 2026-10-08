// ── Abonnement push de CE navigateur, retiré à la déconnexion ────────────────
// Module sans dépendance (client Supabase et navigator passés en paramètres)
// pour être testé sous Node : tests/push-navigateur.test.js.
//
// Un navigateur n'a qu'une adresse d'abonnement, quel que soit le compte
// connecté. Sur un appareil partagé, le compte qui s'en va ne doit plus y
// recevoir ses notifications : on retire SA ligne portant l'adresse de ce
// navigateur (pas ses autres lignes : il peut être abonné sur un autre
// appareil), puis le navigateur se désabonne. Hors ligne, la suppression
// échoue mais le désabonnement suffit : l'adresse meurt, et l'Edge push
// purge la ligne au premier envoi (404/410). La base, elle, ne garde qu'un
// abonné par adresse (push-subs-navigateur.sql).
export async function retirerAbonnementNavigateur({ sb, navigateur }) {
  if (!navigateur || !("serviceWorker" in navigateur)) return;
  const reg = await navigateur.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (!sub) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      await sb.from("push_subs").delete()
        .eq("user_id", session.user.id).eq("subscription->>endpoint", sub.endpoint);
    }
  } finally {
    await sub.unsubscribe();
  }
}
