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

This is a **Tauri 2 desktop application** that provides a GUI wrapper for Claude CLI with advanced project management, agent systems, and MCP support.

### Core Architecture Pattern
```
React Frontend (TypeScript) ↔ Tauri IPC Bridge ↔ Rust Backend
     │                              │                 │
  UI Components              Command Handlers    Claude CLI Process
  State Management            Database Ops        System Integration
  API Calls                   File Operations     Windows APIs
```

### Key Components

**Frontend (src/)**
- **App.tsx**: Main application router and state management
- **components/**: React components following PascalCase naming
- **lib/api.ts**: Tauri IPC command invocations
- **contexts/**: React contexts for global state (theme, etc.)

**Backend (src-tauri/src/)**
- **main.rs**: Application entry point and command registration
- **commands/**: Tauri command handlers organized by domain:
  - `claude.rs`: Claude CLI process management and execution
  - `agents.rs`: Agent system with GitHub integration
  - `storage.rs`: SQLite database operations
  - `mod.rs`: Command module declarations
- **process/**: Process registry for managing Claude sessions and agent runs

### Database Architecture
Uses SQLite with these core tables managed in `storage.rs`:
- `agents`: Agent definitions and configurations
- `agent_runs`: Execution history and metrics
- `app_settings`: Application configuration storage

### Claude CLI Integration
The application manages Claude CLI processes through:
- **ProcessRegistry**: Tracks running Claude sessions and agent executions
- **ClaudeProcessState**: Manages active Claude process lifecycle
- **Session Management**: Handles multiple concurrent Claude conversations

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