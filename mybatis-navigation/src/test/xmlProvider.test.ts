// @ts-nocheck
import { XmlDefinitionProvider } from '../xmlProvider';
import * as vscode from 'vscode';
import { createMockTextDocument, Uri, Position, Location } from './__mocks__/vscode';

beforeEach(() => {
    jest.clearAllMocks();
});

// Helper to create mock cancellation token
const mockToken = { isCancellationRequested: false, onCancellationRequested: jest.fn() } as any;

describe('XmlDefinitionProvider', () => {
    let provider: XmlDefinitionProvider;

    beforeEach(() => {
        provider = new XmlDefinitionProvider();
    });

    describe('provideDefinition', () => {
        it('should return undefined if no namespace found', async () => {
            const xmlContent = `<?xml version="1.0"?>
<configuration>
    <setting name="test"/>
</configuration>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/config.xml'),
                languageId: 'xml'
            });

            const result = await provider.provideDefinition(doc as any, new Position(1, 5), mockToken);

            expect(result).toBeUndefined();
        });

        it('should return undefined if no word at position', async () => {
            const xmlContent = `<mapper namespace="com.example.UserMapper">
    <select id="selectById">SELECT * FROM user</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            doc.getWordRangeAtPosition = jest.fn().mockReturnValue(undefined);

            const result = await provider.provideDefinition(doc as any, new Position(0, 0), mockToken);

            expect(result).toBeUndefined();
        });

        it('should find Java file when clicking on select id', async () => {
            const xmlContent = `<mapper namespace="com.example.dao.UserMapper">
    <select id="selectById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            const javaUri = Uri.file('/test/UserMapper.java');
            const javaContent = `package com.example.dao;

public interface UserMapper {
    User selectById(Long id);
}`;

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([javaUri]);

            const mockJavaDoc = createMockTextDocument(javaContent, {
                uri: javaUri,
                fileName: '/test/UserMapper.java',
                languageId: 'java'
            });
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockJavaDoc);

            const result = await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(result).toBeDefined();
            expect(result).toBeInstanceOf(Location);
        });

        it('should return undefined if Java file not found', async () => {
            const xmlContent = `<mapper namespace="com.example.NonExistentMapper">
    <select id="selectById">SELECT 1</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/NonExistentMapper.xml'),
                languageId: 'xml'
            });

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

            const result = await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(result).toBeUndefined();
        });

        it('should match Java file by package name', async () => {
            const xmlContent = `<mapper namespace="com.example.dao.UserMapper">
    <select id="findAll">SELECT * FROM user</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            const javaUri1 = Uri.file('/project1/UserMapper.java');
            const javaUri2 = Uri.file('/project2/UserMapper.java');

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([javaUri1, javaUri2]);

            const wrongPackageDoc = createMockTextDocument(`package com.other.dao;
public interface UserMapper {}`, { uri: javaUri1 });

            const correctPackageDoc = createMockTextDocument(`package com.example.dao;
public interface UserMapper {
    List<User> findAll();
}`, { uri: javaUri2 });

            (vscode.workspace.openTextDocument as jest.Mock)
                .mockResolvedValueOnce(wrongPackageDoc)
                .mockResolvedValueOnce(correctPackageDoc);

            const result = await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(result).toBeDefined();
            expect((result as any).uri.fsPath).toBe(javaUri2.fsPath);
        });

        it('should handle insert/update/delete statements', async () => {
            const xmlContent = `<mapper namespace="com.example.UserMapper">
    <insert id="insertUser">INSERT INTO user VALUES(...)</insert>
    <update id="updateUser">UPDATE user SET...</update>
    <delete id="deleteUser">DELETE FROM user...</delete>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            const javaUri = Uri.file('/test/UserMapper.java');
            const javaContent = `package com.example;

public interface UserMapper {
    void insertUser(User user);
    void updateUser(User user);
    void deleteUser(Long id);
}`;

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([javaUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(
                createMockTextDocument(javaContent, { uri: javaUri })
            );

            const result = await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(result).toBeDefined();
        });

        it('should handle namespace with single quotes', async () => {
            const xmlContent = `<mapper namespace='com.example.SingleQuoteMapper'>
    <select id="test">SELECT 1</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/SingleQuoteMapper.xml'),
                languageId: 'xml'
            });

            const javaUri = Uri.file('/test/SingleQuoteMapper.java');
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([javaUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(
                createMockTextDocument(`package com.example;
public interface SingleQuoteMapper {}`, { uri: javaUri })
            );

            await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
                '**/SingleQuoteMapper.java',
                '**/node_modules/**'
            );
        });
    });

    describe('edge cases', () => {
        it('should handle deeply nested packages', async () => {
            const xmlContent = `<mapper namespace="com.company.project.module.submodule.dao.impl.UserMapper">
    <select id="find">SELECT 1</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            const javaUri = Uri.file('/test/UserMapper.java');
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([javaUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(
                createMockTextDocument(`package com.company.project.module.submodule.dao.impl;
public interface UserMapper {}`, { uri: javaUri })
            );

            const result = await provider.provideDefinition(doc as any, new Position(1, 18), mockToken);

            expect(result).toBeDefined();
        });

        it('should handle mapper with extra XML attributes', async () => {
            const xmlContent = `<mapper xmlns="http://mybatis.org/schema" 
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 namespace="com.example.UserMapper">
    <select id="test">SELECT 1</select>
</mapper>`;
            const doc = createMockTextDocument(xmlContent, {
                uri: Uri.file('/test/UserMapper.xml'),
                languageId: 'xml'
            });

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

            await provider.provideDefinition(doc as any, new Position(3, 18), mockToken);

            expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
                '**/UserMapper.java',
                '**/node_modules/**'
            );
        });
    });
});
