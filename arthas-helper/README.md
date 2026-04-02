# Arthas Helper for VS Code

Arthas Helper 是一款为 VS Code 打造的 Java 诊断辅助插件。如果你经常使用 [Arthas](https://arthas.aliyun.com/en/doc/) 对线上 Java 服务进行诊断追踪，本插件能极大简化你手写类名和方法名的烦恼，只需通过一次简单的右键点击，即可将完美的指令放入系统剪贴板。

## 功能特性 (Features)

- 支持所有主流命令的快捷生成，包括：`watch`, `trace`, `stack`, `monitor`, `tt`, `jad`, `sc`, `sm`。
- **智能对象引用跳转**：右键点击一个处于调用中的方法（如 `xxx.getApplyUserId()`），不会错误地监控当前方法，而是智能转导并算出原始类的坐标。
- **Mybatis-Plus 泛型自动推断**：支持一键在诸如 `baseMapper.selectById()` 代码段上右键，利用源码级别的正则推理，正确找出你配置于 `ServiceImpl<A, B>` 尖括号内部真实的 `XxxMapper` Bean进行追踪。
- **降级后备机制**：即使没有 Java 智能探测服务（Language Server），也能使用最快的本地作用域扫描算法，提取包含光标的当前包裹方法提供监控支持。

---

## 核心实现逻辑剖析 (Implementation Logic)

本插件根据目前开发环境下 VS Code 提供支持的强弱程度，我们创造了一套“三层倒序降级”解析机制 (`src/java-parser.ts`)：

### 1. 策略 A：面向 Mybatis-Plus 及泛型特征的提取术 (Regex & Import Scanning)
当我们的事件钩子发现你选中或停留在 `baseMapper` 或其调用的成员时启动。
- 众所周知，`baseMapper` 是深埋在 `IService` 层底部的，VS Code 的常规智能跳转只会指向 `baomidou` 提供的 `BaseMapper.java`。但这在运行时的 Spring 容器里不能用作 Bean 名称！
- 我们的解法是：直接向当前类签名扫描 `extends ServiceImpl<` 字符序列，利用正则截取出第一个参数，得到类似于 `DeviceTimeAppointmentMapper` 这个纯粹的字符串。
- 拿到了 `DeviceTimeAppointmentMapper` 后，去当前文件头部的全体 `import` 中寻找带该词条的全限定名 (FQN)。只要找到，立刻下发为目标类。

### 2. 策略 B：深度结合 Java Language Server 的能力 (Execute Definition Provider)
当我们确定这不是一个特殊的内置变量，我们就将活儿外包给 RedHat 维护的 Java 解析底层：
- 调用 VS Code 内置高级 API：`vscode.executeDefinitionProvider`。
- 将光标所在位置作为弹药发射出去，请求计算得到“这个变量或者方法的真身定义在哪儿？”。
- 只要拿到了真身 `Location` 目标 URI 链接，系统便隐式地将目标文档在后台挂载并建立符号语法树（`executeDocumentSymbolProvider`）。这种方法天然免除了任何继承或外部三方 `.jar` 包对类型追踪所带来的屏障。

### 3. 策略 C：传统文本后修补法 (AST Regex Fallback)
如果这台机器比较卡顿没有初始化 Language Server，或者语法有错断点跳不过去：
- 我们在当前光标停留处开始逆向循环 (Backward Array Iterator)，寻找能与方法正则表达式 `(public|private).+\(` 吻合的最近一个祖先锚标记。
- 在当前包 `package` 字符串前辍的支持下，返回兜底的备用监测目标：也就是你的光标处在哪个本地文件大方法内，就算做哪个。

---

## 编译运行与打包命令 (Packaging Commands)

如果你需要自行二开或调试这个项目，请确保你安装了最新的 Node.js 环境：

### 安装依赖
```bash
npm install
```

### 调试与构建
```bash
# 执行本地 typescript 校验编译
npm run compile

# 使用 VS Code 直接调试
# -> 点击侧边栏的"运行和调试 (⇧⌘D)"，选择 "Run Extension" ，或是按 F5 唤起虚拟测试机。
```

### 打包发布 (VSIX 生成)
VS Code 官方现在推荐使用 `@vscode/vsce` CLI 工装打包。
在项目根目录，如果你的依赖一切正常，可以使用如下打包指令（此处加 `yes y |` 是为了省略由于没有配置代码公开 repository 链接带来的免责警告询问）：
```bash
yes y | npx @vscode/vsce package
```
*最后会输出类似 ` DONE  Packaged: arthas-helper-0.0.1.vsix (7 files, x.xx KB)`* 此时即可将打包后的文件随意分发并拖拽进任意 VS Code 安装啦。
