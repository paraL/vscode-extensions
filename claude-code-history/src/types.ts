/** Unified session metadata */
export interface Session {
  sessionId: string;
  projectPath: string;
  title: string;
  startTime: string;
  endTime: string;
  messageCount: number;
  filePath: string; // path to the JSONL file
  cwd?: string; // real working directory from JSONL
  source: 'claude';
}

/** A single content block within a message */
export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
}

/** Parsed message from JSONL */
export interface ParsedMessage {
  uuid: string;
  parentUuid?: string | null;
  type: 'human' | 'assistant' | 'user' | 'system';
  timestamp: string;
  sessionId: string;
  cwd?: string;
  message: {
    role: string;
    content: string | ContentBlock[];
    model?: string;
    id?: string;
    usage?: TokenUsage;
    stop_reason?: string;
  };
  isSidechain?: boolean;
  toolUseResult?: {
    content?: string;
    structuredPatch?: unknown;
  };
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Line-level change for diff display */
export interface LineChange {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'add' | 'delete' | 'context' | 'modify';
  content: string;
  changeMarker: string; // '+', '-', or ''
}

/** File change extracted from tool_use messages */
export interface FileChange {
  filePath: string;
  operation: 'read' | 'write' | 'edit' | 'multi_edit' | 'create';
  timestamp: string;
  messageUuid: string;
  toolName: string;
  toolOperationId: string;
  oldContent?: string;
  newContent?: string;
  lineChanges: LineChange[];
  totalAdditions: number;
  totalDeletions: number;
  originalToolInput?: Record<string, unknown>;
}

/** Full session data with messages */
export interface SessionDetail {
  session: Session;
  messages: ParsedMessage[];
  fileChanges: FileChange[];
}

/** Search result */
export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  projectPath: string;
  timestamp: string;
  matchedText: string;
  messageUuid: string;
  messageType: string;
}

/** Messages sent from webview to extension */
export type WebviewMessage =
  | { command: 'getSessions'; projectFilter?: string }
  | { command: 'getSessionDetail'; filePath: string }
  | { command: 'search'; query: string }
  | { command: 'showDiff'; fileChange: FileChange }
  | { command: 'applyChanges'; fileChange: FileChange }
  | { command: 'openFile'; filePath: string }
  | { command: 'refresh' }
  | { command: 'getProjects' }
  | { command: 'exportMarkdown'; filePath: string }
  | { command: 'resumeSession'; sessionId: string; cwd?: string };

/** Messages sent from extension to webview */
export type ExtensionMessage =
  | { command: 'sessionsLoaded'; sessions: Session[]; currentProject?: string }
  | { command: 'sessionDetailLoaded'; detail: SessionDetail }
  | { command: 'searchResults'; results: SearchResult[] }
  | { command: 'projectsLoaded'; projects: string[]; currentProject?: string }
  | { command: 'error'; message: string }
  | { command: 'loading'; loading: boolean };
