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

**Primary Platform**: Windows (专版优化) with cross-platform builds for macOS/Linux.

**Latest Updates**: Enhanced Google Gemini CLI integration, Claude Code 2025 compatibility, third-party API support, and comprehensive permission management system.

## Development Commands

### Essential Commands
```bash
# Development server (frontend + backend hot reload)
bun run tauri:dev

# Type checking (CRITICAL for TypeScript safety)
npx tsc --noEmit

# Frontend build only (faster iteration)
bun run build

# Production build (ALWAYS required for testing)
bun run tauri:build

# Fast development build (iteration testing)
bun run tauri:build-fast

# Rust backend only
cd src-tauri && cargo build --release
cd src-tauri && cargo check && cargo clippy

# Additional validation commands
cargo fmt --check         # Check Rust code formatting
cargo test               # Run Rust tests
```

### Build Profiles
- **Development**: `bun run tauri:dev` - Hot reload, debug symbols
- **Fast Build**: `bun run tauri:build-fast` - Uses `dev-release` profile with opt-level=2, thin LTO
- **Production**: `bun run tauri:build` - Full optimization with opt-level="z", full LTO, strip symbols

### Build Targets
The project supports multiple build targets configured in `tauri.conf.json`:
- **Windows**: MSI and NSIS installers
- **macOS**: DMG and APP bundles
- **Linux**: AppImage and DEB packages

### Prerequisites
- **Bun** (recommended) - Required for cross-platform builds
- **Rust 2021+** with Tauri CLI
- **Node.js 18+**
- **Windows**: Microsoft C++ Build Tools, WebView2

### Development Tools
- **No Test Framework**: This project currently does not have automated tests configured
- **Type Checking**: Use `npx tsc --noEmit` for TypeScript validation
- **Linting**: No explicit linter configured - relies on TypeScript strict mode
- **Code Formatting**: Relies on editor configuration (VS Code settings recommended)

## Core Architecture

### Key File Structure
```
src/
├── components/
│   ├── ClaudeCodeSession.tsx    # Core Claude interaction (CRITICAL: uses INLINE listeners)
│   ├── FloatingPromptInput.tsx  # Universal prompt interface with thinking modes
│   ├── ProviderManager.tsx      # API provider CRUD interface (core feature)
│   ├── Settings.tsx             # Multi-tab configuration interface
│   ├── DeletedProjects.tsx      # Project recovery interface
│   ├── AgentExecution.tsx       # Agent execution monitoring
│   └── ui/                      # Radix UI components with Tailwind styling
├── lib/
│   ├── api.ts                   # Type-safe Tauri invoke interface (236 commands)
│   └── utils.ts                 # General utilities
├── hooks/                       # Custom React hooks and i18n
└── contexts/                    # React context providers

src-tauri/src/
├── commands/                    # Modular command handlers
│   ├── claude.rs               # Claude CLI integration, process lifecycle (CRITICAL)
│   ├── provider.rs             # API provider configuration management (core feature)
│   ├── mcp.rs                  # MCP server lifecycle management
│   ├── agents.rs               # Agent execution with GitHub integration
│   └── storage.rs              # SQLite database operations
└── process/                     # Process registry and lifecycle management
```

### System Architecture
The application follows a multi-layered architecture with clear separation between frontend, IPC bridge, and backend:

```
Frontend (React 18 + TypeScript)
├── App.tsx - Main application router with 11 distinct views
├── components/ - 50+ specialized components including:
│   ├── ClaudeCodeSession.tsx - Core Claude interaction (CRITICAL: uses INLINE listeners)
│   ├── FloatingPromptInput.tsx - Universal prompt interface with thinking modes
│   ├── ProviderManager.tsx - API provider CRUD interface (core feature)
│   ├── Settings.tsx - Multi-tab configuration interface
│   ├── DeletedProjects.tsx - Project recovery and permanent deletion interface
│   ├── AgentExecution.tsx - Agent execution monitoring
│   ├── MCPManager.tsx - Model Context Protocol server management
│   └── UsageDashboard.tsx - Comprehensive usage analytics
├── lib/
│   ├── api.ts - Type-safe Tauri invoke interface (256 commands)
│   └── utils.ts - General utilities with i18n support
├── hooks/ - Custom React hooks including useTranslation
└── contexts/ - React context providers for global state

Backend (Rust + Tauri 2)
├── main.rs - Application entry, command registration (256 total commands)
├── commands/ - Modular command handlers including:
│   ├── claude.rs - Claude CLI integration, process lifecycle (CRITICAL)
│   ├── provider.rs - API provider configuration management (core feature)
│   ├── mcp.rs - MCP server lifecycle management
│   ├── agents.rs - Agent execution with GitHub integration
│   ├── usage.rs - Comprehensive usage tracking and analytics
│   ├── storage.rs - SQLite database operations
│   ├── permission_config.rs - Permission management system
│   └── slash_commands.rs - Custom slash command handling
├── process/ - Process registry and lifecycle management
└── checkpoint/ - Session checkpoint and timeline management
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
├── settings.json                             # User preferences and provider configuration (STANDARD)
├── providers.json                            # Legacy provider presets (for backward compatibility)
├── window_state.json                         # Window size/position memory
└── hidden_projects.json                      # Deleted projects list for recovery system
```

**IMPORTANT**: Provider configuration now follows Claude CLI standard - stored in `settings.json` env field, not separate `providers.json`.

## Critical Implementation Details

### Provider Management System (Core Feature)
The provider management system follows Claude CLI standard configuration:

**Configuration Storage** (UPDATED - Claude CLI Standard):
- **Current Config**: Stored in `~/.claude/settings.json` under `env` field
- **Format**: Standard Claude CLI environment variables:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com",
    "ANTHROPIC_AUTH_TOKEN": "your-token",
    "ANTHROPIC_API_KEY": "your-key", 
    "ANTHROPIC_MODEL": "claude-3-opus-20240229"
  }
}
```
- **Presets**: Legacy `providers.json` maintained for UI convenience

**Backend Implementation** (`src-tauri/src/commands/provider.rs`):
- `get_current_provider_config()` - Reads from `settings.json` env field
- `switch_provider_config()` - Updates `settings.json` directly (Claude CLI standard)
- `get_provider_presets()` - Lists presets from legacy `providers.json`
- Configuration changes take effect immediately without restart

**Frontend Implementation** (`src/components/ProviderManager.tsx`):
- Complete CRUD interface for provider presets
- Real-time display of active configuration from `settings.json`
- Silent switching without interrupting user workflow

### Project Recovery System (NEW)
Comprehensive deleted projects management with intelligent format handling:

**Backend Implementation** (`src-tauri/src/commands/claude.rs`):
- `list_hidden_projects()` - Lists deleted projects with directory validation
- `restore_project()` - Restores deleted projects from hidden list
- `delete_project_permanently()` - Permanent deletion with intelligent format detection
- Handles both legacy (double-dash) and standard (single-dash) project encoding formats

**Frontend Implementation** (`src/components/DeletedProjects.tsx`):
- Complete recovery interface accessible via CC项目列表 → "已删除项目" tab (MOVED from Settings)
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

### Provider Configuration Issues ✅ (RESOLVED)  
**Previous Problem**: Provider configuration not following Claude CLI standard
**Solution**: Now stores provider configuration in `~/.claude/settings.json` env field according to Claude CLI standard

**Current Debug Steps**:
```bash
# Check current configuration (Claude CLI standard)
cat ~/.claude/settings.json | grep -A 10 '"env"'

# Verify ANTHROPIC environment variables are set
echo $ANTHROPIC_BASE_URL $ANTHROPIC_AUTH_TOKEN
```

### Settings Save Bug ✅ (RESOLVED)
**Previous Problem**: Saving settings would overwrite provider configuration in `settings.json`
**Solution**: Settings save now preserves existing env variables (including ANTHROPIC_*) while adding UI-configured variables

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

## Recent Critical Updates (2024-2025)

### December 2024 - Claude Code 2025 Integration
- **MAJOR UPDATE**: Enhanced Google Gemini CLI integration for prompt optimization
- **New Feature**: Advanced permission management system with tool-level controls
- **Improvement**: Third-party API provider support with enhanced configuration
- **Enhancement**: Comprehensive usage analytics and burn rate monitoring

### December 2024 - Provider Configuration Standardization
- **BREAKING CHANGE**: Provider configuration now follows Claude CLI standard
- **Migration**: Configuration moved from `providers.json` to `settings.json` env field
- **Impact**: Fully compatible with native Claude CLI configuration
- **Benefit**: No more configuration conflicts between claude-workbench and Claude CLI

### December 2024 - Project Management UI Overhaul  
- **UI Improvement**: Moved deleted projects from Settings to main project list
- **New Feature**: Tabbed interface with "活跃项目" and "已删除项目" tabs
- **UX Enhancement**: Unified project management in single interface
- **Technical**: Uses controlled Tabs component with state management

### December 2024 - Settings Save Protection
- **Critical Fix**: Settings save no longer overwrites provider configuration
- **Implementation**: Preserves existing env variables while adding UI-configured ones
- **Priority System**: UI-configured variables override provider settings when explicitly set
- **Safety**: Prevents accidental loss of ANTHROPIC_* environment variables

### Project Encoding Fixes
- **Bug Resolution**: Fixed duplicate project creation due to encoding mismatch
- **Standardization**: Now uses single-dash encoding to match Claude CLI exactly
- **Compatibility**: Handles both legacy (double-dash) and standard formats
- **Recovery**: Enhanced project recovery system with intelligent format detection

## Key Development Insights

### Provider Management Architecture
The provider management system underwent major architectural changes:
1. **Legacy System**: Stored presets in separate `providers.json` file
2. **Current System**: Presets still in `providers.json` for UI convenience, but active configuration in `settings.json` 
3. **Claude CLI Compliance**: Full compatibility with official Claude CLI configuration format

### Event System Debugging
When debugging session issues, the event listener pattern is critical:
- ClaudeCodeSession.tsx uses inline listeners that switch from generic to session-specific
- Always check browser console for listener setup and cleanup logs
- Session ID detection from system.init messages is the key switching trigger

### Build System Notes
- Always use production builds for testing (`bun run tauri build`)
- Development mode (`tauri dev`) may have different behavior than production
- Fast builds (`--profile dev-release`) useful for iteration but not final testing
- Windows-specific: Process file locking may require killing existing processes before rebuild