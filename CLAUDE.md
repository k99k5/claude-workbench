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
- Strict TypeScript mode enabled
- PascalCase for React components
- camelCase for files and functions
- Tailwind CSS with atomic classes preferred
- React hooks + Context pattern for state management

### Rust
- Standard Rust conventions
- Tauri command handlers use `#[tauri::command]` macro
- Error handling with `Result<T, String>` pattern
- Async operations use tokio runtime

### IPC Communication
- Use `api.ts` for all Tauri command invocations
- Commands follow `domain_action` naming pattern (e.g., `storage_list_tables`)
- All IPC calls should handle errors gracefully

## Important Implementation Details

### Process Management
- Claude sessions are registered in ProcessRegistry with unique run_ids
- Agent executions spawn separate processes tracked independently
- All processes support real-time output streaming

### MCP (Model Context Protocol)
- Full MCP server management with connection testing
- Project-specific MCP configurations stored in database
- Supports both local and remote MCP servers

### Agent System
- Agents can be imported from GitHub (getAsterisk/claudia repository)
- Supports custom agent creation with .claudia.json format
- Agent runs tracked with detailed metrics and output history

### Database Operations
- All database operations go through AgentDb state wrapper
- SQLite connection managed as Tauri state
- Storage tab provides direct database inspection/editing interface

### Hooks System
- Enhanced hooks automation for project-specific workflows
- Supports pre-commit hooks and custom event triggers
- Configuration stored in project-level or global settings