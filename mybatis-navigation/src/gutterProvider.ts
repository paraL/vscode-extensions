import * as vscode from 'vscode';
import * as path from 'path';
import { MapperCache } from './mapperCache';

// Store jump targets for gutter icons
interface JumpTarget {
    line: number;
    targetUri: vscode.Uri;
    targetPosition: vscode.Position;
}

export class GutterIconProvider {
    private javaDecorationType: vscode.TextEditorDecorationType;
    private xmlDecorationType: vscode.TextEditorDecorationType;
    private jumpTargets: Map<string, JumpTarget[]> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private cache: MapperCache
    ) {
        // Create decoration types with gutter icons
        this.javaDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: path.join(context.extensionPath, 'icons', 'mybatis-java-icon.svg'),
            gutterIconSize: 'contain'
        });

        this.xmlDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: path.join(context.extensionPath, 'icons', 'mybatis-xml-icon.svg'),
            gutterIconSize: 'contain'
        });

        // Listen to editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateDecorations(editor);
            }
        }, null, context.subscriptions);

        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                this.updateDecorations(editor);
            }
        }, null, context.subscriptions);

        // Initial decoration for current editor
        if (vscode.window.activeTextEditor) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    public async updateDecorations(editor: vscode.TextEditor) {
        const document = editor.document;
        const uri = document.uri.toString();

        if (document.languageId === 'java') {
            await this.decorateJavaFile(editor);
        } else if (document.languageId === 'xml') {
            await this.decorateXmlFile(editor);
        }
    }

    private async decorateJavaFile(editor: vscode.TextEditor) {
        const document = editor.document;
        const text = document.getText();
        const uri = document.uri.toString();
        const decorations: vscode.DecorationOptions[] = [];
        const targets: JumpTarget[] = [];

        // Check if this is a Mapper interface
        const packageMatch = /package\s+([\w\.]+);/.exec(text);
        if (!packageMatch) return;

        const packageName = packageMatch[1];
        const className = path.basename(document.fileName, '.java');
        const fqcn = `${packageName}.${className}`;

        const xmlUri = this.cache.getXmlUri(fqcn);
        if (!xmlUri) {
            editor.setDecorations(this.javaDecorationType, []);
            return;
        }

        // Find all method declarations
        // Enhanced regex: matches method declarations in interface (including multi-line)
        // This regex finds method patterns spanning multiple lines
        const methodRegex = /^\s*(?:(?:public|private|protected)\s+)?(?:[\w<>\[\],\s?]+)\s+(\w+)\s*\([^;]*?\)\s*;/gm;
        let match;

        while ((match = methodRegex.exec(text)) !== null) {
            const methodName = match[1];
            // Find the position of method name within the match to get correct line
            const methodNameIndex = match.index + match[0].indexOf(methodName);
            const line = document.positionAt(methodNameIndex).line;

            // Find corresponding position in XML
            const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
            const xmlText = xmlDoc.getText();
            const idRegex = new RegExp(`<\\w+\\s+[^>]*id=["']${methodName}["'][^>]*>`, 'g');
            const xmlMatch = idRegex.exec(xmlText);

            const targetPos = xmlMatch
                ? xmlDoc.positionAt(xmlMatch.index)
                : new vscode.Position(0, 0);

            decorations.push({
                range: new vscode.Range(line, 0, line, 0),
                hoverMessage: `Go to XML: ${methodName}`
            });

            targets.push({
                line,
                targetUri: xmlUri,
                targetPosition: targetPos
            });
        }

        this.jumpTargets.set(uri, targets);
        editor.setDecorations(this.javaDecorationType, decorations);
    }

    private async decorateXmlFile(editor: vscode.TextEditor) {
        const document = editor.document;
        const text = document.getText();
        const uri = document.uri.toString();
        const decorations: vscode.DecorationOptions[] = [];
        const targets: JumpTarget[] = [];

        // Check if this is a MyBatis mapper XML
        const namespaceMatch = /<mapper\s+[^>]*namespace=["']([^"']+)["'][^>]*>/.exec(text);
        if (!namespaceMatch) {
            editor.setDecorations(this.xmlDecorationType, []);
            return;
        }

        const fqcn = namespaceMatch[1];
        const className = fqcn.split('.').pop();
        if (!className) return;

        // Find the Java file
        const javaUris = await vscode.workspace.findFiles(`**/${className}.java`, '**/node_modules/**');
        let targetJavaUri: vscode.Uri | undefined;
        let javaDoc: vscode.TextDocument | undefined;

        for (const javaUri of javaUris) {
            const doc = await vscode.workspace.openTextDocument(javaUri);
            const javaText = doc.getText();
            const packagePart = fqcn.substring(0, fqcn.lastIndexOf('.'));
            if (javaText.includes(`package ${packagePart};`)) {
                targetJavaUri = javaUri;
                javaDoc = doc;
                break;
            }
        }

        if (!targetJavaUri || !javaDoc) {
            editor.setDecorations(this.xmlDecorationType, []);
            return;
        }

        // Find all SQL statements
        const sqlRegex = /<(select|insert|update|delete)\s+[^>]*id=["']([^"']+)["'][^>]*>/g;
        let match;

        while ((match = sqlRegex.exec(text)) !== null) {
            const methodName = match[2];
            const line = document.positionAt(match.index).line;

            // Find method in Java file
            const javaText = javaDoc.getText();
            const methodRegex = new RegExp(`\\s${methodName}\\s*\\(`, 'g');
            const javaMatch = methodRegex.exec(javaText);

            const targetPos = javaMatch
                ? javaDoc.positionAt(javaMatch.index + 1)
                : new vscode.Position(0, 0);

            decorations.push({
                range: new vscode.Range(line, 0, line, 0),
                hoverMessage: `Go to Java: ${methodName}`
            });

            targets.push({
                line,
                targetUri: targetJavaUri,
                targetPosition: targetPos
            });
        }

        this.jumpTargets.set(uri, targets);
        editor.setDecorations(this.xmlDecorationType, decorations);
    }

    public getJumpTarget(uri: string, line: number): JumpTarget | undefined {
        const targets = this.jumpTargets.get(uri);
        if (!targets) return undefined;
        return targets.find(t => t.line === line);
    }
}
