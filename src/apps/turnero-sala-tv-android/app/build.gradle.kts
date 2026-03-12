plugins {
    id("com.android.application")
    kotlin("android")
}

val turneroVersionName =
    providers.gradleProperty("turneroVersionName").orElse("0.1.0")
val turneroVersionCode =
    providers.gradleProperty("turneroVersionCode").orElse("1")
val turneroBaseUrl =
    providers.gradleProperty("turneroBaseUrl").orElse("https://pielarmonia.com")
val turneroSurfacePath =
    providers.gradleProperty("turneroSurfacePath").orElse("/sala-turnos.html")

android {
    namespace = "com.pielarmonia.turnerosalatv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pielarmonia.turnerosalatv"
        minSdk = 28
        targetSdk = 35
        versionCode = turneroVersionCode.get().toInt()
        versionName = turneroVersionName.get()
        buildConfigField("String", "TURNERO_BASE_URL", "\"${turneroBaseUrl.get()}\"")
        buildConfigField("String", "TURNERO_SURFACE_PATH", "\"${turneroSurfacePath.get()}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
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
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
