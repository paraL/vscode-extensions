import * as vscode from 'vscode';


export class MapperCache {
    private namespaceMap: Map<string, vscode.Uri> = new Map();

    constructor() {
        this.refresh();
        this.startWatcher();
    }

    public getXmlUri(namespace: string): vscode.Uri | undefined {
        return this.namespaceMap.get(namespace);
    }

    public async refresh() {
        this.namespaceMap.clear();
        const files = await vscode.workspace.findFiles('**/*.xml', '**/node_modules/**');
        for (const file of files) {
            this.parseFile(file);
        }
    }

    private startWatcher() {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
        watcher.onDidChange(uri => this.parseFile(uri));
        watcher.onDidCreate(uri => this.parseFile(uri));
        watcher.onDidDelete(uri => this.removeFile(uri));
    }

    private async parseFile(uri: vscode.Uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            // Regex to find <mapper namespace="...">
            const match = /<mapper\s+[^>]*namespace=["']([^"']+)["'][^>]*>/.exec(text);
            if (match && match[1]) {
                const namespace = match[1];
                this.namespaceMap.set(namespace, uri);
                // console.log(`Mapped namespace ${namespace} to ${uri.fsPath}`);
            }
        } catch (error) {
            console.error(`Error parsing XML: ${uri.fsPath}`, error);
        }
    }

    private removeFile(uri: vscode.Uri) {
        for (const [namespace, mappedUri] of this.namespaceMap.entries()) {
            if (mappedUri.toString() === uri.toString()) {
                this.namespaceMap.delete(namespace);
                break;
            }
        }
    }
}
