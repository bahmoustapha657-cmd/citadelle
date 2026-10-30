package com.edugest.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Ouvre EduGest dans Chrome, après avoir préparé ce que le site ne peut pas
 * faire seul : l'autorisation des notifications (Android 13 et plus, une fois)
 * et le jeton Firebase, remis au site dans le fragment de l'adresse, qui
 * n'est jamais envoyé au serveur.
 */
public class LanceurActivity extends LauncherActivity {
    private static final int DEMANDE_NOTIFICATIONS = 1;
    private static final long DELAI_JETON_MS = 4000;
    private static final String CLE_EN_ATTENTE = "reponse-en-attente";

    private boolean lancee;
    private boolean enAttente;

    @Override
    protected boolean shouldLaunchImmediately() {
        return false;
    }

    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        if (isFinishing()) return;
        Appels.creerCanaux(this);
        Log.i("EduGest", "onCreate etat=" + (etat != null));
        // Recréée pendant la demande (rotation, thème) : la réponse arrivera ici,
        // Chrome ne doit pas passer devant la fenêtre d'autorisation.
        enAttente = etat != null && etat.getBoolean(CLE_EN_ATTENTE);
        if (enAttente) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && Appels.premiereDemandeNotifications(this)) {
            enAttente = true;
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, DEMANDE_NOTIFICATIONS);
        } else {
            preparerJeton();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle etat) {
        super.onSaveInstanceState(etat);
        etat.putBoolean(CLE_EN_ATTENTE, enAttente);
    }

    @Override
    public void onRequestPermissionsResult(int demande, @NonNull String[] permissions, @NonNull int[] resultats) {
        super.onRequestPermissionsResult(demande, permissions, resultats);
        Log.i("EduGest", "reponse demande=" + demande + " nb=" + resultats.length);
        if (demande != DEMANDE_NOTIFICATIONS) return;
        enAttente = false;
        preparerJeton();
    }

    private void preparerJeton() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            lancer();
            return;
        }
        // Réseau faible : on n'attend pas le jeton plus de quelques secondes.
        new Handler(Looper.getMainLooper()).postDelayed(this::lancer, DELAI_JETON_MS);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(tache -> {
            if (tache.isSuccessful()) Appels.memoriserJeton(this, tache.getResult());
            lancer();
        });
    }

    private void lancer() {
        if (lancee) return;
        lancee = true;
        launchTwa();
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri url = super.getLaunchingUrl();
        String jeton = Appels.jeton(this);
        if (jeton == null) return url;
        return url.buildUpon().encodedFragment("fcm=" + Uri.encode(jeton)).build();
    }
}
