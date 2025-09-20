# 代码风格和约定

## TypeScript/React 约定

### 类型定义
- 严格TypeScript模式，ES2020目标
- 使用TypeScript 5.6+的最新特性
- 路径别名：`@/*` 映射到 `./src/*`
- 严格的类型检查：noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch

### 组件命名
- PascalCase用于组件名：`ClaudeCodeSession.tsx`, `ProviderManager.tsx`
- camelCase用于函数和变量：`getCurrentProviderConfig`
- 文件名与组件名保持一致

### 项目结构约定
- 组件放在 `src/components/` 目录
- 工具函数放在 `src/lib/` 目录
- 自定义hooks放在 `src/hooks/` 目录
- 类型定义放在 `src/types/` 目录

## Rust 约定

### 命名规范
- snake_case用于函数名：`execute_claude_code`, `spawn_claude_process`
- PascalCase用于类型：`ClaudeProcessState`, `CheckpointState`
- SCREAMING_SNAKE_CASE用于常量

### 代码组织
- 模块化命令处理：每个功能域在 `src/commands/` 下有独立文件
- 使用 `#[tauri::command]` 宏标记暴露给前端的函数
- 错误处理使用 `Result<T, String>` 模式

### 异步处理
- 使用 `tokio` 异步运行时
- `async/await` 模式处理长时间运行的操作
- 进程管理使用 `tokio::process::Command`

## 配置管理约定

### 数据存储位置
- 用户配置：`~/.claude/settings.json`
- 项目会话：`~/.claude/projects/[project-id]/[session-id].jsonl`
- 窗口状态：`~/.claude/window_state.json`
- 隐藏项目：`~/.claude/hidden_projects.json`

### 代理商配置标准
- 遵循Claude CLI标准配置格式
- 环境变量存储在 `settings.json` 的 `env` 字段
- 支持的变量：`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`

## 事件系统约定

### IPC通信
- 使用Tauri的invoke机制进行前后端通信
- 236个已注册的命令处理器
- 事件监听使用 `claude-output` 和 `claude-output:${sessionId}` 模式

### 错误处理
- 统一的错误消息格式
- 日志记录使用 `log::info!`, `log::warn!`, `log::error!`
- 前端错误通过Toast组件显示