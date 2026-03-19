import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  Session,
  ParsedMessage,
  ContentBlock,
  FileChange,
  LineChange,
} from '../types';
import {
  getAllSessionFiles,
  inferProjectPath,
  decodeProjectName,
} from '../utils/pathUtils';
import { extractFileChanges } from './fileChangeParser';

/**
 * 解析 JSONL 文本为一行行有效 JSON 字符串
 * 参考 agsoft 的 Yt() 函数，支持跨行 JSON 和大括号配对
 */
function parseJsonlLines(content: string): string[] {
  const results: string[] = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let buffer = '';
  let braceDepth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (const line of lines) {
    if (!buffer && !line.trim()) continue;
    if (!buffer && !started && !line.trim().startsWith('{')) continue;

    buffer = buffer ? buffer + '\n' + line : line;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') {
          braceDepth++;
          started = true;
        } else if (ch === '}') {
          braceDepth--;
        }
      }
    }

    if (braceDepth === 0 && !inString && buffer.trim() && started) {
      try {
        JSON.parse(buffer);
        results.push(buffer);
      } catch {
        // skip invalid JSON
      }
      buffer = '';
      started = false;
    }

    // Safety: reset if buffer gets too large
    if (buffer.length > 10_000_000) {
      buffer = '';
      braceDepth = 0;
      inString = false;
      escaped = false;
      started = false;
    }

    if (braceDepth < 0) {
      buffer = '';
      braceDepth = 0;
      inString = false;
      escaped = false;
      started = false;
    }
  }

  // Try to parse remaining buffer
  if (buffer.trim() && started) {
    try {
      JSON.parse(buffer);
      results.push(buffer);
    } catch {
      // skip
    }
  }

  return results;
}

/**
 * 从消息中提取标题（取用户首条消息的前80字符）
 */
function extractTitle(messages: ParsedMessage[]): string {
  for (const msg of messages) {
    if (msg.type === 'human' || msg.type === 'user') {
      const content = msg.message?.content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === 'object' && block.text) {
            text = block.text;
            break;
          }
        }
      }
      text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (text && text.length > 3) {
        return text.length > 80 ? text.substring(0, 77) + '...' : text;
      }
    }
  }
  return 'Untitled Session';
}

/**
 * 扫描会话列表元数据（不加载完整消息）
 */
export function loadSessionList(claudeDir: string): Session[] {
  const files = getAllSessionFiles(claudeDir);
  const maxFileSize =
    vscode.workspace
      .getConfiguration('cch')
      .get<number>('maxFileSize') || 50;

  const sessions: Session[] = [];

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      const sizeMB = stat.size / (1024 * 1024);
      if (sizeMB > maxFileSize) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const jsonLines = parseJsonlLines(content);
      if (jsonLines.length === 0) continue;

      let sessionId = '';
      let firstTimestamp = '';
      let lastTimestamp = '';
      let messageCount = 0;
      const titleMessages: ParsedMessage[] = [];

      for (let i = 0; i < jsonLines.length; i++) {
        try {
          const entry = JSON.parse(jsonLines[i]);
          if (!sessionId && entry.sessionId) {
            sessionId = entry.sessionId;
          }
          if (!firstTimestamp && entry.timestamp) {
            firstTimestamp = entry.timestamp;
          }
          if (entry.timestamp) {
            lastTimestamp = entry.timestamp;
          }
          if (entry.type === 'human' || entry.type === 'user' || entry.type === 'assistant') {
            messageCount++;
          }

          // Collect first few messages for title extraction
          if (titleMessages.length < 5 && (entry.type === 'human' || entry.type === 'user')) {
            titleMessages.push(entry as ParsedMessage);
          }
        } catch {
          // skip invalid line
        }
      }

      if (!sessionId) {
        sessionId = path.basename(filePath, '.jsonl');
      }

      const projectEncoded = inferProjectPath(filePath);

      sessions.push({
        sessionId,
        projectPath: projectEncoded,
        title: extractTitle(titleMessages),
        startTime: firstTimestamp,
        endTime: lastTimestamp,
        messageCount,
        filePath,
        source: 'claude',
      });
    } catch {
      // skip files that can't be read
    }
  }

  // Sort by end time, most recent first
  sessions.sort((a, b) => {
    const ta = new Date(a.endTime || a.startTime).getTime() || 0;
    const tb = new Date(b.endTime || b.startTime).getTime() || 0;
    return tb - ta;
  });

  return sessions;
}

/**
 * 加载完整会话详情
 */
export function loadSessionDetail(filePath: string): {
  messages: ParsedMessage[];
  fileChanges: FileChange[];
} {
  const maxFileSize =
    vscode.workspace
      .getConfiguration('cch')
      .get<number>('maxFileSize') || 50;

  const stat = fs.statSync(filePath);
  const sizeMB = stat.size / (1024 * 1024);
  if (sizeMB > maxFileSize) {
    throw new Error(`File too large: ${sizeMB.toFixed(1)}MB (limit: ${maxFileSize}MB)`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const jsonLines = parseJsonlLines(content);
  const messages: ParsedMessage[] = [];

  for (const line of jsonLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type && entry.message) {
        messages.push(entry as ParsedMessage);
      }
    } catch {
      // skip
    }
  }

  const fileChanges = extractFileChanges(messages);

  return { messages, fileChanges };
}

/**
 * 获取所有唯一项目路径
 */
export function getUniqueProjects(claudeDir: string): string[] {
  const files = getAllSessionFiles(claudeDir);
  const projects = new Set<string>();

  for (const filePath of files) {
    const project = inferProjectPath(filePath);
    if (project) {
      projects.add(project);
    }
  }

  return Array.from(projects);
}
