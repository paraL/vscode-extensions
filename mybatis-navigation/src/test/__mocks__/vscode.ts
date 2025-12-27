/**
 * VSCode API Mock for unit testing
 * This provides minimal mock implementations of the VSCode API
 */

// Mock Uri class
export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
        this.fsPath = path.replace(/\//g, '\\');
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        const match = value.match(/^([^:]+):\/\/([^/]*)(.*)$/);
        if (match) {
            return new Uri(match[1], match[2], match[3], '', '');
        }
        return new Uri('file', '', value, '', '');
    }

    toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        );
    }
}

// Mock Position class
export class Position {
    constructor(
        readonly line: number,
        readonly character: number
    ) { }

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(
            this.line + (lineDelta ?? 0),
            this.character + (characterDelta ?? 0)
        );
    }

    with(line?: number, character?: number): Position {
        return new Position(line ?? this.line, character ?? this.character);
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }

    isAfter(other: Position): boolean {
        return this.line > other.line || (this.line === other.line && this.character > other.character);
    }

    compareTo(other: Position): number {
        if (this.isBefore(other)) return -1;
        if (this.isAfter(other)) return 1;
        return 0;
    }
}

// Mock Range class
export class Range {
    readonly start: Position;
    readonly end: Position;

    constructor(start: Position, end: Position);
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(
        startOrStartLine: Position | number,
        endOrStartCharacter: Position | number,
        endLine?: number,
        endCharacter?: number
    ) {
        if (typeof startOrStartLine === 'number') {
            this.start = new Position(startOrStartLine, endOrStartCharacter as number);
            this.end = new Position(endLine!, endCharacter!);
        } else {
            this.start = startOrStartLine;
            this.end = endOrStartCharacter as Position;
        }
    }

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    get isSingleLine(): boolean {
        return this.start.line === this.end.line;
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Position) {
            return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
        }
        return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }
}

// Mock Selection class
export class Selection extends Range {
    readonly anchor: Position;
    readonly active: Position;

    constructor(anchor: Position, active: Position);
    constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);
    constructor(
        anchorOrAnchorLine: Position | number,
        activeOrAnchorCharacter: Position | number,
        activeLine?: number,
        activeCharacter?: number
    ) {
        if (typeof anchorOrAnchorLine === 'number') {
            const anchor = new Position(anchorOrAnchorLine, activeOrAnchorCharacter as number);
            const active = new Position(activeLine!, activeCharacter!);
            super(anchor, active);
            this.anchor = anchor;
            this.active = active;
        } else {
            super(anchorOrAnchorLine, activeOrAnchorCharacter as Position);
            this.anchor = anchorOrAnchorLine;
            this.active = activeOrAnchorCharacter as Position;
        }
    }

    get isReversed(): boolean {
        return this.anchor.isAfter(this.active);
    }
}

// Mock Location class
export class Location {
    constructor(
        readonly uri: Uri,
        readonly range: Range | Position
    ) { }
}

// Mock TextDocument interface
export interface TextDocument {
    readonly uri: Uri;
    readonly fileName: string;
    readonly languageId: string;
    readonly version: number;
    readonly isDirty: boolean;
    readonly isUntitled: boolean;
    readonly lineCount: number;
    getText(range?: Range): string;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    lineAt(line: number): TextLine;
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
}

// Mock TextLine interface
export interface TextLine {
    readonly lineNumber: number;
    readonly text: string;
    readonly range: Range;
    readonly rangeIncludingLineBreak: Range;
    readonly firstNonWhitespaceCharacterIndex: number;
    readonly isEmptyOrWhitespace: boolean;
}

// Mock TextEditor interface
export interface TextEditor {
    readonly document: TextDocument;
    selection: Selection;
    selections: Selection[];
    setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: Range[] | DecorationOptions[]): void;
    revealRange(range: Range, revealType?: TextEditorRevealType): void;
}

// Mock TextEditorDecorationType interface
export interface TextEditorDecorationType {
    readonly key: string;
    dispose(): void;
}

// Mock DecorationOptions interface
export interface DecorationOptions {
    range: Range;
    hoverMessage?: string | MarkdownString;
    renderOptions?: DecorationInstanceRenderOptions;
}

// Mock MarkdownString class
export class MarkdownString {
    value: string;
    isTrusted?: boolean;

    constructor(value?: string, supportThemeIcons?: boolean) {
        this.value = value ?? '';
    }

    appendText(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendMarkdown(value: string): MarkdownString {
        this.value += value;
        return this;
    }
}

// Mock DecorationInstanceRenderOptions interface
export interface DecorationInstanceRenderOptions {
    before?: ThemableDecorationAttachmentRenderOptions;
    after?: ThemableDecorationAttachmentRenderOptions;
}

// Mock ThemableDecorationAttachmentRenderOptions interface
export interface ThemableDecorationAttachmentRenderOptions {
    contentText?: string;
    contentIconPath?: Uri | string;
    border?: string;
    borderColor?: string;
    color?: string;
    backgroundColor?: string;
    textDecoration?: string;
}

// Mock TextEditorRevealType enum
export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
}

// Mock CancellationToken interface
export interface CancellationToken {
    readonly isCancellationRequested: boolean;
    readonly onCancellationRequested: Event<any>;
}

// Mock Event interface
export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
}

// Mock Disposable class
export class Disposable {
    constructor(private callOnDispose: () => any) { }

    static from(...disposables: { dispose(): any }[]): Disposable {
        return new Disposable(() => {
            disposables.forEach(d => d.dispose());
        });
    }

    dispose(): any {
        return this.callOnDispose();
    }
}

// Mock ExtensionContext interface
export interface ExtensionContext {
    readonly extensionPath: string;
    readonly extensionUri: Uri;
    readonly globalStoragePath: string;
    readonly globalStorageUri: Uri;
    readonly logPath: string;
    readonly logUri: Uri;
    readonly storagePath: string | undefined;
    readonly storageUri: Uri | undefined;
    readonly subscriptions: Disposable[];
    readonly workspaceState: Memento;
    readonly globalState: Memento & { setKeysForSync(keys: string[]): void };
    readonly extensionMode: ExtensionMode;
    asAbsolutePath(relativePath: string): string;
}

// Mock Memento interface
export interface Memento {
    keys(): readonly string[];
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    update(key: string, value: any): Thenable<void>;
}

// Mock ExtensionMode enum
export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
}

// Mock FileSystemWatcher interface
export interface FileSystemWatcher extends Disposable {
    readonly ignoreCreateEvents: boolean;
    readonly ignoreChangeEvents: boolean;
    readonly ignoreDeleteEvents: boolean;
    readonly onDidCreate: Event<Uri>;
    readonly onDidChange: Event<Uri>;
    readonly onDidDelete: Event<Uri>;
}

// Mock DefinitionProvider interface
export interface DefinitionProvider {
    provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): ProviderResult<Definition | DefinitionLink[]>;
}

// Type aliases
export type Definition = Location | Location[];
export type DefinitionLink = LocationLink;
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

// Mock LocationLink interface
export interface LocationLink {
    originSelectionRange?: Range;
    targetUri: Uri;
    targetRange: Range;
    targetSelectionRange?: Range;
}

// Mock DocumentSelector type
export type DocumentSelector = DocumentFilter | string | readonly (DocumentFilter | string)[];

// Mock DocumentFilter interface
export interface DocumentFilter {
    readonly language?: string;
    readonly scheme?: string;
    readonly pattern?: GlobPattern;
}

// Mock GlobPattern type
export type GlobPattern = string | RelativePattern;

// Mock RelativePattern class
export class RelativePattern {
    constructor(
        readonly base: string | Uri | WorkspaceFolder,
        readonly pattern: string
    ) { }
}

// Mock WorkspaceFolder interface
export interface WorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
    readonly index: number;
}

// ============= Mock workspace namespace =============
export const workspace = {
    findFiles: jest.fn().mockResolvedValue([]),
    openTextDocument: jest.fn().mockImplementation((uri: Uri | string) => {
        const mockDoc: Partial<TextDocument> = {
            uri: typeof uri === 'string' ? Uri.file(uri) : uri,
            fileName: typeof uri === 'string' ? uri : uri.fsPath,
            getText: jest.fn().mockReturnValue(''),
            positionAt: jest.fn().mockImplementation((offset: number) => new Position(0, offset)),
            languageId: 'java'
        };
        return Promise.resolve(mockDoc);
    }),
    createFileSystemWatcher: jest.fn().mockImplementation(() => ({
        onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        dispose: jest.fn()
    })),
    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() })
};

// ============= Mock window namespace =============
export const window = {
    activeTextEditor: undefined as TextEditor | undefined,
    showTextDocument: jest.fn().mockImplementation((doc: TextDocument) => {
        const mockEditor: Partial<TextEditor> = {
            document: doc,
            selection: new Selection(0, 0, 0, 0),
            selections: [new Selection(0, 0, 0, 0)],
            setDecorations: jest.fn(),
            revealRange: jest.fn()
        };
        return Promise.resolve(mockEditor);
    }),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createTextEditorDecorationType: jest.fn().mockImplementation(() => ({
        key: 'mock-decoration-type',
        dispose: jest.fn()
    })),
    onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() })
};

// ============= Mock languages namespace =============
export const languages = {
    registerDefinitionProvider: jest.fn().mockReturnValue({ dispose: jest.fn() })
};

// ============= Mock commands namespace =============
export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn()
};

// ============= Helper to create mock TextDocument =============
export function createMockTextDocument(
    content: string,
    options?: {
        uri?: Uri;
        languageId?: string;
        fileName?: string;
    }
): TextDocument {
    const lines = content.split('\n');
    const uri = options?.uri ?? Uri.file('/mock/file.java');

    return {
        uri,
        fileName: options?.fileName ?? uri.fsPath,
        languageId: options?.languageId ?? 'java',
        version: 1,
        isDirty: false,
        isUntitled: false,
        lineCount: lines.length,
        getText: (range?: Range) => {
            if (!range) return content;
            const startOffset = lines.slice(0, range.start.line).join('\n').length + range.start.character;
            const endOffset = lines.slice(0, range.end.line).join('\n').length + range.end.character;
            return content.substring(startOffset, endOffset);
        },
        positionAt: (offset: number) => {
            let line = 0;
            let remaining = offset;
            for (const l of lines) {
                if (remaining <= l.length) {
                    return new Position(line, remaining);
                }
                remaining -= l.length + 1; // +1 for newline
                line++;
            }
            return new Position(lines.length - 1, lines[lines.length - 1].length);
        },
        offsetAt: (position: Position) => {
            let offset = 0;
            for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1;
            }
            return offset + position.character;
        },
        lineAt: (line: number) => ({
            lineNumber: line,
            text: lines[line] ?? '',
            range: new Range(line, 0, line, (lines[line] ?? '').length),
            rangeIncludingLineBreak: new Range(line, 0, line + 1, 0),
            firstNonWhitespaceCharacterIndex: (lines[line] ?? '').search(/\S/),
            isEmptyOrWhitespace: (lines[line] ?? '').trim().length === 0
        }),
        getWordRangeAtPosition: (position: Position, regex?: RegExp) => {
            const lineText = lines[position.line] ?? '';
            const wordRegex = regex ?? /\w+/g;
            let match;
            while ((match = wordRegex.exec(lineText)) !== null) {
                if (match.index <= position.character && match.index + match[0].length >= position.character) {
                    return new Range(
                        position.line, match.index,
                        position.line, match.index + match[0].length
                    );
                }
            }
            return undefined;
        }
    };
}

// ============= Helper to create mock ExtensionContext =============
export function createMockExtensionContext(): ExtensionContext {
    return {
        extensionPath: '/mock/extension',
        extensionUri: Uri.file('/mock/extension'),
        globalStoragePath: '/mock/global',
        globalStorageUri: Uri.file('/mock/global'),
        logPath: '/mock/log',
        logUri: Uri.file('/mock/log'),
        storagePath: '/mock/storage',
        storageUri: Uri.file('/mock/storage'),
        subscriptions: [],
        workspaceState: {
            keys: () => [],
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined)
        },
        globalState: {
            keys: () => [],
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            setKeysForSync: jest.fn()
        },
        extensionMode: ExtensionMode.Test,
        asAbsolutePath: (relativePath: string) => `/mock/extension/${relativePath}`
    };
}
