import * as vscode from 'vscode';


export class MapperCache {
    private namespaceMap: Map<string, vscode.Uri> = new Map();

    constructor() {
        // Note: call initialize() explicitly after construction
    }

    public async initialize() {
        await this.refresh();
        this.startWatcher();
        console.log('[MyBatis Cache] Initialization complete');
    }

    public getXmlUri(namespace: string): vscode.Uri | undefined {
        return this.namespaceMap.get(namespace);
    }

    public async refresh() {
        this.namespaceMap.clear();
        const files = await vscode.workspace.findFiles('**/*.xml', '**/node_modules/**');
        console.log(`[MyBatis Cache] Found ${files.length} XML files`);
        for (const file of files) {
            await this.parseFile(file);
        }
        console.log(`[MyBatis Cache] Loaded ${this.namespaceMap.size} mapper namespaces`);
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
                console.log(`[MyBatis Cache] Mapped: ${namespace}`);
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
