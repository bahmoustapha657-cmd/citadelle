package com.edugest.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

/** Écran d'appel : par-dessus le verrouillage, le temps de la sonnerie. */
public class AppelEntrantActivity extends Activity {
    private final Handler minuteur = new Handler(Looper.getMainLooper());
    private final Runnable fin = this::finish;
    private final BroadcastReceiver surFin = new BroadcastReceiver() {
        @Override
        public void onReceive(Context contexte, Intent intent) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        setContentView(R.layout.activity_appel_entrant);
        ((TextView) findViewById(R.id.nom_appelant)).setText(getIntent().getStringExtra(Appels.EXTRA_NOM));
        findViewById(R.id.bouton_refuser).setOnClickListener(vue -> Appels.arreter(this));
        findViewById(R.id.bouton_repondre).setOnClickListener(vue -> repondre());
        ContextCompat.registerReceiver(this, surFin, new IntentFilter(Appels.ACTION_FIN),
                ContextCompat.RECEIVER_NOT_EXPORTED);
        minuteur.postDelayed(fin, Appels.DUREE_SONNERIE_MS);
    }

    private void repondre() {
        KeyguardManager verrou = getSystemService(KeyguardManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && verrou.isKeyguardLocked()) {
            verrou.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    ouvrirApplication();
                }
            });
        } else {
            ouvrirApplication();
        }
    }

    private void ouvrirApplication() {
        String url = getIntent().getStringExtra(Appels.EXTRA_URL);
        startActivity(Appels.ouvrirApplication(this, url));
        Appels.arreter(this);
    }

    @Override
    protected void onDestroy() {
        minuteur.removeCallbacks(fin);
        unregisterReceiver(surFin);
        super.onDestroy();
    }
}
