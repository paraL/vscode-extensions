import { MapperCache } from '../mapperCache';
import * as vscode from 'vscode';

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});

describe('MapperCache', () => {
    describe('constructor', () => {
        it('should create an instance with empty cache', () => {
            const cache = new MapperCache();
            // Cache should be empty before initialization
            expect(cache.getXmlUri('com.example.TestMapper')).toBeUndefined();
        });
    });

    describe('getXmlUri', () => {
        it('should return undefined for non-existent namespace', () => {
            const cache = new MapperCache();
            expect(cache.getXmlUri('com.example.NonExistentMapper')).toBeUndefined();
        });
    });

    describe('refresh', () => {
        it('should clear existing cache before refreshing', async () => {
            const cache = new MapperCache();

            // Mock findFiles to return some XML files
            const mockUri = vscode.Uri.file('/test/TestMapper.xml');
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);

            // Mock openTextDocument to return a document with namespace
            const mockDoc = {
                getText: jest.fn().mockReturnValue('<mapper namespace="com.example.TestMapper"></mapper>'),
                uri: mockUri
            };
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce(mockDoc);

            await cache.refresh();

            expect(vscode.workspace.findFiles).toHaveBeenCalledWith('**/*.xml', '**/node_modules/**');
        });

        it('should parse XML files and extract namespace', async () => {
            const cache = new MapperCache();

            const mockUri = vscode.Uri.file('/test/UserMapper.xml');
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);

            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.dao.UserMapper">
    <select id="selectById">SELECT * FROM user WHERE id = #{id}</select>
</mapper>`;

            const mockDoc = {
                getText: jest.fn().mockReturnValue(xmlContent),
                uri: mockUri
            };
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce(mockDoc);

            await cache.refresh();

            const result = cache.getXmlUri('com.example.dao.UserMapper');
            expect(result).toBeDefined();
            expect(result?.fsPath).toBe(mockUri.fsPath);
        });

        it('should ignore XML files without namespace', async () => {
            const cache = new MapperCache();

            const mockUri = vscode.Uri.file('/test/config.xml');
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);

            // Non-mapper XML
            const xmlContent = `<?xml version="1.0"?><configuration><setting name="test"/></configuration>`;

            const mockDoc = {
                getText: jest.fn().mockReturnValue(xmlContent),
                uri: mockUri
            };
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce(mockDoc);

            await cache.refresh();

            // Should not have any mappings
            expect(cache.getXmlUri('configuration')).toBeUndefined();
        });

        it('should handle multiple XML files', async () => {
            const cache = new MapperCache();

            const mockUri1 = vscode.Uri.file('/test/UserMapper.xml');
            const mockUri2 = vscode.Uri.file('/test/OrderMapper.xml');

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri1, mockUri2]);

            (vscode.workspace.openTextDocument as jest.Mock)
                .mockResolvedValueOnce({
                    getText: jest.fn().mockReturnValue('<mapper namespace="com.example.UserMapper"></mapper>'),
                    uri: mockUri1
                })
                .mockResolvedValueOnce({
                    getText: jest.fn().mockReturnValue('<mapper namespace="com.example.OrderMapper"></mapper>'),
                    uri: mockUri2
                });

            await cache.refresh();

            expect(cache.getXmlUri('com.example.UserMapper')).toBeDefined();
            expect(cache.getXmlUri('com.example.OrderMapper')).toBeDefined();
        });
    });

    describe('initialize', () => {
        it('should call refresh and start watcher', async () => {
            const cache = new MapperCache();

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([]);

            await cache.initialize();

            expect(vscode.workspace.findFiles).toHaveBeenCalled();
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('**/*.xml');
        });
    });

    describe('namespace regex patterns', () => {
        it('should match namespace with double quotes', async () => {
            const cache = new MapperCache();
            const mockUri = vscode.Uri.file('/test/Mapper.xml');

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce({
                getText: jest.fn().mockReturnValue('<mapper namespace="com.test.MyMapper">'),
                uri: mockUri
            });

            await cache.refresh();
            expect(cache.getXmlUri('com.test.MyMapper')).toBeDefined();
        });

        it('should match namespace with single quotes', async () => {
            const cache = new MapperCache();
            const mockUri = vscode.Uri.file('/test/Mapper.xml');

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce({
                getText: jest.fn().mockReturnValue("<mapper namespace='com.test.MyMapper'>"),
                uri: mockUri
            });

            await cache.refresh();
            expect(cache.getXmlUri('com.test.MyMapper')).toBeDefined();
        });

        it('should match namespace with extra attributes', async () => {
            const cache = new MapperCache();
            const mockUri = vscode.Uri.file('/test/Mapper.xml');

            (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockUri]);
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce({
                getText: jest.fn().mockReturnValue('<mapper xmlns="..." namespace="com.test.MyMapper" id="test">'),
                uri: mockUri
            });

            await cache.refresh();
            expect(cache.getXmlUri('com.test.MyMapper')).toBeDefined();
        });
    });
});
