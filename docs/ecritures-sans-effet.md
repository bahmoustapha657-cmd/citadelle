# Écritures sans effet : jamais en silence

## Le piège

Supabase (PostgREST) **ne lève aucune erreur** quand la sécurité par ligne
(RLS) refuse une modification ou une suppression : la requête « réussit » et
touche **0 ligne**. Même chose si la fiche a été supprimée entre-temps sur un
autre appareil. L'écran annonçait « enregistré », rien ne l'était.

## Les règles

1. **Modifier / supprimer** : toujours demander le nombre de lignes
   (`{ count: "exact" }`) et passer le résultat à `exigerEffet` (en ligne) ou
   `verifierEffet` (connecteur PowerSync) — `src/backend/ecritures-refusees.js`.
   0 ligne = `EcritureSansEffet`.
2. **Fiche école (`ecoles.extra`)** : jamais de lecture puis réécriture du
   jsonb entier depuis le navigateur. Passer par `fusionnerExtraEcole`
   (RPC `fusionner_extra_ecole`, fusion atomique en base) — deux écritures
   proches s'écrasaient.
3. **Opérations de masse** (clôture, promotion, passage des admis, reprises) :
   lire **et** écrire sur le serveur (`reseau: true`), jamais dans le miroir
   PowerSync, qui peut être incomplet sur un appareil pas encore synchronisé.
   Une lecture ratée arrête l'opération.

## Ce que voit l'utilisateur

Un avertissement (10 s) : « ⚠️ Une modification n'a pas été enregistrée :
refus du serveur — droits insuffisants ou fiche supprimée entre-temps… ».
Hors ligne, au retour du réseau, il précise « faite(s) hors ligne,
refusée(s) ». Plusieurs refus arrivés ensemble donnent un seul message.

Pour le support : les 50 derniers refus sont gardés sur l'appareil
(console du navigateur → `localStorage.getItem("LC_ecritures_refusees")`),
et remontés à Sentry s'il est activé.

## Les incidents à l'origine

- Journal muet du comptable, livrets hors ligne, section perdue : refus RLS
  silencieux (2026-09).
- 2026-10-08, tests e2e de fin d'année :
  - la création des postes par défaut effaçait l'année et le repère posés
    par une clôture (fiche école réécrite en entier) ;
  - en mode hors ligne, la clôture archivait « 0 fiche sur 0 » sur un miroir
    pas encore synchronisé, tout en passant l'école à l'année suivante.
