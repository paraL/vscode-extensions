# ai-helper

IntelliJ IDEA plugin with one editor context-menu action: `Copy File Line(s)`.

The copied text matches the `arthas-helper` VS Code extension format:

- Single line: `/absolute/path/File.java L12`
- Line range: `/absolute/path/File.java L12~L20`

## Build

Build with Gradle. The IntelliJ Platform SDK and Java runtime are resolved from the local IDEA installation configured in `gradle.properties`:

```properties
localIdePath=/Applications/IntelliJ IDEA.app
org.gradle.java.home=/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home
```

```bash
export GRADLE_USER_HOME=/Users/ls/Developer/EnvData/gradle_repo
gradle buildPlugin
```

The plugin archive is generated under `build/distributions/`.
