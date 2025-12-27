// @ts-nocheck
import { GutterIconProvider } from '../gutterProvider';
import { MapperCache } from '../mapperCache';
import * as vscode from 'vscode';
import {
    createMockTextDocument,
    createMockExtensionContext,
    Uri,
    Selection
} from './__mocks__/vscode';

describe('GutterIconProvider', () => {
    let mockCache: MapperCache;
    let mockContext: any;
    let provider: GutterIconProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCache = new MapperCache();
        mockContext = createMockExtensionContext();

        // Mock activeTextEditor to be undefined initially
        (vscode.window as any).activeTextEditor = undefined;

        provider = new GutterIconProvider(mockContext, mockCache);
    });

    describe('constructor', () => {
        it('should create decoration types', () => {
            // Constructor was called in beforeEach, verify decorations were created
            expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
        });
    });

    describe('updateDecorations', () => {
        it('should not process non-Java/XML files', async () => {
            const doc = createMockTextDocument('const x = 1;', {
                uri: Uri.file('/test/script.js'),
                languageId: 'javascript'
            });

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            expect(mockEditor.setDecorations).not.toHaveBeenCalled();
        });
    });

    describe('decorateJavaFile', () => {
        it('should clear decorations if no XML found', async () => {
            const javaContent = `package com.example;

public interface UnmappedMapper {
    void method();
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/UnmappedMapper.java'),
                fileName: '/test/UnmappedMapper.java',
                languageId: 'java'
            });

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(undefined);

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
        });

        it('should not add decorations if no package declaration', async () => {
            const javaContent = `public class NoPackage {
    void method() {}
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/NoPackage.java'),
                fileName: '/test/NoPackage.java',
                languageId: 'java'
            });

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            // Should return early without calling setDecorations
            expect(mockEditor.setDecorations).not.toHaveBeenCalled();
        });

        it('should add decorations for methods in Java Mapper', async () => {
            const javaContent = `package com.example.dao;

public interface UserMapper {
    User selectById(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/UserMapper.java'),
                fileName: '/test/UserMapper.java',
                languageId: 'java'
            });

            const xmlUri = Uri.file('/test/UserMapper.xml');
            const xmlContent = `<mapper namespace="com.example.dao.UserMapper">
    <select id="selectById">SELECT * FROM user</select>
</mapper>`;

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(xmlUri as any);

            const mockXmlDoc = createMockTextDocument(xmlContent, { uri: xmlUri });
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockXmlDoc);

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            expect(mockEditor.setDecorations).toHaveBeenCalled();
        });
    });

    describe('decorateXmlFile', () => {
        it('should clear decorations if no namespace in XML', async () => {
            const xmlContent = `<configuration>
    <setting name="test"/>
</configuration>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/config.xml'),
                fileName: '/test/config.xml',
                languageId: 'xml'
            });

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
        });

        it('should clear decorations if Java file not found', async () => {
            const xmlContent = `<mapper namespace="com.example.NonExistentMapper">
    <select id="test">SELECT 1</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/NonExistentMapper.xml'),
                fileName: '/test/NonExistentMapper.xml',
                languageId: 'xml'
            });

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

            const mockEditor = {
                document: doc,
                selection: new Selection(0, 0, 0, 0),
                setDecorations: jest.fn(),
                revealRange: jest.fn()
            };

            await provider.updateDecorations(mockEditor as any);

            expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
        });
    });

    describe('getJumpTarget', () => {
        it('should return undefined for unknown URI', () => {
            const result = provider.getJumpTarget('file:///unknown/file.java', 0);
            expect(result).toBeUndefined();
        });
    });
});
