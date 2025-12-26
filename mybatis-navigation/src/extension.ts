import * as vscode from 'vscode';
import { MapperCache } from './mapperCache';
import { JavaDefinitionProvider } from './javaProvider';
import { XmlDefinitionProvider } from './xmlProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('MyBatis Lite Navigation is activating...');

    const cache = new MapperCache();

    // Register Java -> XML provider
    const javaSelector = { language: 'java', scheme: 'file' };
    const javaProvider = vscode.languages.registerDefinitionProvider(javaSelector, new JavaDefinitionProvider(cache));

    // Register XML -> Java provider
    const xmlSelector = { language: 'xml', scheme: 'file' };
    const xmlProvider = vscode.languages.registerDefinitionProvider(xmlSelector, new XmlDefinitionProvider());

    context.subscriptions.push(javaProvider, xmlProvider);

    // Explicit refresh command
    const refreshCmd = vscode.commands.registerCommand('mybatis-lite.refreshCache', () => {
        cache.refresh();
        vscode.window.showInformationMessage('MyBatis cache refreshed.');
    });

    context.subscriptions.push(refreshCmd);

    console.log('MyBatis Lite Navigation activated.');
}

export function deactivate() { }
