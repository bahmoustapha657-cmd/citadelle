plugins {
    id("com.android.application")
}

// Sans google-services.json (build de contrôle d'une PR), l'application se
// compile quand même : elle ne reçoit simplement pas les appels.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val keystore = file("edugest.keystore")

android {
    namespace = "com.edugest.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.edugest.app"
        minSdk = 24
        targetSdk = 36
        // La CI numérote chaque build : Android refuse une mise à jour qui
        // n'augmente pas ce numéro.
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = "1.0.$versionCode"
    }

    signingConfigs {
        if (keystore.exists()) {
            create("edugest") {
                storeFile = keystore
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sans clé (PR), signature de débogage : l'APK reste installable
            // pour un essai, mais ne pourrait pas être mis à jour.
            signingConfig = if (keystore.exists()) signingConfigs.getByName("edugest")
            else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
    implementation("com.google.firebase:firebase-messaging:26.0.1")
    implementation("androidx.core:core:1.19.1")
}
