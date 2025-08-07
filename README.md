# Claude Workbench

> 专业的 Claude CLI 桌面管理工具，支持多平台

[![Release](https://img.shields.io/github/v/release/anyme123/claude-workbench?color=brightgreen)](https://github.com/anyme123/claude-workbench/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/anyme123/claude-workbench)

## ✨ 特性

### 🎯 核心功能
- **项目管理**: 可视化管理 Claude 项目，支持会话历史和检查点
- **实时交互**: 流式显示 Claude 响应，支持 Markdown 渲染和语法高亮
- **智能代理**: Agent 系统支持 GitHub 集成和自动化任务执行
- **MCP 支持**: 完整的 Model Context Protocol 服务器管理

### 🔧 代理商管理（主要功能）
- **一键切换**: 静默切换不同的 Claude API 代理商，无弹窗干扰
- **隐私安全**: 本地存储配置，零硬编码敏感信息
- **自由配置**: 完整的 CRUD 操作界面，支持自定义代理商
- **立即生效**: 自动重启 Claude 进程，配置立即生效
- **智能识别**: 自动检测和显示当前使用的配置

### 🌟 用户体验
- **多语言支持**: 中文优先的国际化界面
- **主题切换**: 支持明暗主题，使用 OKLCH 色彩空间
- **响应式设计**: 适配不同屏幕尺寸的桌面应用
- **键盘快捷键**: 丰富的快捷键支持，提升操作效率

## 🚀 快速开始

### 系统要求

- **操作系统**: Windows 10/11 (64位)
- **Node.js**: 18.0+ (推荐 LTS 版本)
- **Claude CLI**: 需要预先安装 Claude CLI

### 安装方式

#### 方式一：下载预构建版本 (推荐)
1. 前往 [Releases 页面](https://github.com/anyme123/claude-workbench/releases)
2. 下载 Windows 安装包：
   - `Claude Workbench_x.x.x_x64-setup.exe` (NSIS 安装包)
   - `Claude Workbench_x.x.x_x64_en-US.msi` (MSI 安装包)
3. 运行安装程序并完成安装

#### 方式二：从源代码构建
```bash
# 克隆仓库
git clone https://github.com/anyme123/claude-workbench.git
cd claude-workbench

# 安装依赖 (推荐使用 Bun)
bun install

# 开发模式运行
bun run tauri dev

# 构建生产版本 (Windows)
bun run tauri build
```

## 📖 使用指南

### 初次启动
1. 启动 Claude Workbench
2. 如果尚未安装 Claude CLI，应用会提供下载指引
3. 设置您的项目目录和偏好设置

### 代理商配置
1. 打开**设置** → **代理商**标签
2. 点击**添加代理商**配置您的 API 提供商
3. 填写代理商信息：
   - **名称**: 代理商的显示名称
   - **描述**: 可选的描述信息
   - **API 地址**: 代理商的 API 基础URL
   - **认证Token** 或 **API Key**: 至少填写其中一项
   - **模型**: 可选的默认模型

### 项目管理
- **创建项目**: 在主界面点击"新建项目"
- **会话管理**: 每个项目支持多个会话，保持上下文连续性
- **检查点系统**: 关键节点自动保存，支持回滚操作

## 🛠️ 技术架构

### 前端技术栈
- **React 18** - 现代化的用户界面框架
- **TypeScript** - 类型安全的开发体验
- **Tailwind CSS 4** - 实用优先的 CSS 框架
- **Framer Motion** - 流畅的动画效果
- **i18next** - 国际化支持

### 后端技术栈
- **Tauri 2** - 现代化的桌面应用框架 (Windows 优化)
- **Rust** - 高性能的系统编程语言
- **SQLite** - 嵌入式数据库
- **Windows API** - 原生 Windows 系统集成

### 核心架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 前端    │◄──►│   Tauri 桥接    │◄──►│   Rust 后端     │
│                 │    │                 │    │                 │
│ • UI 组件       │    │ • IPC 通信      │    │ • Claude CLI    │
│ • 状态管理      │    │ • 安全调用      │    │ • 进程管理      │
│ • 路由系统      │    │ • 类型安全      │    │ • Windows API   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 开发环境准备
1. Fork 本仓库到您的 GitHub 账户
2. 克隆您的 Fork 到本地
3. 安装依赖：`bun install`
4. 启动开发服务器：`bun run tauri dev`

### 提交规范
- 使用清晰的提交信息
- 遵循现有的代码风格
- 添加适当的测试覆盖
- 更新相关文档

### 报告问题
- 使用 [Issue 模板](https://github.com/anyme123/claude-workbench/issues/new) 报告 Bug
- 提供详细的复现步骤和环境信息
- 附加相关的日志文件和截图

## 📝 更新日志

### v1.0.0 (2025-07-22)
- 🎉 初始发布 (Windows 专版)
- ✨ 完整的 Claude 项目管理功能
- 🔧 代理商一键切换系统
- 🌍 中文优先的多语言支持
- 🎨 现代化的用户界面设计
- 🖥️ Windows 原生优化

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议发布。

## 🙏 致谢

特别感谢原项目 [@getAsterisk/claudia](https://github.com/getAsterisk/claudia) 提供的基础架构和灵感。本项目基于该项目进行了 Windows 专版的深度定制和优化。

- [Claude](https://claude.ai/) - 强大的 AI 助手
- [Tauri](https://tauri.app/) - 现代化的桌面应用框架  
- [React](https://react.dev/) - 用户界面构建库
- [Rust](https://rust-lang.org/) - 系统编程语言

## 📞 联系方式

- **Issues**: [GitHub Issues](https://github.com/anyme123/claude-workbench/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anyme123/claude-workbench/discussions)

---

<div align="center">
  <p>如果这个项目对您有帮助，请考虑给我们一个 ⭐</p>
  <p>Made with ❤️ for Windows users</p>
</div>
