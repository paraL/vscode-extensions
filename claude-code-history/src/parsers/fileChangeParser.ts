import { ParsedMessage, FileChange, LineChange, ContentBlock } from '../types';
import * as Diff from 'diff';

/**
 * 从消息列表中提取所有文件变更
 */
export function extractFileChanges(messages: ParsedMessage[]): FileChange[] {
  const fileChanges: FileChange[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.message?.content || !Array.isArray(msg.message.content)) continue;

    for (const block of msg.message.content) {
      if (
        typeof block === 'object' &&
        block !== null &&
        block.type === 'tool_use' &&
        block.name &&
        block.input
      ) {
        const toolResult = findToolResult(messages, i + 1, block.id || '');
        processToolUse(
          block.name,
          block.input as Record<string, unknown>,
          block.id || '',
          msg.uuid || '',
          msg.timestamp || '',
          toolResult,
          fileChanges
        );
      }
    }
  }

  return fileChanges;
}

/**
 * 查找 tool_result 消息
 */
function findToolResult(
  messages: ParsedMessage[],
  startIdx: number,
  toolUseId: string
): string | null {
  for (let i = startIdx; i < Math.min(startIdx + 5, messages.length); i++) {
    const msg = messages[i];
    if (msg.message?.content && Array.isArray(msg.message.content)) {
      for (const block of msg.message.content) {
        if (
          typeof block === 'object' &&
          block !== null &&
          block.type === 'tool_result' &&
          (block as ContentBlock).tool_use_id === toolUseId
        ) {
          const content = (block as ContentBlock).content;
          return typeof content === 'string' ? content : null;
        }
      }
    }
  }
  return null;
}

/**
 * 处理单个 tool_use，提取文件变更
 */
function processToolUse(
  toolName: string,
  input: Record<string, unknown>,
  toolId: string,
  messageUuid: string,
  timestamp: string,
  toolResult: string | null,
  fileChanges: FileChange[]
): void {
  switch (toolName) {
    case 'Read':
      // Read operations don't produce file changes, skip
      break;

    case 'Write':
      processWrite(input, toolId, messageUuid, timestamp, fileChanges);
      break;

    case 'Edit':
      processEdit(input, toolId, messageUuid, timestamp, toolResult, fileChanges);
      break;

    case 'MultiEdit':
      processMultiEdit(input, toolId, messageUuid, timestamp, toolResult, fileChanges);
      break;
  }
}

function processWrite(
  input: Record<string, unknown>,
  toolId: string,
  messageUuid: string,
  timestamp: string,
  fileChanges: FileChange[]
): void {
  const filePath = input.file_path as string;
  const content = input.content as string;
  if (!filePath || content === undefined) return;

  const lines = content.split('\n');
  const lineChanges: LineChange[] = lines.map((line, idx) => ({
    oldLineNumber: null,
    newLineNumber: idx + 1,
    type: 'add' as const,
    content: line,
    changeMarker: '+',
  }));

  fileChanges.push({
    filePath,
    operation: 'write',
    timestamp,
    messageUuid,
    toolName: 'Write',
    toolOperationId: toolId,
    oldContent: '',
    newContent: content,
    lineChanges,
    totalAdditions: lines.length,
    totalDeletions: 0,
    originalToolInput: input,
  });
}

function processEdit(
  input: Record<string, unknown>,
  toolId: string,
  messageUuid: string,
  timestamp: string,
  toolResult: string | null,
  fileChanges: FileChange[]
): void {
  const filePath = input.file_path as string;
  const oldString = input.old_string as string;
  const newString = input.new_string as string;
  if (!filePath || oldString === undefined || newString === undefined) return;

  // Skip if tool reported an error
  if (
    toolResult &&
    (toolResult.includes('<tool_use_error>') || toolResult.startsWith('Error:'))
  ) {
    return;
  }

  const lineChanges = computeDiff(oldString, newString);

  fileChanges.push({
    filePath,
    operation: 'edit',
    timestamp,
    messageUuid,
    toolName: 'Edit',
    toolOperationId: toolId,
    oldContent: oldString,
    newContent: newString,
    lineChanges,
    totalAdditions: lineChanges.filter((l) => l.type === 'add').length,
    totalDeletions: lineChanges.filter((l) => l.type === 'delete').length,
    originalToolInput: input,
  });
}

function processMultiEdit(
  input: Record<string, unknown>,
  toolId: string,
  messageUuid: string,
  timestamp: string,
  toolResult: string | null,
  fileChanges: FileChange[]
): void {
  const filePath = input.file_path as string;
  const edits = input.edits as Array<{ old_string: string; new_string: string }>;
  if (!filePath || !Array.isArray(edits)) return;

  if (
    toolResult &&
    (toolResult.includes('<tool_use_error>') || toolResult.startsWith('Error:'))
  ) {
    return;
  }

  const allOld = edits.map((e) => e.old_string || '').join('\n');
  const allNew = edits.map((e) => e.new_string || '').join('\n');
  const lineChanges = computeDiff(allOld, allNew);

  fileChanges.push({
    filePath,
    operation: 'multi_edit',
    timestamp,
    messageUuid,
    toolName: 'MultiEdit',
    toolOperationId: toolId,
    oldContent: allOld,
    newContent: allNew,
    lineChanges,
    totalAdditions: lineChanges.filter((l) => l.type === 'add').length,
    totalDeletions: lineChanges.filter((l) => l.type === 'delete').length,
    originalToolInput: input,
  });
}

/**
 * 使用 diff 库计算行级差异
 */
function computeDiff(oldStr: string, newStr: string): LineChange[] {
  const changes: LineChange[] = [];
  const patch = Diff.structuredPatch('', '', oldStr, newStr, '', '', {
    context: 3,
  });

  for (const hunk of patch.hunks) {
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        changes.push({
          oldLineNumber: null,
          newLineNumber: newLine,
          type: 'add',
          content: line.substring(1),
          changeMarker: '+',
        });
        newLine++;
      } else if (line.startsWith('-')) {
        changes.push({
          oldLineNumber: oldLine,
          newLineNumber: null,
          type: 'delete',
          content: line.substring(1),
          changeMarker: '-',
        });
        oldLine++;
      } else {
        changes.push({
          oldLineNumber: oldLine,
          newLineNumber: newLine,
          type: 'context',
          content: line.startsWith(' ') ? line.substring(1) : line,
          changeMarker: '',
        });
        oldLine++;
        newLine++;
      }
    }
  }

  return changes;
}
