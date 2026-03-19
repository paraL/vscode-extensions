import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileChange } from '../types';

/**
 * Diff 服务 — 利用 VS Code 原生 diff editor 显示文件对比
 */
export class DiffService {
  private tmpDir: string;

  constructor() {
    this.tmpDir = path.join(os.tmpdir(), 'claude-history-diff');
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * 显示文件 diff（VS Code 原生 diff viewer）
   */
  async showDiff(fileChange: FileChange): Promise<void> {
    const oldContent = fileChange.oldContent || '';
    const newContent = fileChange.newContent || '';
    const fileName = path.basename(fileChange.filePath);
    const timestamp = new Date().getTime();

    const oldUri = this.createTempFile(
      `old-${timestamp}-${fileName}`,
      oldContent
    );
    const newUri = this.createTempFile(
      `new-${timestamp}-${fileName}`,
      newContent
    );

    const title = `${fileName} (${fileChange.operation})`;
    await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, title);
  }

  /**
   * 将变更应用到工作区文件
   */
  async applyChanges(fileChange: FileChange): Promise<void> {
    if (!fileChange.newContent && fileChange.operation !== 'edit') {
      vscode.window.showWarningMessage('No content to apply.');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    // Try to resolve the file path relative to workspace
    let targetPath = fileChange.filePath;
    if (!path.isAbsolute(targetPath)) {
      targetPath = path.join(workspaceFolders[0].uri.fsPath, targetPath);
    }

    const confirm = await vscode.window.showWarningMessage(
      `Apply changes to ${path.basename(targetPath)}?`,
      'Apply',
      'Cancel'
    );

    if (confirm !== 'Apply') return;

    try {
      if (fileChange.operation === 'write' || fileChange.operation === 'create') {
        // Create or overwrite file
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, fileChange.newContent || '', 'utf-8');
      } else if (fileChange.operation === 'edit' || fileChange.operation === 'multi_edit') {
        // For edit operations, apply the old->new replacement
        if (fs.existsSync(targetPath)) {
          let currentContent = fs.readFileSync(targetPath, 'utf-8');
          if (fileChange.oldContent && fileChange.newContent) {
            currentContent = currentContent.replace(
              fileChange.oldContent,
              fileChange.newContent
            );
          }
          fs.writeFileSync(targetPath, currentContent, 'utf-8');
        }
      }

      vscode.window.showInformationMessage(
        `Changes applied to ${path.basename(targetPath)}`
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to apply changes: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * 在编辑器中打开文件
   */
  async openFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch {
      vscode.window.showErrorMessage(`Cannot open file: ${filePath}`);
    }
  }

  private createTempFile(name: string, content: string): vscode.Uri {
    const filePath = path.join(this.tmpDir, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    return vscode.Uri.file(filePath);
  }

  dispose(): void {
    // Clean up temp directory
    try {
      if (fs.existsSync(this.tmpDir)) {
        fs.rmSync(this.tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
}
