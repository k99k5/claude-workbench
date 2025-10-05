# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

并行执行

## Common Development Commands

### Development
- `bun run tauri:dev` - Start development mode with hot reload
- `tsc` - Run TypeScript type checking (**MUST run before builds to catch type errors**)
- `bun run build` - Build frontend assets
- `bun run tauri:build` - Production build (optimized for size with full LTO)
- `bun run tauri:build-fast` - Fast development build using dev-release profile (recommended for testing)

### Dependencies
- `bun install` - Install all dependencies (**Bun is the preferred package manager**, not npm/yarn)

## Architecture Overview

This is a **Tauri 2 desktop application** (Windows/macOS/Linux) that provides a professional GUI wrapper for Claude CLI with advanced features: Provider/Proxy management, intelligent checkpointing, multi-tab sessions, MCP support, agent systems, and auto-context compaction.

### Core Architecture Pattern
```
React Frontend (TypeScript) ↔ Tauri IPC Bridge ↔ Rust Backend
     │                              │                 │
  UI Components              Command Handlers    Claude CLI Process
  State Management            Database Ops        System Integration
  API Calls                   File Operations     Platform APIs
  Tab Management              Compression         Process Registry
```

### Key Backend Components (src-tauri/src/)

**Core Systems**
- **main.rs**: Application entry point with all command registrations
- **commands/**: Domain-specific command handlers
  - `claude.rs`: Claude CLI process lifecycle and execution
  - `agents.rs` + `subagents.rs`: Agent system with GitHub integration
  - `provider.rs`: **Provider/proxy configuration management (core feature)**
  - `storage.rs`: SQLite database operations
  - `translator.rs`: Translation service with caching
  - `context_manager.rs` + `context_commands.rs`: Auto-compact context system
  - `enhanced_hooks.rs`: Enhanced hooks automation
  - `mcp.rs`: MCP server management
  - `clipboard.rs`: Clipboard operations
  - `slash_commands.rs`: Custom slash command management
  - `permission_config.rs`: Permission configuration
  - `usage.rs`: Usage tracking

**Process & Storage**
- **process/**: ProcessRegistry for tracking all running Claude sessions and agent executions
- **checkpoint/**: Checkpoint system with content-addressable storage and zstd compression

### Key Frontend Components (src/)

**Core UI**
- **App.tsx**: Main router and global state management
- **lib/api.ts**: All Tauri IPC command invocations (single source of truth)
- **components/**: React components (PascalCase naming)
  - `TabManager.tsx` + `TabSessionWrapper.tsx`: Multi-tab session management
  - `ProviderManager.tsx`: Provider switching UI (**core feature**)
  - `CheckpointTimeline.tsx`: Timeline visualization and restoration
  - `StorageTab.tsx`: Direct database inspection/editing
- **contexts/**: React contexts (theme, translation, etc.)
- **hooks/**: Custom hooks including `useTabs.tsx`, `useSessionSync.ts`

### Database Architecture (SQLite)
Core tables managed through `AgentDb` state wrapper:
- **agents**: Agent definitions and configurations
- **agent_runs**: Execution history and performance metrics
- **app_settings**: Application-wide settings
- **provider_configs**: Custom provider/proxy configurations (stored locally, never hardcoded)

## Code Conventions

### TypeScript/React
- Strict TypeScript mode enabled - **run `tsc` before builds**
- PascalCase for React components, camelCase for files/functions
- Tailwind CSS 4 with atomic utility classes (OKLCH color space for theming)
- React hooks + Context pattern for state management
- All Tauri commands invoked through `lib/api.ts` (never invoke directly)

### Rust
- Standard Rust conventions with `#[tauri::command]` macro for handlers
- Error handling: `Result<T, String>` pattern for all commands
- Async operations use tokio runtime
- Database operations always go through `AgentDb` state wrapper

### IPC Communication Pattern
- **Frontend → Backend**: Use `api.ts` methods, never invoke directly
- **Command naming**: `domain_action` pattern (e.g., `provider_switch_config`, `storage_list_tables`)
- **Error handling**: All IPC calls must handle errors gracefully with user feedback

## Critical System Details

### Provider/Proxy Management System ⭐ (Core Feature)
**Purpose**: Silent switching between different Claude API providers/proxies without popups
- **Configuration Storage**: Local SQLite database (never hardcoded in code)
- **API Methods**: `getProviderPresets()`, `switchProviderConfig()`, `addProviderConfig()`, etc.
- **Auto-Restart**: Automatically restarts Claude process when provider changes
- **Environment**: Sets `ANTHROPIC_BASE_URL` and auth tokens at runtime
- **Detection**: Intelligently identifies current active configuration
- **Location**: `src-tauri/src/commands/provider.rs`, `src/components/ProviderManager.tsx`

### Checkpoint System
**Advanced features beyond basic snapshots**:
- **Content-Addressable Storage**: Files stored by hash in content pool to prevent duplication
- **Zstd Compression**: All messages and file snapshots compressed (see `Cargo.toml`)
- **Timeline Branching**: Fork new sessions from any checkpoint
- **Restore Modes**: messages-only, files-only, or both
- **Auto-Checkpoint Strategies**: Configurable triggers (token count, message count, time-based)
- **Diff Visualization**: Compare any two checkpoints with detailed diffs
- **Location**: `src-tauri/src/checkpoint/`, API in `lib/api.ts` (checkpoint_* methods)

### Multi-Tab Session Management
**State synchronization architecture**:
- **Session Sync**: 5-second interval background sync to detect state inconsistencies
- **Consistency Checks**: Corrects tabs showing wrong streaming status
- **Session Wrapper**: Each tab wrapped in `TabSessionWrapper` with isolated state
- **Process Tracking**: Maps tab sessions to running Claude process IDs
- **Location**: `src/hooks/useTabs.tsx`, `src/hooks/useSessionSync.ts`

### Auto-Compact Context Management
**Intelligent token optimization**:
- **Purpose**: Automatically compress conversation context when approaching token limits
- **Strategies**: Configurable compaction strategies (aggressive, balanced, conservative)
- **Monitoring**: Tracks token counts per session with threshold-based triggers
- **Compression Ratio**: Reports saved tokens and processing time
- **Manual Triggers**: Users can manually trigger compaction
- **Location**: `src-tauri/src/commands/context_manager.rs`, `context_commands.rs`

### Translation/i18n System
**Production-ready internationalization**:
- **Framework**: i18next with browser language detection
- **Caching**: Translation cache with statistics tracking
- **Batch Support**: `translate_batch()` for multiple strings
- **Language Detection**: Auto-detect source language
- **Configuration**: Persistent config storage with API endpoints
- **Location**: `src-tauri/src/commands/translator.rs`, `src/i18n/`

### MCP (Model Context Protocol)
- Full MCP server management with connection testing
- Project-specific MCP configurations stored in database
- Supports both local and remote MCP servers
- Configuration UI in Settings tab

### Agent System
- Import agents from GitHub (getAsterisk/claudia repository)
- Custom agent creation with `.claudia.json` format
- Agent runs tracked with detailed metrics and output history
- Subagents support for complex workflows

### Enhanced Hooks System
- Project-specific workflow automation
- Pre-commit hooks and custom event triggers
- Configuration stored at project or global level

### Process Registry (Critical)
**Central tracking for all background operations**:
- Tracks all running Claude sessions with unique run_ids
- Agent executions spawn separate tracked processes
- Real-time output streaming support
- Process cleanup on application shutdown
- **Location**: `src-tauri/src/process/`

## Build Profiles & Performance

### Cargo Build Profiles (see `Cargo.toml`)
- **release**: Production build optimized for size
  - `opt-level = "z"` (optimize for size)
  - Full LTO enabled
  - Strips symbols, disables debug info
  - Single codegen unit for maximum optimization
  - **Use for**: Final production releases

- **dev-release**: Fast development builds
  - `opt-level = 2` (balanced performance)
  - Thin LTO (faster than full)
  - 16 codegen units (parallel compilation)
  - Incremental compilation enabled
  - Debug info included
  - **Use for**: Testing builds without waiting for full optimization

### Performance Considerations
- **Compression**: Zstd library used for checkpoint compression (see `Cargo.toml` dependencies)
- **Database**: SQLite bundled statically for maximum compatibility
- **Async Runtime**: Tokio with full features for concurrent operations

## Platform-Specific Notes

### Windows
- Claude CLI paths: Check `AppData/Roaming/npm/claude.cmd` or `.npm-global/bin/claude`
- Binary detection looks for both `.exe` and `.cmd` extensions

### macOS
- Common paths: `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`
- Icon configuration required: `icon.icns` in `src-tauri/icons/`

### Linux
- Standard paths: `~/.local/bin/claude`, `~/.npm-global/bin/claude`

## Development Tips

### Debugging IPC Communication
- All IPC calls go through `lib/api.ts` - add console logs there to trace command flow
- Rust backend logs available via `env_logger` (see `main.rs`)

### Database Inspection
- Use the built-in Storage tab in Settings for direct table inspection/editing
- Execute raw SQL queries through the SQL Query Editor
- Database location: Platform-specific app data directory

### Working with Checkpoints
- Checkpoints stored in Claude CLI directory under `checkpoints/<project_id>/<session_id>/`
- Content pool prevents file duplication across checkpoints
- Messages stored as `.zst` compressed files

### Translation Testing
- Translation config persisted to file system
- Cache cleared via `clear_translation_cache()` API method
- Language detection available via `detect_text_language()`