# Changelog

All notable changes to the "MyBatis Lite Navigation" extension will be documented in this file.

## [0.0.4] - 2025-12-27

### Added

- **Gutter 图标导航功能**
  - 在 Java Mapper 方法行显示 XML 跳转图标
  - 在 XML SQL 语句行 (select/insert/update/delete) 显示 Java 跳转图标
  - 悬停可查看目标信息，支持 `mybatis-lite.gotoMapper` 命令跳转

- **完整的单元测试覆盖**
  - 新增 Jest + ts-jest 测试框架配置
  - 覆盖 `MapperCache`、`JavaDefinitionProvider`、`XmlDefinitionProvider`、`GutterIconProvider` 核心模块
  - 创建完整的 VSCode API Mock 实现

### Fixed

- **性能优化：修复 `decorateJavaFile` 重复打开 XML 文档的问题**
  - 将 `openTextDocument(xmlUri)` 调用移至循环外部，避免 N 次重复打开同一文件

- **资源管理：添加 `MapperCache.dispose()` 方法**
  - FileSystemWatcher 现在会被正确保存并在扩展卸载时释放

---

## [0.0.2] - 2025-12-27

### Fixed

- **修复 Java Mapper → XML 首次跳转失败的问题**
  - 根因：`MapperCache` 的 `refresh()` 是异步操作，但在构造函数中调用时未等待完成，导致扩展激活后缓存仍为空
  - 修复：将初始化逻辑移至显式的 `initialize()` 方法，并在 `extension.ts` 中使用 `await` 确保缓存加载完成后再注册 DefinitionProvider

### Added

- 添加调试日志，便于追踪缓存加载状态

---

## [0.0.1] - 2025-12-26

### Added

- 初始版本发布
- 支持 Java Mapper 接口 → XML Mapper 文件的跳转 (Ctrl+Click / F12)
- 支持 XML Mapper 文件 → Java Mapper 接口的跳转
- 自动扫描 workspace 中的 XML mapper 文件并建立缓存
- 文件变更监听，自动更新缓存
- 手动刷新缓存命令：`MyBatis: Refresh Cache`
