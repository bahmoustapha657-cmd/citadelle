package com.edugest.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import java.util.Map;

/**
 * Sonnerie d'un appel reçu application fermée : notification insistante, qui
 * répète la sonnerie du téléphone et ouvre {@link AppelEntrantActivity} par-dessus
 * l'écran verrouillé.
 */
final class Appels {
    static final String ACTION_FIN = "com.edugest.app.APPEL_FIN";
    static final String EXTRA_NOM = "nom";
    static final String EXTRA_URL = "url";
    static final long DUREE_SONNERIE_MS = 60000;

    private static final String CANAL_APPELS = "appels-entrants";
    private static final String CANAL_NOTIFICATIONS = "messages-informations";
    private static final int ID_APPEL = 1001;
    private static final String PREFERENCES = "edugest";
    private static final String CLE_JETON = "jeton-fcm";
    private static final String CLE_DEMANDE = "notifications-demandees";

    private Appels() {}

    static void creerCanaux(Context contexte) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager gestion = contexte.getSystemService(NotificationManager.class);
        NotificationChannel appels = new NotificationChannel(CANAL_APPELS,
                contexte.getString(R.string.canal_appels), NotificationManager.IMPORTANCE_HIGH);
        appels.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        appels.enableVibration(true);
        appels.setVibrationPattern(new long[] {0, 800, 500, 800, 500});
        appels.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        gestion.createNotificationChannel(appels);
        gestion.createNotificationChannel(new NotificationChannel(CANAL_NOTIFICATIONS,
                contexte.getString(R.string.canal_notifications), NotificationManager.IMPORTANCE_DEFAULT));
    }

    static void sonner(Context contexte, Map<String, String> donnees) {
        creerCanaux(contexte);
        String nom = donnees.get("nom");
        if (nom == null || nom.isEmpty()) nom = contexte.getString(R.string.appel_inconnu);
        String url = donnees.get("url");
        if (url == null || url.isEmpty()) url = contexte.getString(R.string.url_site);

        Intent ecran = new Intent(contexte, AppelEntrantActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(EXTRA_NOM, nom)
                .putExtra(EXTRA_URL, url);
        Intent refus = new Intent(contexte, RefusAppelReceiver.class);

        NotificationCompat.Builder notification = new NotificationCompat.Builder(contexte, CANAL_APPELS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(nom)
                .setContentText(contexte.getString(R.string.appel_entrant))
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(true)
                .setTimeoutAfter(DUREE_SONNERIE_MS)
                .setContentIntent(activite(contexte, 1, ecran))
                .setFullScreenIntent(activite(contexte, 2, ecran), true)
                .addAction(0, contexte.getString(R.string.refuser),
                        PendingIntent.getBroadcast(contexte, 3, refus, drapeaux()))
                .addAction(0, contexte.getString(R.string.repondre),
                        activite(contexte, 4, ouvrirApplication(contexte, url)));

        Notification construite = notification.build();
        construite.flags |= Notification.FLAG_INSISTENT; // la sonnerie se répète
        contexte.getSystemService(NotificationManager.class).notify(ID_APPEL, construite);
    }

    /** Fin de la sonnerie : notification retirée, écran d'appel refermé. */
    static void arreter(Context contexte) {
        contexte.getSystemService(NotificationManager.class).cancel(ID_APPEL);
        contexte.sendBroadcast(new Intent(ACTION_FIN).setPackage(contexte.getPackageName()));
    }

    static void afficherNotification(Context contexte, Map<String, String> donnees) {
        creerCanaux(contexte);
        String url = donnees.get("url");
        if (url == null || url.isEmpty()) url = contexte.getString(R.string.url_site);
        Notification notification = new NotificationCompat.Builder(contexte, CANAL_NOTIFICATIONS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(donnees.get("titre"))
                .setContentText(donnees.get("corps"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(donnees.get("corps")))
                .setAutoCancel(true)
                .setContentIntent(activite(contexte, url.hashCode(), ouvrirApplication(contexte, url)))
                .build();
        contexte.getSystemService(NotificationManager.class).notify(url.hashCode(), notification);
    }

    static Intent ouvrirApplication(Context contexte, String url) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse(url), contexte, LanceurActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    static void memoriserJeton(Context contexte, String jeton) {
        preferences(contexte).edit().putString(CLE_JETON, jeton).apply();
    }

    static String jeton(Context contexte) {
        return preferences(contexte).getString(CLE_JETON, null);
    }

    /** Android 13 et plus : la demande n'est faite qu'une fois. */
    static boolean premiereDemandeNotifications(Context contexte) {
        SharedPreferences preferences = preferences(contexte);
        if (preferences.getBoolean(CLE_DEMANDE, false)) return false;
        preferences.edit().putBoolean(CLE_DEMANDE, true).apply();
        return true;
    }

    private static SharedPreferences preferences(Context contexte) {
        return contexte.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private static PendingIntent activite(Context contexte, int numero, Intent intent) {
        return PendingIntent.getActivity(contexte, numero, intent, drapeaux());
    }

    private static int drapeaux() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }
}
