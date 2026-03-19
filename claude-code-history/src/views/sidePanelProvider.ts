import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  Session,
  WebviewMessage,
  ExtensionMessage,
  SessionDetail,
  FileChange,
} from '../types';
import {
  detectClaudeDirectory,
  inferProjectPath,
  decodeProjectName,
  getCurrentProjectEncoded,
} from '../utils/pathUtils';
import {
  loadSessionList,
  loadSessionDetail,
  getUniqueProjects,
} from '../parsers/claudeParser';
import { DiffService } from '../services/diffService';
import { SearchService } from '../services/searchService';

export class SidePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cch.sidePanel';

  private view?: vscode.WebviewView;
  private sessions: Session[] = [];
  private diffService: DiffService;
  private searchService: SearchService;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.diffService = new DiffService();
    this.searchService = new SearchService();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      this.handleMessage(msg);
    });

    // Auto-load sessions when the panel becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshSessions();
      }
    });

    // Initial load
    this.refreshSessions();
  }

  /**
   * 刷新会话列表
   */
  public refreshSessions(): void {
    const claudeDir = detectClaudeDirectory();
    if (!claudeDir) {
      this.postMessage({
        command: 'error',
        message:
          'Claude directory not found. Install Claude Code CLI or configure the path in settings.',
      });
      return;
    }

    this.postMessage({ command: 'loading', loading: true });

    try {
      this.sessions = loadSessionList(claudeDir);
      const currentProject = getCurrentProjectEncoded();

      this.postMessage({
        command: 'sessionsLoaded',
        sessions: this.sessions,
        currentProject,
      });
    } catch (err) {
      this.postMessage({
        command: 'error',
        message: `Failed to load sessions: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      this.postMessage({ command: 'loading', loading: false });
    }
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.command) {
      case 'getSessions': {
        this.refreshSessions();
        break;
      }

      case 'getSessionDetail': {
        this.postMessage({ command: 'loading', loading: true });
        try {
          const { messages, fileChanges } = loadSessionDetail(msg.filePath);
          const session = this.sessions.find((s) => s.filePath === msg.filePath);
          if (session) {
            this.postMessage({
              command: 'sessionDetailLoaded',
              detail: { session, messages, fileChanges },
            });
          }
        } catch (err) {
          this.postMessage({
            command: 'error',
            message: `Failed to load session: ${err instanceof Error ? err.message : String(err)}`,
          });
        } finally {
          this.postMessage({ command: 'loading', loading: false });
        }
        break;
      }

      case 'search': {
        const claudeDir = detectClaudeDirectory();
        if (!claudeDir) break;

        this.postMessage({ command: 'loading', loading: true });
        try {
          const results = await this.searchService.search(claudeDir, msg.query);
          this.postMessage({ command: 'searchResults', results });
        } catch (err) {
          this.postMessage({
            command: 'error',
            message: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        } finally {
          this.postMessage({ command: 'loading', loading: false });
        }
        break;
      }

      case 'showDiff': {
        await this.diffService.showDiff(msg.fileChange);
        break;
      }

      case 'applyChanges': {
        await this.diffService.applyChanges(msg.fileChange);
        break;
      }

      case 'openFile': {
        await this.diffService.openFile(msg.filePath);
        break;
      }

      case 'refresh': {
        this.refreshSessions();
        break;
      }

      case 'getProjects': {
        const claudeDir = detectClaudeDirectory();
        if (!claudeDir) break;
        const projects = getUniqueProjects(claudeDir);
        const currentProject = getCurrentProjectEncoded();
        this.postMessage({
          command: 'projectsLoaded',
          projects,
          currentProject,
        });
        break;
      }

      case 'exportMarkdown': {
        await this.exportToMarkdown(msg.filePath);
        break;
      }
    }
  }

  private async exportToMarkdown(sessionFilePath: string): Promise<void> {
    try {
      const { messages } = loadSessionDetail(sessionFilePath);
      const session = this.sessions.find((s) => s.filePath === sessionFilePath);
      const title = session?.title || 'Untitled Session';

      let md = `# ${title}\n\n`;
      md += `**Date:** ${session?.startTime || 'Unknown'}\n\n---\n\n`;

      for (const msg of messages) {
        const role = msg.type === 'human' || msg.type === 'user' ? '👤 User' : '🤖 Assistant';
        md += `## ${role}\n\n`;

        const content = msg.message?.content;
        if (typeof content === 'string') {
          md += content + '\n\n';
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              md += block.text + '\n\n';
            } else if (block.type === 'thinking' && block.thinking) {
              md += `<details><summary>💭 Thinking</summary>\n\n${block.thinking}\n\n</details>\n\n`;
            } else if (block.type === 'tool_use') {
              md += `**🔧 Tool: ${block.name}**\n\n`;
              if (block.input) {
                md += '```json\n' + JSON.stringify(block.input, null, 2) + '\n```\n\n';
              }
            }
          }
        }
        md += '---\n\n';
      }

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`),
        filters: { Markdown: ['md'] },
      });

      if (saveUri) {
        fs.writeFileSync(saveUri.fsPath, md, 'utf-8');
        vscode.window.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private postMessage(msg: ExtensionMessage): void {
    this.view?.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidePanel.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidePanel.js')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>Claude History</title>
</head>
<body>
  <div id="app">
    <!-- Header -->
    <div id="header">
      <div class="header-row">
        <button id="backBtn" class="icon-btn hidden" title="Back">
          <span class="codicon">←</span>
        </button>
        <h2 id="headerTitle">Claude History</h2>
        <div class="header-actions">
          <button id="refreshBtn" class="icon-btn" title="Refresh">⟳</button>
        </div>
      </div>
      <!-- Tab bar for detail view -->
      <div id="tabBar" class="hidden">
        <button class="tab active" data-tab="conversation">Conversation</button>
        <button class="tab" data-tab="fileChanges">File Changes</button>
      </div>
      <!-- Search bar -->
      <div id="searchBar">
        <input type="text" id="searchInput" placeholder="Search conversations..." />
      </div>
      <!-- Project filter -->
      <div id="projectFilter">
        <select id="projectSelect">
          <option value="">All Projects</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div id="loading" class="hidden">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

    <!-- Error -->
    <div id="errorMsg" class="hidden"></div>

    <!-- Session list -->
    <div id="sessionList"></div>

    <!-- Session detail -->
    <div id="sessionDetail" class="hidden">
      <div id="conversationView"></div>
      <div id="fileChangesView" class="hidden"></div>
    </div>

    <!-- Search results -->
    <div id="searchResults" class="hidden"></div>

    <!-- Empty state -->
    <div id="emptyState" class="hidden">
      <div class="empty-icon">📭</div>
      <p>No conversations found</p>
      <p class="muted">Make sure Claude Code CLI is installed and has been used.</p>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.diffService.dispose();
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
