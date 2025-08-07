# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workbench is a comprehensive desktop GUI application for Claude CLI, built with Tauri 2 (Rust backend) and React 18 TypeScript frontend. This is a Windows-optimized fork based on [@getAsterisk/claudia](https://github.com/getAsterisk/claudia) with specialized Windows desktop integration.

**Core Features:**
- **Provider Management**: Silent API provider switching with local configuration storage - the primary differentiating feature
- **Claude CLI Integration**: Complete process management with session handling and streaming output  
- **MCP Support**: Full Model Context Protocol server lifecycle management
- **Agent System**: GitHub-integrated agent execution with monitoring
- **Project Management**: Session history, checkpoints, and timeline navigation

**Primary Platform**: Windows (专版优化) with cross-platform GitHub Actions builds for macOS/Linux.

## Development Commands

### Essential Commands
```bash
# Development server (frontend + backend hot reload)
bun run tauri dev

# Type checking (CRITICAL for TypeScript safety) 
npx tsc --noEmit

# Production build (ALWAYS required for testing)
bun run tauri build

# Fast development build (iteration testing)  
bun run tauri build -- --profile dev-release

# Rust backend only
cd src-tauri && cargo build --release
cd src-tauri && cargo check && cargo clippy
```

### Build Profiles
- **Development**: `tauri dev` - Hot reload, debug symbols
- **Fast Build**: `tauri build -- --profile dev-release` - Uses `dev-release` profile with opt-level=2, thin LTO
- **Production**: `tauri build` - Full optimization with opt-level="z", full LTO, strip symbols

### Prerequisites
- **Bun** (recommended) - Required for cross-platform builds  
- **Rust 2021+** with Tauri CLI
- **Node.js 18+**
- **Windows**: Microsoft C++ Build Tools, WebView2

## Core Architecture

### System Architecture
The application follows a multi-layered architecture with clear separation between frontend, IPC bridge, and backend:

```
Frontend (React 18 + TypeScript)
├── App.tsx - Main application router and state
├── components/ - 40+ specialized components  
│   ├── ClaudeCodeSession.tsx - Core Claude interaction (CRITICAL: uses INLINE listeners)
│   ├── FloatingPromptInput.tsx - Universal prompt interface with thinking modes
│   ├── ProviderManager.tsx - API provider CRUD interface (core feature)
│   ├── Settings.tsx - Multi-tab configuration interface
│   ├── DeletedProjects.tsx - Project recovery and permanent deletion interface
│   └── AgentExecution.tsx - Agent execution monitoring
├── lib/
│   ├── api.ts - Type-safe Tauri invoke interface (236 commands)
│   └── utils.ts - General utilities
└── hooks/ - Custom React hooks and i18n

Backend (Rust + Tauri 2)  
├── main.rs - Application entry, command registration (236 commands)
├── commands/ - Modular command handlers
│   ├── claude.rs - Claude CLI integration, process lifecycle (CRITICAL)
│   ├── provider.rs - API provider configuration management (core feature)
│   ├── mcp.rs - MCP server lifecycle management
│   ├── agents.rs - Agent execution with GitHub integration
│   └── storage.rs - SQLite database operations  
└── process/ - Process registry and lifecycle management
```

### Event System Architecture (CRITICAL)
The application uses a sophisticated event listener pattern that must be understood for debugging:

**ClaudeCodeSession.tsx** - Uses INLINE event listeners with generic→specific switching:
1. **Generic listeners** capture initialization messages across all sessions
2. **Session-specific listeners** provide isolation once session ID is detected
3. **Cleanup pattern** prevents memory leaks with proper unlisten management

### Data Storage Structure
```
~/.claude/
├── projects/[project-id]/[session-id].jsonl  # Session message history
├── providers.json                            # API provider configurations (CORE)
├── settings.json                             # User preferences
├── window_state.json                         # Window size/position memory
└── hidden_projects.json                      # Deleted projects list for recovery system
```

## Critical Implementation Details

### Provider Management System (Core Feature)
The provider management system is the primary differentiating feature of this Windows fork:

**Backend Implementation** (`src-tauri/src/commands/provider.rs`):
- `get_provider_presets()` - Lists all configured API providers
- `add_provider_config()`, `update_provider_config()` - CRUD operations
- Stores configurations in `~/.claude/providers.json` for security
- Automatic Claude process restart when provider is switched

**Frontend Implementation** (`src/components/ProviderManager.tsx`):
- Complete CRUD interface for provider management
- Silent switching without interrupting user workflow
- Real-time status display of active provider

### Project Recovery System (NEW)
Comprehensive deleted projects management with intelligent format handling:

**Backend Implementation** (`src-tauri/src/commands/claude.rs`):
- `list_hidden_projects()` - Lists deleted projects with directory validation
- `restore_project()` - Restores deleted projects from hidden list
- `delete_project_permanently()` - Permanent deletion with intelligent format detection
- Handles both legacy (double-dash) and standard (single-dash) project encoding formats

**Frontend Implementation** (`src/components/DeletedProjects.tsx`):
- Complete recovery interface accessible via Settings → "已删除" tab
- Format indicators showing legacy vs standard project formats
- Batch operations for restoration and permanent deletion
- Intelligent path decoding for both encoding schemes

### Claude CLI Integration Pattern
**Process Management** (`src-tauri/src/commands/claude.rs`):
- `execute_claude_code()` - Start new Claude session
- `continue_claude_code()` - Continue existing session with `-c` flag
- `resume_claude_code()` - Resume from saved session state

**Project Path Encoding** (CRITICAL for duplicate prevention):
```rust
// Consistent single-dash encoding to match Claude CLI
fn encode_project_path(path: &str) -> String {
    path.replace("\\", "-")
        .replace("/", "-")
        .replace(":", "")
}
```

**Slash Command Handling**:
```rust
// For slash commands like /compact, /clear
let args = if prompt.trim().starts_with('/') {
    vec!["--prompt".to_string(), escaped_prompt, /* ... */]
} else {
    vec![escaped_prompt, /* ... */]
};
```

### Event Listener Debugging Pattern
When debugging Claude session issues, focus on these areas:

1. **Generic Listener Setup**: Check browser console for `claude-output` listener setup
2. **Session ID Detection**: Verify extraction from `system.init` messages  
3. **Specific Listener Switch**: Confirm transition to `claude-output:${sessionId}` listeners
4. **Cleanup Verification**: Ensure proper unlisten on component unmount

**Key Files for Debugging**:
- `ClaudeCodeSession.tsx:522-650` - Event listener implementation
- Browser DevTools Console - Real-time event flow

## Common Issues & Solutions

### Build Issues
**Symptom**: "页面文件太小，无法完成操作" (Windows)
**Solution**:
```bash
rustup update
cargo clean  
# Always use production build: bun run tauri build (not dev mode)
```

### Event Listener Problems (PRIMARY)
**Symptom**: New Claude projects don't receive CLI output
**Debug Steps**:
1. Check browser console for listener setup logs
2. Verify session ID detection in generic listeners  
3. Confirm switch to session-specific listeners
4. Check `~/.claude/projects/` directory structure

### Provider Configuration Issues  
**Symptom**: Provider switching doesn't take effect
**Debug**:
```bash
# Check configuration
cat ~/.claude/providers.json

# Verify environment variables in process
# Check Claude process restart in Task Manager
```

### Duplicate Projects Issue ✅ (RESOLVED)
**Previous Problem**: claude-workbench created duplicate projects due to encoding mismatch
- Native Claude CLI: `C--Users-Administrator-Desktop-test1` (single dash)
- claude-workbench: `C--Users--Administrator--Desktop--test1` (double dash)

**Solution**: Implemented `encode_project_path()` function using single-dash encoding to match Claude CLI exactly. Removed redundant manual project creation code that was duplicating Claude CLI's automatic project creation.

### Project Recovery System Issues
**Symptom**: Correct format projects don't appear in deleted list
**Solution**: Enhanced `list_hidden_projects()` with directory validation and intelligent format matching for both single-dash and double-dash encoded project IDs.

**Symptom**: Permanent deletion fails on manually deleted directories  
**Solution**: Added intelligent directory detection in `delete_project_permanently()` that handles missing directories gracefully.

### Window State Management ✅
**功能**: 应用程序会记住关闭前的窗口大小和位置，下次启动时自动恢复
**安全机制**: 
- 自动验证窗口状态有效性，防止窗口不可见
- 过滤最小化、无效尺寸或极端位置的状态
- 加载时验证，如无效则使用默认值
**配置文件**: `~/.claude/window_state.json`

## Performance Optimizations

### Build Profiles
- **Development**: Full debug info, incremental compilation
- **Fast Build** (`dev-release`): opt-level=2, thin LTO, parallel codegen  
- **Production**: opt-level="z", full LTO, strip symbols, panic=abort

### Frontend Performance
- **Virtual Scrolling**: @tanstack/react-virtual for large message lists
- **Event Cleanup**: Proper unlisten patterns prevent memory leaks
- **Message Filtering**: Smart filtering reduces DOM elements
- **Database Pagination**: Efficient queries for large datasets

## Windows-Specific Optimizations

This fork includes Windows-specific optimizations:
- **Process Creation**: Optimized Windows process spawning for Claude CLI
- **Path Handling**: Windows long path support with `\\?\` prefix handling  
- **Environment Integration**: Native Windows environment variable handling
- **Build Targets**: MSI and NSIS installers optimized for Windows deployment

**Configuration Files**:
- **Tauri** (`tauri.conf.json`): CSP with asset protocol, Windows bundle targets
- **TypeScript** (`tsconfig.json`): ES2020 strict mode, path mapping `@/*` → `./src/*`