import * as vscode from 'vscode';
import { MapperCache } from './mapperCache';
import { JavaDefinitionProvider } from './javaProvider';
import { XmlDefinitionProvider } from './xmlProvider';
import { GutterIconProvider } from './gutterProvider';

export async function activate(context: vscode.ExtensionContext) {
    console.log('MyBatis Lite Navigation is activating...');

    const cache = new MapperCache();
    await cache.initialize();

    // Register Java -> XML provider
    const javaSelector = { language: 'java', scheme: 'file' };
    const javaProvider = vscode.languages.registerDefinitionProvider(javaSelector, new JavaDefinitionProvider(cache));

    // Register XML -> Java provider
    const xmlSelector = { language: 'xml', scheme: 'file' };
    const xmlProvider = vscode.languages.registerDefinitionProvider(xmlSelector, new XmlDefinitionProvider());

    context.subscriptions.push(javaProvider, xmlProvider);

    // Initialize gutter icon provider
    const gutterProvider = new GutterIconProvider(context, cache);

    // Register gutter icon click command
    const gotoMapperCmd = vscode.commands.registerCommand('mybatis-lite.gotoMapper', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const line = editor.selection.active.line;
        const uri = editor.document.uri.toString();
        const target = gutterProvider.getJumpTarget(uri, line);

        if (target) {
            const doc = await vscode.workspace.openTextDocument(target.targetUri);
            const targetEditor = await vscode.window.showTextDocument(doc);
            targetEditor.selection = new vscode.Selection(target.targetPosition, target.targetPosition);
            targetEditor.revealRange(new vscode.Range(target.targetPosition, target.targetPosition), vscode.TextEditorRevealType.InCenter);
        }
    });

    context.subscriptions.push(gotoMapperCmd);

    // Explicit refresh command
    const refreshCmd = vscode.commands.registerCommand('mybatis-lite.refreshCache', () => {
        cache.refresh();
        vscode.window.showInformationMessage('MyBatis cache refreshed.');
    });

    context.subscriptions.push(refreshCmd);

    console.log('MyBatis Lite Navigation activated.');
}

export function deactivate() { }

