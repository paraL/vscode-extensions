plugins {
    id("java")
    id("org.jetbrains.intellij.platform") version "2.14.0"
}

group = "com.github.ls"
version = "0.0.1"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        local(providers.gradleProperty("localIdePath").get())
    }
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "253"
        }
    }
}
