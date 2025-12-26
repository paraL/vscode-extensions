# VS Code 插件开发实战指南：MyBatis 导航

欢迎！这篇指南是专门为你准备的，旨在帮助你理解这个 MyBatis 跳转插件是如何从零开始构建的。即使你是 Node.js 新手，也能通过本项目掌握 VS Code 插件开发的核心流程。

## 1. 技术栈 (Tech Stack)

这个项目使用了以下核心技术：

*   **Node.js**: JavaScript 的运行环境。VS Code 插件本身运行在 Node.js 环境中，就像 Java 代码运行在 JVM 里一样。
*   **TypeScript (TS)**: JavaScript 的超集，增加了类型系统。
    *   *为什么用它？* VS Code API 极其庞大且复杂，使用 TypeScript 可以获得完善的代码提示（IntelliSense）。由于 VS Code 本身就是用 TS 写的，官方强烈推荐使用 TS 开发插件。
*   **VS Code Extension API**: 本项目的核心。这是 VS Code 暴露给我们的接口，让我们有能力“告诉”编辑器：当用户按下 Ctrl+Click 时，光标应该跳到哪里。
*   **vsce**: 专门用于打包 VS Code 插件的命令行工具。

## 2. 核心逻辑实现 (How It Works)

我们的目标是实现 **双向跳转** (Go To Definition)。我们没有使用沉重的数据库或复杂的语法树分析，而是使用了轻量级的**正则表达式 (Regex)** 和 **缓存**。

### 2.1 核心组件

1.  **`src/mapperCache.ts` (缓存层)**
    *   **问题**: 如果每次跳转都去扫描整个硬盘的 XML 文件，速度会非常慢。
    *   **解决**: 插件启动时，先扫描一遍项目里所有的 `.xml` 文件，提取 `<mapper namespace="...">`，建立一个映射表：`Map<Namespace, FilePath>`。
    *   **技巧**: 使用 `FileSystemWatcher` 监听文件变化，如果你修改或新建了 XML，缓存会自动更新。

2.  **`src/javaProvider.ts` (从 Java 跳到 XML)**
    *   **触发时机**: 当你在 Java 文件按 `Ctrl` + 鼠标左键（或 F12）时触发。
    *   **逻辑流程**:
        1.  **定位**: 获取当前光标所在的**包名** (`package ...`) 和**类名**。
        2.  **拼接**: 组合成全限定名 (FQCN)，例如 `com.example.UserMapper`。
        3.  **查找**: 去 **Cache** 里问：“谁是 `com.example.UserMapper`？” -> 得到 XML 文件路径。
        4.  **搜索**: 读取 XML 文件内容，用正则 `<select|insert... id="methodName"` 找到对应的方法定义。
        5.  **跳转**: 告诉 VS Code 具体的行号和列号。

3.  **`src/xmlProvider.ts` (从 XML 跳到 Java)**
    *   **触发时机**: 当你在 XML 文件按 `Ctrl` + 鼠标左键时触发。
    *   **逻辑流程**:
        1.  **定位**: 读取当前 XML 头部的 `namespace` 属性，比如 `com.example.UserMapper`。这就知道了目标 Java 类是谁。
        2.  **查找**: 仅仅知道名字还不够，需要找到文件。我们使用 `vscode.workspace.findFiles` 搜索同名的 `.java` 文件。
        3.  **搜索**: 打开目标 Java 文件，用正则匹配方法名 `void selectUser(...)`。
        4.  **跳转**: 返回坐标。

4.  **`src/extension.ts` (入口文件)**
    *   这就是插件的 `main` 函数。
    *   **`activate()`**: 插件激活时执行。在这里我们将上面两个 Provider “注册”给 VS Code，告诉它：“处理 Java 和 XML 文件的跳转请求时，请调用我的逻辑。”

## 3. 开发环境运行 (Run & Debug)

作为开发者，你不需要每次都打包安装。VS Code 提供了极爽的调试体验。

1.  **安装依赖**:
    ```bash
    npm install
    ```
    *   这就好比 Maven 的 `mvn install`。它会根据 `package.json` 下载所有需要的库（比如 typescript, @types/vscode）到 `node_modules` 文件夹。

2.  **启动调试**:
    *   用 VS Code 打开本项目文件夹。
    *   直接按键盘 **`F5`**。
    *   VS Code 会编译代码并弹出一个**新的窗口**（称为 "Extension Development Host"）。在这个新窗口里，你的插件已经生效了，你可以随便打开一个 Java 项目测试跳转功能。

## 4. 编译与打包 (Build & Package)

当你开发完成，想分享给别人（或自己永久安装）时：

1.  **编译 (Compile)**:
    将 TypeScript (`.ts`) 转换成 JavaScript (`.js`)。
    ```bash
    npm run compile
    ```
    *   结果生成在 `dist/` 文件夹。因为 Node.js 只能跑 JS。

2.  **打包 (Package)**:
    我们需要生成 `.vsix` 安装包。
    ```bash
    # 使用 npx 临时运行 vsce 工具，无需全局安装
    npx vsce package
    ```
    *   执行后会生成一个 `.vsix` 文件。
    *   这个文件就是最终产物，你可以把它发给同事，或者在该目录下运行 `code --install-extension xxx.vsix` 进行安装。

## 5. 关键文件结构一览

```text
├── package.json        // [核心] 插件的“身份证”（定义了它叫什么、版本多少、激活时机）
├── tsconfig.json       // TS 编译配置（告诉编译器怎么把 TS 变 JS）
├── src/
│   ├── extension.ts    // 入口：负责注册功能
│   ├── mapperCache.ts  // 负责扫描和建立索引
│   ├── javaProvider.ts // 负责 Java -> XML
│   └── xmlProvider.ts  // 负责 XML -> Java
├── dist/               // [自动生成] 编译后的 JS 代码
├── node_modules/       // [自动生成] 第三方依赖包
└── .gitignore          // 告诉 Git 忽略 dist, node_modules 等此文件
```
