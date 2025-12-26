import * as vscode from 'vscode';
import * as path from 'path';

export class XmlDefinitionProvider implements vscode.DefinitionProvider {

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {

        // 1. Get current namespace
        const text = document.getText();
        const namespaceMatch = /<mapper\s+[^>]*namespace=["']([^"']+)["'][^>]*>/.exec(text);
        if (!namespaceMatch) return;

        const fqcn = namespaceMatch[1]; // e.g., com.example.MyMapper

        // 2. Determine what we clicked on
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;
        const clickedWord = document.getText(range);

        // If we clicked on the `namespace` value itself, jump to the class file
        // Check if cursor is inside the namespace attribute
        const line = document.lineAt(position.line).text;
        // Simple check: if line contains namespace definition and we are on it
        if ((line.includes(`namespace="${fqcn}"`) || line.includes(`namespace='${fqcn}'`)) && clickedWord === fqcn.split('.').pop()) {
            // Fallthrough to java file search
        }
        // Otherwise, assume it's a statement id

        // 3. Find Java file
        // We'll search for file with name = ClassName.java
        const className = fqcn.split('.').pop();
        if (!className) return;

        const uris = await vscode.workspace.findFiles(`**/${className}.java`, '**/node_modules/**');

        for (const uri of uris) {
            const javaDoc = await vscode.workspace.openTextDocument(uri);
            const javaText = javaDoc.getText();

            // Validate package
            // e.g. package com.example;
            const packagePart = fqcn.substring(0, fqcn.lastIndexOf('.'));
            if (javaText.includes(`package ${packagePart};`)) {

                // Found the matching class file
                // If we clicked on an ID, try to find the method
                const methodRegex = new RegExp(`\\s${clickedWord}\\s*\\(`, 'g');
                // Or just `Type clickedWord(` or `void clickedWord(`
                // Simple heuristic: search for the word followed by (
                const methodMatch = methodRegex.exec(javaText);

                if (methodMatch) {
                    return new vscode.Location(uri, javaDoc.positionAt(methodMatch.index + 1));
                }

                // Default to class definition
                const classRegex = new RegExp(`(interface|class)\\s+${className}`, 'g');
                const classMatch = classRegex.exec(javaText);
                if (classMatch) {
                    return new vscode.Location(uri, javaDoc.positionAt(classMatch.index));
                }

                return new vscode.Location(uri, new vscode.Position(0, 0));
            }
        }

        return undefined;
    }
}
