import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * 自动检测 ~/.claude 目录
 */
export function detectClaudeDirectory(): string | undefined {
  const configDir = vscode.workspace
    .getConfiguration('cch')
    .get<string>('claudeDirectory');

  if (configDir && configDir.trim() && fs.existsSync(configDir.trim())) {
    return configDir.trim();
  }

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');
  return fs.existsSync(claudeDir) ? claudeDir : undefined;
}

/**
 * 获取所有项目目录
 */
export function getProjectDirectories(claudeDir: string): string[] {
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return [];
  }
  try {
    return fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(projectsDir, d.name));
  } catch {
    return [];
  }
}

/**
 * 获取所有 JSONL 会话文件
 */
export function getAllSessionFiles(claudeDir: string): string[] {
  const results: string[] = [];
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return results;
  }

  try {
    // projects/ 下的第一层是编码后的项目路径
    const projectContainers = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(projectsDir, d.name));

    for (const container of projectContainers) {
      try {
        const jsonlFiles = fs
          .readdirSync(container, { withFileTypes: true })
          .filter(
            (f) =>
              f.isFile() &&
              f.name.endsWith('.jsonl') &&
              !f.name.startsWith('agent-')
          )
          .map((f) => path.join(container, f.name));
        results.push(...jsonlFiles);
      } catch {
        // skip unreadable directories
      }
    }
  } catch {
    // skip
  }

  return results;
}

/**
 * 从 JSONL 文件路径推断项目路径
 * ~/.claude/projects/<encoded-project-path>/<session>.jsonl
 * 编码规则: 路径中的 / 替换为 -
 */
export function inferProjectPath(filePath: string): string {
  const parts = filePath.split(path.sep);
  const projectsIdx = parts.indexOf('projects');
  if (projectsIdx >= 0 && projectsIdx + 1 < parts.length) {
    // The folder name under projects/ is the encoded project path
    return parts[projectsIdx + 1];
  }
  return '';
}

/**
 * 解码项目路径名为可读形式
 */
export function decodeProjectName(encodedPath: string): string {
  // Claude encodes paths like: -Users-username-project -> /Users/username/project
  if (!encodedPath) {
    return 'Unknown Project';
  }
  // 取最后一个有意义的部分作为简短名称
  const decoded = encodedPath.startsWith('-')
    ? '/' + encodedPath.substring(1).replace(/-/g, '/')
    : encodedPath.replace(/-/g, '/');

  const segments = decoded.split('/').filter(Boolean);
  return segments[segments.length - 1] || decoded;
}

/**
 * 检测当前工作区对应的项目编码路径
 */
export function getCurrentProjectEncoded(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const wsPath = workspaceFolders[0].uri.fsPath;
  // Encode: /Users/username/project -> -Users-username-project
  return wsPath.replace(/\//g, '-').replace(/^-/, '-');
}

/**
 * 获取简短项目名（从完整编码路径）
 */
export function getShortProjectName(encodedPath: string): string {
  return decodeProjectName(encodedPath);
}

/**
 * 检查是否有任何历史文件
 */
export function hasAnyHistoryFiles(): boolean {
  const claudeDir = detectClaudeDirectory();
  if (!claudeDir) {
    return false;
  }
  return getAllSessionFiles(claudeDir).length > 0;
}
