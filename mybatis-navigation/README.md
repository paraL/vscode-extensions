# MyBatis Lite Navigation

A lightweight, zero-configuration VS Code extension for bidirectional navigation between MyBatis Mapper Interfaces and XML Mapper files.

## Features

- **Java to XML**: Ctrl+Click (or Go to Definition) on a Mapper interface method to jump to the corresponding SQL definition in the XML file.
- **XML to Java**: Ctrl+Click (or Go to Definition) on an SQL ID (e.g., `<select id="selectUser">`) to jump to the corresponding method in the Java interface.

## Requirements

- VS Code 1.80.0 or newer.
- A standard directory structure is NOT required. The extension scans all `*.xml` files in the workspace to map namespaces.

## How it works

1. **Scanning**: On startup, it scans all `.xml` files to find `<mapper namespace="...">` tags and builds a cache.
2. **From Java**: It uses the file's package declaration + filename to construct the Fully Qualified Class Name (FQCN). It looks up the FQCN in the cache to find the XML file, then searches for the method ID.
3. **From XML**: It reads the `namespace` attribute to determine the target Java class. It searches the workspace for a file matching the class name and verification of the package.

## Commands

- `MyBatis Lite Navigation: Refresh Cache`: Manually trigger a re-scan of XML files (useful if file watchers miss a change).

## Extension Settings

None! It just works.

## Installation from Source

1. Clone repo.
2. `npm install`
3. `F5` to debug.
4. `npm run compile` to build.
