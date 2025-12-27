# Changelog

All notable changes to the "MyBatis Lite Navigation" extension will be documented in this file.

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
