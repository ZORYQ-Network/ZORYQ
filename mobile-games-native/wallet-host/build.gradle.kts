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
        versionCode = 3
        versionName = "0.3.0-secure-testnet"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/INDEX.LIST",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/io.netty.versions.properties"
            )
        }
    }
}

dependencies {
    implementation(project(":runtime"))
    implementation("org.web3j:crypto:4.14.0")
    testImplementation("junit:junit:4.13.2")
}
