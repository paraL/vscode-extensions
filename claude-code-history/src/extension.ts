import * as vscode from 'vscode';
import { SidePanelProvider } from './views/sidePanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Code History Viewer activated');

  // Register the side panel webview provider
  const provider = new SidePanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidePanelProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('cch.refreshSessions', () => {
      provider.refreshSessions();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cch.openSidePanel', () => {
      vscode.commands.executeCommand('cch.sidePanel.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cch.openSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:local.claude-code-history-viewer'
      );
    })
  );
}

export function deactivate(): void {
  console.log('Claude Code History Viewer deactivated');
}
