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

### Ou : Orange Money Guinée en direct

L'argent arrive **directement sur le compte marchand Orange Money de l'école**, sans intermédiaire qui le détienne. En contrepartie, c'est Orange Money seulement, pas MTN.

1. **Compte marchand Orange Money** au nom de l'école, à ouvrir en agence Orange (vérification « KYA » : immatriculation, pièce du responsable…).
2. **Abonnement « Orange Money Web Payment ».** Il se demande sur [developer.orange.com](https://developer.orange.com/apis/om-webpay) ou auprès d'Orange Guinée. Il donne :
   - le **Client ID** et le **Client Secret** de l'application ;
   - la **clé marchand** (merchant key) du compte.
3. **Saisir dans EduGest.** Paramètres → **Paiement en ligne** :
   - opérateur **Orange Money (direct)** ;
   - mode **Test** d'abord : bac à sable Orange, chemin `dev`, monnaie `OUV` ;
   - les trois identifiants ;
   - **Activer**.
   Le Client ID et le Client Secret sont essayés auprès d'Orange avant l'enregistrement.
4. **Passer en production.** Mode **Production** : chemin `gn`, monnaie GNF.

## Orange Money Guinée (direct)

L'API utilisée est « Orange Money Web Payment », sur `https://api.orange.com`. Le contrat a été recoupé à partir des SDK et intégrations publiques, puis d'un retour de paiement réel. Le chemin de production `gn` est **à confirmer avec Orange Guinée** lors de l'ouverture.

- **Connexion :** `POST /oauth/v3/token`, en-tête `Authorization: Basic base64(client_id:client_secret)`, corps `grant_type=client_credentials`. Le jeton est gardé en mémoire pendant `expires_in`.
- **Création :** `POST /orange-money-webpay/{dev|gn}/v1/webpayment` avec :
  - `merchant_key`, `currency` (`OUV` en test, `GNF` en production), `order_id` (la référence EduGest) et `amount` ;
  - `return_url` et `cancel_url`, qui passent toutes deux par le retour serveur ;
  - `notif_url` avec `&ref=<référence>` ;
  - `lang` et `reference` (30 caractères au plus).

  La réponse donne `pay_token`, `payment_url` et `notif_token`. Ce dernier est **généré par Orange** et gardé dans le paiement.
- **Vérification :** `POST …/transactionstatus` avec `{order_id, amount, pay_token}`, où `amount` est le montant envoyé à la création :
  - `SUCCESS` → imputé ;
  - `FAILED` ou `EXPIRED` → non abouti ;
  - `INITIATED` ou `PENDING` → on attend.
- **Notification :** le corps vaut `{status, notif_token, txnid}`, **sans référence ni montant**. La référence est donc lue dans l'adresse (`&ref=`). Le `notif_token` doit être celui rendu à la création, puis le paiement est **revérifié** auprès d'Orange.
- **Parcours du parent :** sur la page Orange, il compose le code USSD Orange Money pour obtenir un code à usage unique, puis le saisit.

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
