plugins {
    kotlin("jvm") version "2.2.20"
}

group = "app.notifyme"
version = "1.0"

repositories { mavenCentral() }

dependencies {
    testImplementation(kotlin("test-junit"))
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
