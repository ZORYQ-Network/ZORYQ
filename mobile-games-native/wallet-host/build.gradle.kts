plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "network.zoryq.wallet.migration"
    compileSdk = 35

    defaultConfig {
        applicationId = "network.zoryq.wallet.migration"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0-watch-only"
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
    testImplementation("junit:junit:4.13.2")
}
