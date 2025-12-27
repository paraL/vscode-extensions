// @ts-nocheck
import { JavaDefinitionProvider } from '../javaProvider';
import { MapperCache } from '../mapperCache';
import * as vscode from 'vscode';
import { createMockTextDocument, Uri, Position, Location } from './__mocks__/vscode';

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});

// Helper to create mock cancellation token
const mockToken = { isCancellationRequested: false, onCancellationRequested: jest.fn() } as any;

describe('JavaDefinitionProvider', () => {
    let mockCache: MapperCache;
    let provider: JavaDefinitionProvider;

    beforeEach(() => {
        mockCache = new MapperCache();
        provider = new JavaDefinitionProvider(mockCache);
    });

    describe('provideDefinition', () => {
        it('should return undefined if no word range at position', async () => {
            const doc = createMockTextDocument('', {
                fileName: '/test/TestMapper.java',
                languageId: 'java'
            });
            doc.getWordRangeAtPosition = jest.fn().mockReturnValue(undefined);

            const result = await provider.provideDefinition(doc as any, new Position(0, 0), mockToken);

            expect(result).toBeUndefined();
        });

        it('should return undefined if no package declaration found', async () => {
            const javaContent = `
public interface TestMapper {
    User selectById(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                fileName: '/test/TestMapper.java',
                languageId: 'java'
            });

            const result = await provider.provideDefinition(doc as any, new Position(2, 10), mockToken);

            expect(result).toBeUndefined();
        });

        it('should return undefined if no XML found in cache', async () => {
            const javaContent = `package com.example.mapper;

public interface TestMapper {
    User selectById(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/TestMapper.java'),
                fileName: '/test/TestMapper.java',
                languageId: 'java'
            });

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(undefined);

            const result = await provider.provideDefinition(doc as any, new Position(3, 10), mockToken);

            expect(result).toBeUndefined();
        });

        it('should return location when XML and method found', async () => {
            const javaContent = `package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/UserMapper.java'),
                fileName: '/test/UserMapper.java',
                languageId: 'java'
            });

            const xmlUri = Uri.file('/test/UserMapper.xml');
            const xmlContent = `<?xml version="1.0"?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(xmlUri as any);

            const mockXmlDoc = createMockTextDocument(xmlContent, {
                uri: xmlUri,
                fileName: '/test/UserMapper.xml',
                languageId: 'xml'
            });
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockXmlDoc);

            const result = await provider.provideDefinition(doc as any, new Position(3, 10), mockToken);

            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(Location);
            expect((result as any).uri.fsPath).toBe(xmlUri.fsPath);
        });

        it('should return file top if method not found in XML', async () => {
            const javaContent = `package com.example.mapper;

public interface UserMapper {
    User nonExistentMethod(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/UserMapper.java'),
                fileName: '/test/UserMapper.java',
                languageId: 'java'
            });

            const xmlUri = Uri.file('/test/UserMapper.xml');
            const xmlContent = `<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">SELECT * FROM user</select>
</mapper>`;

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(xmlUri as any);

            const mockXmlDoc = createMockTextDocument(xmlContent, {
                uri: xmlUri,
                fileName: '/test/UserMapper.xml',
                languageId: 'xml'
            });
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockXmlDoc);

            const result = await provider.provideDefinition(doc as any, new Position(3, 10), mockToken);

            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(Location);
            expect((result as any).uri.fsPath).toBe(xmlUri.fsPath);
        });

        it('should correctly parse package and class name from file path', async () => {
            const javaContent = `package com.mycompany.project.dao;

public interface OrderMapper {
    Order findById(Long id);
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/src/main/java/com/mycompany/project/dao/OrderMapper.java'),
                fileName: '/src/main/java/com/mycompany/project/dao/OrderMapper.java',
                languageId: 'java'
            });

            const xmlUri = Uri.file('/src/main/resources/mapper/OrderMapper.xml');
            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(xmlUri as any);

            const mockXmlDoc = createMockTextDocument('<mapper namespace="com.mycompany.project.dao.OrderMapper"></mapper>', {
                uri: xmlUri
            });
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockXmlDoc);

            await provider.provideDefinition(doc as any, new Position(3, 10), mockToken);

            expect(mockCache.getXmlUri).toHaveBeenCalledWith('com.mycompany.project.dao.OrderMapper');
        });
    });

    describe('edge cases', () => {
        it('should handle Java file with multiple classes', async () => {
            const javaContent = `package com.example;

public interface MainMapper {
    void method1();
}

class HelperClass {
    void helper() {}
}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/MainMapper.java'),
                fileName: '/test/MainMapper.java',
                languageId: 'java'
            });

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(undefined);

            await provider.provideDefinition(doc as any, new Position(3, 10), mockToken);

            expect(mockCache.getXmlUri).toHaveBeenCalledWith('com.example.MainMapper');
        });

        it('should handle package names with numbers', async () => {
            const javaContent = `package com.example.v2.mapper;

public interface TestMapper {}`;
            const doc = createMockTextDocument(javaContent, {
                uri: Uri.file('/test/TestMapper.java'),
                fileName: '/test/TestMapper.java',
                languageId: 'java'
            });

            jest.spyOn(mockCache, 'getXmlUri').mockReturnValue(undefined);

            await provider.provideDefinition(doc as any, new Position(2, 20), mockToken);

            expect(mockCache.getXmlUri).toHaveBeenCalledWith('com.example.v2.mapper.TestMapper');
        });
    });
});
