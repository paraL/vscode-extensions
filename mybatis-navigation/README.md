# MyBatis Lite Navigation

轻量级、零配置的 VS Code 扩展，支持 MyBatis Mapper 接口与 XML 文件之间的双向导航。

## ✨ 功能特性

- **Java → XML**：在 Mapper 接口方法上 Ctrl+Click，跳转到 XML 文件中对应的 SQL 定义
- **XML → Java**：在 SQL ID 上 Ctrl+Click（如 `<select id="selectUser">`），跳转到 Java 接口中对应的方法
- **边栏图标**：可视化的边栏图标，快速导航

## 📋 环境要求

- VS Code 1.80.0 或更高版本
- 无需任何配置，开箱即用！

## 🔍 工作原理

1. **扫描阶段**：启动时扫描所有 `.xml` 文件，找到 `<mapper namespace="...">` 标签并构建缓存
2. **Java → XML**：根据文件的 package 声明 + 文件名构建全限定类名 (FQCN)，查找对应的 XML 文件和方法
3. **XML → Java**：读取 `namespace` 属性确定目标 Java 类，导航到匹配的方法

## 🛠️ 命令

| 命令 | 说明 |
|------|------|
| `MyBatis Lite Navigation: Refresh Cache` | 手动重新扫描 XML 文件 |

## 📦 安装

### 从 VSIX 安装

```bash
code --install-extension mybatis-lite-navigation-0.0.3.vsix
```

或者在 VS Code 中：**扩展视图 → ⋯ → 从 VSIX 安装...**

## 🔧 开发与打包

```bash
# 安装依赖 + 打包扩展（一条命令搞定）
npm install && npx vsce package
```

## 📄 开源协议

[MIT](LICENSE)
