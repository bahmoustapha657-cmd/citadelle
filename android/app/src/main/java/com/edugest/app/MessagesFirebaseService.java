package com.edugest.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/** Reçoit ce qu'envoie l'Edge Function `push`, application fermée comprise. */
public class MessagesFirebaseService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String jeton) {
        Appels.memoriserJeton(this, jeton);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> donnees = message.getData();
        String type = donnees.get("type");
        if ("appel".equals(type)) {
            Appels.sonner(this, donnees);
        } else if ("appel-fin".equals(type)) {
            Appels.arreter(this);
        } else {
            Appels.afficherNotification(this, donnees);
        }
    }
}
