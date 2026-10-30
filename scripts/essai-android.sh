#!/bin/bash
# Essai de démarrage sur émulateur (.github/workflows/android.yml) : une compilation
# réussie ne prouve pas que l'application s'ouvre. Garde des captures d'écran et le
# journal dans essai/, et échoue si l'application plante.
PAQUET=com.edugest.app
API=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
mkdir -p essai

capture() { adb exec-out screencap -p > "essai/$1.png"; }
activite() { adb shell dumpsys activity activities | grep -E "ResumedActivity" | tee -a essai/activite.txt; }
bouton_autoriser() {
  adb shell uiautomator dump /sdcard/ecran.xml > /dev/null 2>&1
  adb pull /sdcard/ecran.xml essai/ecran.xml > /dev/null 2>&1
  tr '>' '\n' < essai/ecran.xml | grep permission_allow_button
}
journaux() {
  adb logcat -d > essai/journal.txt
  adb logcat -d -b crash > essai/plantages.txt
}
echec() {
  journaux
  echo "::error::$1"
  exit 1
}

# Chrome sans son écran d'accueil, comme sur un téléphone déjà utilisé.
adb shell am set-debug-app --persistent com.android.chrome
adb shell "echo '_ --disable-fre --no-default-browser-check --no-first-run' > /data/local/tmp/chrome-command-line"

adb install -r apk/*.apk || exit 1
adb logcat -c -b all || true

# Premier lancement. Android 13 et plus demande d'autoriser les notifications :
# Chrome doit attendre la réponse, même si l'écran est recréé entre-temps.
adb shell am start -W -n "$PAQUET/.LanceurActivity"
sleep 8
capture 1-ouverture
BOUTON=$(bouton_autoriser)
if [ "$API" -ge 33 ]; then
  [ -n "$BOUTON" ] || echec "La demande d'autorisation des notifications n'est pas à l'écran."
  adb shell cmd uimode night yes
  sleep 8
  capture 1-demande-apres-changement-de-theme
  BOUTON=$(bouton_autoriser)
  [ -n "$BOUTON" ] || echec "Chrome n'a pas attendu la réponse à la demande d'autorisation."
  read -r gauche haut droite bas <<< "$(echo "$BOUTON" | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')"
  adb shell input tap $(((gauche + droite) / 2)) $(((haut + bas) / 2))
  adb shell cmd uimode night no
fi
sleep 25
capture 2-premier-lancement
activite

# Second lancement : le chemin de tous les jours, sans demande d'autorisation.
adb shell am force-stop "$PAQUET"
adb shell am start -W -n "$PAQUET/.LanceurActivity"
sleep 20
capture 3-second-lancement
activite

journaux
if grep -q "Process: $PAQUET" essai/plantages.txt; then
  grep -A 40 "Process: $PAQUET" essai/plantages.txt | head -60
  echec "L'application plante au démarrage."
fi

# Sans plantage, l'écran doit encore être celui de Chrome, pas l'accueil du téléphone.
if [ ! -s essai/activite.txt ] || grep -qv "com.android.chrome" essai/activite.txt; then
  echec "L'application ne s'ouvre pas dans Chrome."
fi
