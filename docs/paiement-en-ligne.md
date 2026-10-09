# Paiement en ligne de la scolarité (Mobile Money)

Les parents paient depuis leur portail, avec Orange Money ou MTN MoMo :

- l'argent arrive sur le **compte marchand de l'école** (EduGest ne détient jamais de fonds) ;
- le paiement s'enregistre **automatiquement** sur la fiche de l'élève et au journal de caisse, avec les règles de la caisse ;
- les frais de l'opérateur sont **payés par le parent**, au taux choisi par l'école.

## Parcours

1. **Parent.** Portail → Mensualités → **Payer en ligne**. Il choisit ce qu'il paie et voit les frais.
2. **Page de l'opérateur.** Le parent y passe et valide sur son téléphone.
3. **Retour dans le portail.** L'écran attend la confirmation.
4. **Serveur.** Il **vérifie le paiement auprès de l'opérateur**, au retour du parent et à chaque notification. Il l'impute ensuite en une seule transaction.
5. **Comptable.** Comptabilité → **💳 En ligne** : tous les paiements, avec mise en évidence de ceux « à vérifier ».

Un paiement passe **« à vérifier »** au lieu d'être imputé quand :

- l'année scolaire a changé ;
- la caisse a déjà encaissé la même chose ;
- le montant reçu diffère.

Le comptable l'affecte alors à la main (Mensualités → Encaisser) ou rembourse le parent.

## Mise en route d'une école (direction)

1. **Ouvrir un compte marchand.** Sur [cinetpay.com](https://cinetpay.com), avec le pays Guinée. Le compte est **au nom de l'école**.
2. **Copier les identifiants.** Dans l'espace marchand, rubrique API, copier la **clé API** et le **mot de passe API** :
   - `sk_test_…` pour le bac à sable ;
   - `sk_live_…` pour la production.
3. **Saisir les réglages dans EduGest.** Paramètres → **Paiement en ligne** :
   - opérateur **CinetPay** ;
   - mode **Test** d'abord ;
   - frais à la charge du parent (%) ;
   - clé et mot de passe API ;
   - cocher **Activer**.
4. **Enregistrer.** Les identifiants sont **essayés auprès de CinetPay** avant d'être enregistrés : une erreur de saisie s'affiche tout de suite. Ils ne repartent jamais vers le navigateur : seule une forme masquée est affichée (`sk_test_…1234`).
5. **Essayer.** Faire un paiement depuis un compte parent de test, puis vérifier la fiche, le journal et l'onglet « 💳 En ligne ».
6. **Passer en production.** Mode **Production** avec la clé `sk_live_…`. Une clé de test en production est refusée.

Réglage réservé au compte **direction**. Le serveur refuse tous les autres comptes.

## CinetPay

L'intégration repose sur l'API CinetPay v1, celle des SDK officiels `cinetpay-python` et `cinetpay-js`.

| | Bac à sable | Production |
|---|---|---|
| Hôte | `https://api.cinetpay.net` | `https://api.cinetpay.co` |
| Clé | `sk_test_…` | `sk_live_…` |

- **Connexion :** `POST /v1/oauth/login` avec `{api_key, api_password}` renvoie un jeton (gardé en mémoire de la fonction).
- **Création :** `POST /v1/payment` avec la devise GNF, le montant total et `channel: PUSH`. Le parent choisit Orange Money (OM_GN) ou MTN MoMo (MTN_GN) sur la page CinetPay.
- **Vérification :** `GET /v1/payment/{référence}`. `SUCCESS` → imputé ; `FAILED`, `EXPIRED`… → non abouti ; sinon on attend.
- **Retour du parent :** `…/functions/v1/paiement-notification?retour=<référence>` accepte GET et POST, puis redirige (303) vers `APP_URL/?paiement=<référence>`. Une redirection en POST vers le site statique serait refusée.
- **Notification :** envoyée à `…/functions/v1/paiement-notification?fournisseur=cinetpay`. Le `notify_token` reçu doit être celui remis à la création, puis le paiement est revérifié.
- **Bornes :** 100 à **2 500 000 par paiement**, frais compris. Au-delà, le parent paie en plusieurs fois (le portail le lui dit et plafonne le montant proposé).

## Déploiement

- La migration `paiement_en_ligne` est appliquée par la CI au déploiement.
- Les deux fonctions sont à déployer à la main :

```bash
supabase functions deploy paiement
```

```bash
supabase functions deploy paiement-notification --no-verify-jwt
```

Variables d'environnement facultatives des fonctions :

- `APP_URL` : adresse de l'app, par défaut `https://edugest-gn.pages.dev` ;
- `FONCTIONS_URL_PUBLIQUE` : adresse publique des fonctions, pour les notifications.

**Ne jamais** poser `PAIEMENT_SIMULATION` en production. Cette variable autorise le fournisseur « simulation », qui confirme un paiement sans argent. Seule la CI la pose, sur sa pile locale.

## Tests

- **Unitaires :**
  - `tests/paiement-en-ligne.test.js` : règles, plan d'imputation ;
  - `tests/paiement-cinetpay.test.js` : API CinetPay simulée, configuration, plafond.
- **Bout en bout :** `e2e/tests/paiement-en-ligne.spec.js`, avec le fournisseur « simulation » :
  - la direction active le paiement à l'écran ;
  - le parent paie, puis rejoue la confirmation, puis subit un refus ;
  - le serveur refuse les montants interdits ;
  - le comptable retrouve le paiement.
