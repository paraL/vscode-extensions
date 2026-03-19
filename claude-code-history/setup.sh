#!/bin/bash
# Claude Code History Viewer - 一键安装构建脚本
set -e

cd "$(dirname "$0")"

echo "🔧 清理旧文件..."
rm -rf node_modules package-lock.json pnpm-lock.yaml dist

echo "📦 安装依赖..."
npm install

echo "🔨 编译 TypeScript..."
npx tsc --noEmit

echo "📦 esbuild 打包..."
node esbuild.js --production

echo "📦 打包 VSIX..."
npx @vscode/vsce package --allow-missing-repository

echo ""
echo "✅ 构建完成！"
echo "📋 安装插件: code --install-extension claude-code-history-viewer-*.vsix"
