import * as vscode from 'vscode';
import { MapperCache } from './mapperCache';

export class JavaDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private cache: MapperCache) { }

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {

        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        const methodName = document.getText(range);

        // Simple heuristic: get package + class name
        // 1. Find package declaration
        const packageMatch = /package\s+([\w\.]+);/.exec(document.getText());
        if (!packageMatch) return;

        const packageName = packageMatch[1];

        // 2. Find class/interface name (naive, assumes filename matches classname or adjacent)
        // Better: look for interface X or class X around the current position or just use file name
        // Using file path is safest implementation for standard java projects
        let className = document.fileName.replace(/^.*[\\\/]/, '').replace(/\.java$/, '');

        // Check if cursor is inside an interface with that name
        // For simplicity, we assume the file defines the interface matching the filename

        const fqcn = `${packageName}.${className}`;
        console.log(`[MyBatis] Looking for namespace: ${fqcn}, method: ${methodName}`);

        const xmlUri = this.cache.getXmlUri(fqcn);
        if (!xmlUri) {
            console.log(`[MyBatis] No XML found for namespace: ${fqcn}`);
            return;
        }
        console.log(`[MyBatis] Found XML: ${xmlUri.fsPath}`);

        // Open XML and find method ID
        const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
        const text = xmlDoc.getText();

        // Regex for <select|insert|update|delete id="methodName" ...>
        const idRegex = new RegExp(`<\\w+\\s+[^>]*id=["']${methodName}["'][^>]*>`, 'g');
        const match = idRegex.exec(text);

        if (match) {
            const pos = xmlDoc.positionAt(match.index);
            return new vscode.Location(xmlUri, pos);
        }

        // If not found, just return the file top
        return new vscode.Location(xmlUri, new vscode.Position(0, 0));
    }
}
