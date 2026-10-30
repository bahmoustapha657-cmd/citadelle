#!/bin/bash
# Essai de démarrage sur émulateur (.github/workflows/android.yml) : une compilation
# réussie ne prouve pas que l'application s'ouvre. Garde des captures d'écran et le
# journal dans essai/, et échoue si l'application plante.
PAQUET=com.edugest.app
mkdir -p essai

capture() { adb exec-out screencap -p > "essai/$1.png"; }
activite() { adb shell dumpsys activity activities | grep -E "ResumedActivity" | tee -a essai/activite.txt; }

adb install -r apk/*.apk || exit 1
adb logcat -c -b all || true

# Premier lancement. Android 13 et plus demande d'autoriser les notifications.
adb shell am start -W -n "$PAQUET/.LanceurActivity"
sleep 8
capture 1-ouverture
adb shell uiautomator dump /sdcard/ecran.xml > /dev/null 2>&1
adb pull /sdcard/ecran.xml essai/ecran.xml > /dev/null 2>&1
BOUTON=$(tr '>' '\n' < essai/ecran.xml | grep permission_allow_button)
if [ -n "$BOUTON" ]; then
  read -r gauche haut droite bas <<< "$(echo "$BOUTON" | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')"
  adb shell input tap $(((gauche + droite) / 2)) $(((haut + bas) / 2))
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

adb logcat -d > essai/journal.txt
adb logcat -d -b crash > essai/plantages.txt
if grep -q "Process: $PAQUET" essai/plantages.txt; then
  echo "::error::L'application plante au démarrage."
  grep -A 40 "Process: $PAQUET" essai/plantages.txt | head -60
  exit 1
fi
