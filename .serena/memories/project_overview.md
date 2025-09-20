# Claude Workbench 项目概览

## 项目目的
Claude Workbench是一个专业的Claude CLI桌面管理工具，基于[@getAsterisk/claudia](https://github.com/getAsterisk/claudia)进行Windows专版定制优化。

## 核心功能
1. **代理商管理系统（主要功能）**: 一键切换不同的Claude API代理商，支持本地配置存储
2. **Claude CLI集成**: 完整的进程管理，支持会话处理和流式输出
3. **项目管理**: 会话历史、检查点和时间线导航
4. **MCP支持**: 完整的Model Context Protocol服务器生命周期管理
5. **Agent系统**: GitHub集成和自动化任务执行

## 技术栈

### 前端
- **React 18** - 现代化用户界面框架
- **TypeScript** - 类型安全开发（ES2020, 严格模式）
- **Tailwind CSS 4** - 实用优先的CSS框架
- **Framer Motion** - 流畅动画效果
- **i18next** - 国际化支持（中文优先）
- **@tanstack/react-virtual** - 虚拟滚动优化

### 后端
- **Tauri 2** - 现代化桌面应用框架（Windows优化）
- **Rust 2021** - 高性能系统编程语言
- **SQLite** - 嵌入式数据库（rusqlite + bundled）
- **Tokio** - 异步运行时
- **Serde** - 序列化/反序列化

### 开发工具
- **Bun** - 包管理器（推荐）
- **Vite** - 构建工具
- **TypeScript 5.6+** - 类型检查

## 主要目录结构
```
claudia1/
├── src/                    # React前端代码
│   ├── components/         # UI组件（40+个专业组件）
│   ├── lib/               # API接口和工具函数
│   ├── hooks/             # 自定义React hooks
│   └── i18n/              # 国际化文件
├── src-tauri/             # Rust后端代码
│   ├── src/commands/      # 模块化命令处理器
│   ├── src/process/       # 进程注册和生命周期管理
│   └── src/router/        # 智能路由系统
├── public/                # 静态资源
└── scripts/               # 构建脚本
```

## Windows专版优化
- 优化的Windows进程生成
- 长路径支持（`\\?\`前缀处理）
- 原生Windows环境变量处理
- MSI和NSIS安装包构建目标