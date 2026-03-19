import * as fs from 'fs';
import * as vscode from 'vscode';
import { SearchResult } from '../types';
import { getAllSessionFiles, inferProjectPath, decodeProjectName } from '../utils/pathUtils';

/**
 * 纯内存搜索服务 — 遍历 JSONL 文件搜索关键词
 */
export class SearchService {
  /**
   * 搜索所有会话中的消息内容
   */
  async search(
    claudeDir: string,
    query: string,
    maxResults: number = 100
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const files = getAllSessionFiles(claudeDir);
    const queryLower = query.toLowerCase();

    for (const filePath of files) {
      if (results.length >= maxResults) break;

      try {
        const maxFileSize =
          vscode.workspace
            .getConfiguration('cch')
            .get<number>('maxFileSize') || 50;

        const stat = fs.statSync(filePath);
        if (stat.size / (1024 * 1024) > maxFileSize) continue;

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let sessionId = '';
        let sessionTitle = '';
        const projectPath = inferProjectPath(filePath);

        for (const line of lines) {
          if (!line.trim()) continue;
          if (results.length >= maxResults) break;

          try {
            const entry = JSON.parse(line);
            if (!sessionId && entry.sessionId) {
              sessionId = entry.sessionId;
            }

            if (!entry.message?.content) continue;

            let messageText = '';
            if (typeof entry.message.content === 'string') {
              messageText = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              messageText = entry.message.content
                .filter((b: { type?: string; text?: string }) => b.text)
                .map((b: { text?: string }) => b.text || '')
                .join(' ');
            }

            // Extract session title from first human message
            if (
              !sessionTitle &&
              (entry.type === 'human' || entry.type === 'user')
            ) {
              sessionTitle = messageText.substring(0, 80).replace(/\n/g, ' ');
            }

            if (messageText.toLowerCase().includes(queryLower)) {
              // Extract a snippet around the match
              const idx = messageText.toLowerCase().indexOf(queryLower);
              const start = Math.max(0, idx - 50);
              const end = Math.min(messageText.length, idx + query.length + 50);
              const snippet =
                (start > 0 ? '...' : '') +
                messageText.substring(start, end) +
                (end < messageText.length ? '...' : '');

              results.push({
                sessionId: sessionId || filePath,
                sessionTitle: sessionTitle || 'Untitled',
                projectPath,
                timestamp: entry.timestamp || '',
                matchedText: snippet.replace(/\n/g, ' '),
                messageUuid: entry.uuid || '',
                messageType: entry.type || '',
              });
            }
          } catch {
            // skip invalid JSON lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    return results;
  }
}
