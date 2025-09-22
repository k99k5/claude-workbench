# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workbench is a professional desktop application and toolkit for Claude CLI, specifically optimized for Windows users. It's built with a modern tech stack combining React 18 frontend with Tauri 2 and Rust backend.

## Development Commands

### Package Management & Dependencies
```bash
# Install dependencies (recommended: use bun for optimal performance)
bun install
# or alternatively
npm install

# Check dependencies and update
npm audit
cargo update
```

### Development Workflow
```bash
# Start development server (frontend + backend)
npm run tauri dev
# or
bun run tauri dev

# Frontend only development
npm run dev
bun run dev

# Build for production
npm run tauri build
bun run tauri build

# Fast development build (optimized for speed)
npm run tauri:build-fast
```

### Code Quality & Testing
```bash
# TypeScript compilation check
npm run build    # Includes tsc && vite build

# Rust compilation and checks
cd src-tauri
cargo check      # Quick syntax check
cargo clippy     # Linting for Rust code
cargo fmt        # Format Rust code
cargo test       # Run Rust tests

# Combined quality checks (run these before commits)
npm run build && cd src-tauri && cargo clippy && cargo fmt
```

## Architecture Overview

### Frontend Architecture (React 18 + TypeScript)
- **Entry Point**: `src/main.tsx` - React app initialization with Tauri window management
- **Main App**: `src/App.tsx` - Central router with view-based navigation system
- **Component Structure**: 60+ specialized components in `src/components/`
  - UI Components: `src/components/ui/` (Radix UI + Tailwind CSS)
  - Feature Components: Core functionality like `ClaudeCodeSession`, `MCPManager`, `ProviderManager`
- **API Layer**: `src/lib/api.ts` - Comprehensive TypeScript API client with 2000+ lines
- **State Management**: React Context + hooks pattern, no external state library
- **Styling**: Tailwind CSS 4.1.8 with OKLCH color space support
- **Internationalization**: i18next with Chinese-first localization

### Backend Architecture (Rust + Tauri 2)
- **Entry Point**: `src-tauri/src/main.rs` - Tauri app initialization and command registration
- **Command Modules**: `src-tauri/src/commands/` - Organized by feature:
  - `claude.rs` - Claude CLI integration and process management
  - `agents.rs` - Agent system for GitHub integration and automation
  - `mcp.rs` - Model Context Protocol server management
  - `provider.rs` - API provider switching (core Windows feature)
  - `translator.rs` - Translation middleware services
  - `usage.rs` - Usage analytics and metrics
  - `storage.rs` - SQLite database operations
- **Process Management**: `src-tauri/src/process/` - Cross-platform process lifecycle
- **Database**: SQLite with rusqlite for embedded data storage
- **Security**: Tauri's security model with CSP and scoped filesystem access

### Key Integrations
- **Claude CLI**: Native subprocess management with real-time output streaming
- **MCP Protocol**: Full Model Context Protocol support for server management
- **Provider Switching**: Silent API provider switching without UI disruption
- **Windows Optimization**: Native Windows API integration for enhanced desktop experience

## Core Development Patterns

### Frontend Patterns
```typescript
// API calls with error handling
const handleAction = async () => {
  try {
    const result = await api.someCommand(params);
    setToast({ message: "Success", type: "success" });
  } catch (error) {
    console.error("Operation failed:", error);
    setToast({ message: `Error: ${error}`, type: "error" });
  }
};

// Component props with proper TypeScript interfaces
interface ComponentProps {
  data: SomeType[];
  onAction: (item: SomeType) => void;
  loading?: boolean;
}

// React hooks for state management
const [loading, setLoading] = useState(false);
const [data, setData] = useState<Type[]>([]);
```

### Backend Patterns
```rust
// Tauri command structure
#[tauri::command]
pub async fn command_name(param: String) -> Result<ReturnType, String> {
    match some_operation(param).await {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("Operation failed: {}", e))
    }
}

// Error handling pattern
async fn internal_function() -> Result<Data, Box<dyn std::error::Error>> {
    let result = some_async_operation().await?;
    process_result(result)
}

// Database operations with rusqlite
fn database_operation(conn: &Connection) -> Result<Vec<Record>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT * FROM table WHERE condition = ?")?;
    let records = stmt.query_map([param], |row| {
        Ok(Record { /* field mappings */ })
    })?;
    records.collect()
}
```

## Key Features and Implementation

### 1. Provider Management (Core Feature)
- **Location**: `src-tauri/src/commands/provider.rs` + `src/components/ProviderManager.tsx`
- **Purpose**: Silent switching between API providers without UI disruption
- **Implementation**: Environment variable management with automatic Claude process restart

### 2. Claude CLI Integration
- **Location**: `src-tauri/src/commands/claude.rs` + `src/components/ClaudeCodeSession.tsx`
- **Purpose**: Native Claude CLI subprocess management with streaming output
- **Key Features**: Session management, real-time output, process lifecycle control

### 3. MCP Server Management
- **Location**: `src-tauri/src/commands/mcp.rs` + `src/components/MCPManager.tsx`
- **Purpose**: Full Model Context Protocol server configuration and management
- **Scope**: Local, project, and user-level server configurations

### 4. Agent System
- **Location**: `src-tauri/src/commands/agents.rs` + `src/components/CCAgents.tsx`
- **Purpose**: GitHub-integrated agent system with import/export capabilities
- **Features**: Agent marketplace, execution tracking, metrics collection

### 5. Translation Middleware
- **Location**: `src-tauri/src/commands/translator.rs` + `src/components/TranslationSettings.tsx`
- **Purpose**: Real-time translation service with caching
- **Implementation**: API-based translation with intelligent language detection

## Build Configuration

### Development Profiles
- **Development**: `npm run tauri dev` - Full hot-reload with debugging
- **Fast Build**: `npm run tauri:build-fast` - Uses `dev-release` profile for faster iteration
- **Production**: `npm run tauri build` - Optimized for size and performance

### Rust Build Optimization
```toml
[profile.release]
opt-level = "z"      # Optimize for size
lto = true           # Link Time Optimization
strip = true         # Strip debug symbols
codegen-units = 1    # Single-threaded optimization
```

### Vite Configuration
- **Code Splitting**: Manual chunks for vendor libraries
- **Optimization**: ESBuild minification with CSS optimization
- **Development**: HMR on port 1420 with Tauri integration

## Database Schema

### Core Tables
- **agents**: Agent definitions and configurations
- **agent_runs**: Execution history and metrics
- **usage_logs**: Token usage and cost tracking
- **checkpoints**: Session state management
- **provider_configs**: API provider configurations

## Environment Setup

### Required Tools
- **Node.js**: 18+ (LTS recommended)
- **Rust**: Latest stable via rustup
- **Bun**: Recommended for optimal package management performance
- **System Dependencies**: Windows Build Tools (Windows), Xcode CLI (macOS)

### Configuration Files
- **Tauri**: `src-tauri/tauri.conf.json` - App configuration and permissions
- **Vite**: `vite.config.ts` - Frontend build configuration
- **TypeScript**: `tsconfig.json` - Strict type checking enabled
- **Rust**: `src-tauri/Cargo.toml` - Dependencies and build profiles

## Development Guidelines

### Code Organization
- Follow existing patterns in similar components
- Use TypeScript interfaces for all data structures
- Implement proper error handling at all levels
- Maintain separation between UI logic and business logic

### Performance Considerations
- Use React.memo() for expensive components
- Implement virtual scrolling for large lists (see ClaudeCodeSession)
- Leverage Rust's async/await for backend operations
- Cache expensive operations where appropriate

### Security Practices
- Never hardcode API keys or sensitive data
- Use Tauri's scoped filesystem access
- Validate all user inputs on both frontend and backend
- Follow CSP guidelines for web content

## Common Development Tasks

### Adding a New Tauri Command
1. Define the command in appropriate module under `src-tauri/src/commands/`
2. Register it in `src-tauri/src/main.rs` invoke_handler
3. Add TypeScript interface in `src/lib/api.ts`
4. Implement frontend integration in relevant component

### Adding a New UI Component
1. Create component in `src/components/`
2. Follow existing naming conventions (PascalCase)
3. Use TypeScript with proper prop interfaces
4. Integrate with existing UI component library patterns

### Database Schema Changes
1. Update relevant command modules for new table structures
2. Implement migration logic in initialization functions
3. Update TypeScript interfaces to match new schema
4. Test with both fresh installs and existing databases

## Debugging and Troubleshooting

### Frontend Debugging
- Use browser DevTools with React Developer Tools
- Check console for TypeScript compilation errors
- Monitor network tab for API call failures
- Use Tauri's development console for backend communication

### Backend Debugging
- Use `cargo check` for compilation issues
- Enable debug logging with `env_logger`
- Check Tauri's console output for command execution
- Use `cargo test` for unit test validation

### Common Issues
- **Build Failures**: Often related to Rust toolchain or Node.js version mismatches
- **CLI Integration**: Verify Claude CLI installation and PATH configuration
- **Process Management**: Check Windows permissions for subprocess creation
- **Database Locks**: Ensure proper connection management in concurrent operations