import { TextDocument, Position, commands, DocumentSymbol, SymbolKind, Location, workspace } from 'vscode';
import { ArthasCommandContext } from './arthas-commands';

export async function parseJavaContext(document: TextDocument, position: Position): Promise<ArthasCommandContext | null> {
    const text = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const word = wordRange ? document.getText(wordRange) : '';

    // 策略 2: baseMapper resolution (Mybatis-Plus)
    if (word === 'baseMapper' || isWordPrecededByBaseMapper(document, position, word)) {
        const extendsMatch = text.match(/extends\s+ServiceImpl\s*<\s*([A-Za-z0-9_]+)\s*,/);
        if (extendsMatch && extendsMatch[1]) {
            const mapperClassName = extendsMatch[1];
            const fqn = resolveImport(text, mapperClassName);
            const method = word !== 'baseMapper' ? word : '*';
            return { className: fqn, methodName: method };
        }
    }

    // 策略 1: Definition Provider for external method references
    if (word) {
        try {
            const definitions = await commands.executeCommand<Location[] | Location>(
                'vscode.executeDefinitionProvider',
                document.uri,
                position
            );
            
            const defArray = Array.isArray(definitions) ? definitions : (definitions ? [definitions] : []);
            
            if (defArray && defArray.length > 0) {
                const defPos = defArray[0];
                const defDoc = await workspace.openTextDocument(defPos.uri);
                
                // If it jumps out to another place (or even same file but a target method), 
                // we can read its enclosing context.
                const defContext = await getEnclosingContext(defDoc, defPos.range.start);
                if (defContext && defContext.className) {
                    return { 
                        className: defContext.className, 
                        // If we clicked on a method, the symbol provider of the target will say methodName=word.
                        methodName: defContext.methodName || word 
                    };
                }
            }
        } catch (e) {
            console.error('Failed to execute DefinitionProvider', e);
        }
    }
    
    // 策略 3: Local context backward fallback (Original logic)
    return getEnclosingContext(document, position);
}

function isWordPrecededByBaseMapper(document: TextDocument, position: Position, word: string): boolean {
    const lineText = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return false;
    
    const untilWord = lineText.substring(0, wordRange.start.character);
    return /baseMapper\s*\.\s*$/.test(untilWord);
}

function resolveImport(text: string, className: string): string {
    const regex = new RegExp(`import\\s+([a-zA-Z0-9_.]+\\.${className})\\s*;`);
    const match = text.match(regex);
    if (match && match[1]) {
        return match[1];
    }
    const packageMatch = text.match(/package\s+([\w.]+)\s*;/);
    if (packageMatch && packageMatch[1]) {
        return `${packageMatch[1]}.${className}`;
    }
    return className;
}

async function getEnclosingContext(document: TextDocument, position: Position): Promise<ArthasCommandContext | null> {
    const text = document.getText();
    let packageName = '';
    const packageMatch = text.match(/package\s+([\w.]+)\s*;/);
    if (packageMatch && packageMatch[1]) {
        packageName = packageMatch[1];
    }

    try {
        const symbols = await commands.executeCommand<DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );
        
        if (symbols && symbols.length > 0) {
            const context = findContextFromSymbols(symbols, position, packageName);
            if (context && context.className) {
                return context;
            }
        }
    } catch (e) {}

    return fallbackRegexParser(document, position, packageName);
}

function findContextFromSymbols(symbols: DocumentSymbol[], position: Position, packageName: string): ArthasCommandContext | null {
    let currentClass: string | null = null;
    let currentMethod: string | undefined = undefined;

    for (const symbol of symbols) {
        if (symbol.range.contains(position)) {
            if (symbol.kind === SymbolKind.Class || symbol.kind === SymbolKind.Interface || symbol.kind === SymbolKind.Enum) {
                currentClass = packageName ? `${packageName}.${symbol.name}` : symbol.name;
            }
            
            if (symbol.children && symbol.children.length > 0) {
                const childContext = findContextFromSymbols(symbol.children, position, packageName);
                if (childContext) {
                    if (!childContext.className && currentClass) {
                        childContext.className = currentClass;
                    }
                    return childContext;
                }
            }
            
            if (symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Constructor) {
                currentMethod = symbol.name;
                if (symbol.kind === SymbolKind.Constructor) {
                    currentMethod = '<init>'; 
                }
                if (currentClass) {
                   return { className: currentClass, methodName: currentMethod };
                }
            }
        }
    }
    
    if (currentClass || currentMethod) {
        return { className: currentClass || '', methodName: currentMethod };
    }

    return null;
}

function fallbackRegexParser(document: TextDocument, position: Position, packageName: string): ArthasCommandContext | null {
    const text = document.getText();
    
    let className = '';
    const classMatch = text.match(/(?:public|protected|private)?\s*(?:static\s+|final\s+|abstract\s+)*\s*(?:class|interface|enum)\s+(\w+)/);
    if (classMatch && classMatch[1]) {
        className = packageName ? `${packageName}.${classMatch[1]}` : classMatch[1];
    }

    if (!className) {
        return null;
    }

    let methodName: string | undefined = undefined;
    for (let i = position.line; i >= 0; i--) {
        const line = document.lineAt(i).text.trim();
        if (line.includes(';') || line === '{' || line === '}') continue;
        
        const methodMatch = line.match(/(?:public|protected|private)?\s*(?:static\s+|final\s+|abstract\s+|synchronized\s+)*\s*[\w<>\[\]]+\s+(\w+)\s*\(/);
        if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'catch', 'switch'].includes(methodMatch[1])) {
            methodName = methodMatch[1];
            break;
        }
    }

    return { className, methodName };
}
