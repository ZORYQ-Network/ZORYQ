plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "network.zoryq.games.demo"
    compileSdk = 35

    defaultConfig {
        // Keep the Kotlin namespace stable, but use a dedicated install identity
        // so Rush Premium can coexist with earlier ZORYQ Games debug builds.
        applicationId = "network.zoryq.games.rush"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":runtime"))
}
