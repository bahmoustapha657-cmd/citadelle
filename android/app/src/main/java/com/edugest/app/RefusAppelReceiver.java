package com.edugest.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** « Refuser » depuis la notification : le téléphone cesse de sonner. */
public class RefusAppelReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexte, Intent intent) {
        Appels.arreter(contexte);
    }
}
