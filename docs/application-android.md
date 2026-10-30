# Application Android d'EduGest

Une Trusted Web Activity : l'application ouvre le site dans Chrome, plein écran.
Impression, téléchargements, mode hors ligne et mises à jour restent ceux du site.
La couche native (`android/`) ajoute ce que le site ne peut pas faire seul : une
vraie sonnerie plein écran, application fermée et téléphone verrouillé.

## Fonctionnement d'un appel

1. Le client de l'appelant demande à l'Edge `push` de prévenir l'appelé.
2. Pour un appareil Android, `push` passe par Firebase (`fcm.ts`) : message de
   données, priorité haute, durée de vie de 60 s.
3. `MessagesFirebaseService` fait sonner le téléphone (`Appels.sonner`) et ouvre
   `AppelEntrantActivity` par-dessus l'écran verrouillé.
4. « Répondre » ouvre le site sur `?messagerie=…&repondre=<appel>` : le site
   décroche seul. « Refuser » arrête la sonnerie de ce téléphone seulement :
   l'appelant entend sonner jusqu'à « Pas de réponse ».
5. Si l'appelant renonce, `appelFin` arrête la sonnerie.

Le jeton Firebase arrive au site par le fragment de l'adresse de lancement, retenu
seulement si `document.referrer` est `android-app://com.edugest.app` : un lien
piégé ne peut pas abonner un compte à un autre appareil. L'abonnement est une
ligne `push_subs` ordinaire (`{ endpoint: "fcm:<jeton>", fcm: "<jeton>" }`).

## Mise en place (une fois)

Le projet Firebase est `citadelle-school`.

1. **Application Android** : console Firebase → Paramètres du projet → Ajouter une
   application → Android → nom de paquet `com.edugest.app`. Télécharger
   `google-services.json`, puis :
   `gh secret set GOOGLE_SERVICES_JSON < google-services.json`
2. **Compte de service** : Paramètres du projet → Comptes de service → Générer une
   nouvelle clé privée, puis, depuis le dépôt principal :
   `npx supabase@2.120.0 secrets set FCM_SERVICE_ACCOUNT="$(cat cle.json)"`
3. **Clé de signature** : à garder précieusement. Une clé perdue empêche toute mise
   à jour : il faudrait désinstaller l'application sur chaque téléphone.
   `keytool -genkeypair -v -keystore edugest.keystore -alias edugest -keyalg RSA -keysize 2048 -validity 10000`
   puis les secrets `ANDROID_KEYSTORE_BASE64` (fichier en base64),
   `ANDROID_KEYSTORE_PASSWORD` et `ANDROID_KEY_ALIAS` (`edugest`).
4. **Lien site ↔ application** : le workflow affiche l'empreinte SHA-256 de la clé.
   La reporter dans `public/.well-known/assetlinks.json` : sans ce fichier, Chrome
   affiche une barre d'adresse en haut de l'application.

## Publier une version

```bash
gh workflow run android.yml --ref master
```

L'APK signé rejoint les Releases :
`https://github.com/bahmoustapha657-cmd/citadelle/releases/latest/download/edugest.apk`

## Limites

- Le téléphone doit avoir Chrome et les services Google.
- Installation hors Play Store : Android demande d'autoriser la source.
- L'application n'est pas mise à jour toute seule ; le site, lui, oui.
- Certains Android (Tecno, Infinix, Xiaomi) tuent les applications en arrière-plan :
  autoriser EduGest dans l'économie de batterie.
