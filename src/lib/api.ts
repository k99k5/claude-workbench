import { invoke } from "@tauri-apps/api/core";
import type { HooksConfiguration } from '@/types/hooks';

/** Process type for tracking in ProcessRegistry */
export type ProcessType = 
  | { AgentRun: { agent_id: number; agent_name: string } }
  | { ClaudeSession: { session_id: string } };

/** Information about a running process */
export interface ProcessInfo {
  run_id: number;
  process_type: ProcessType;
  pid: number;
  started_at: string;
  project_path: string;
  task: string;
  model: string;
}

/**
 * Represents a project in the ~/.claude/projects directory
 */
export interface Project {
  /** The project ID (derived from the directory name) */
  id: string;
  /** The original project path (decoded from the directory name) */
  path: string;
  /** List of session IDs (JSONL file names without extension) */
  sessions: string[];
  /** Unix timestamp when the project directory was created */
  created_at: number;
}

/**
 * Represents a session with its metadata
 */
export interface Session {
  /** The session ID (UUID) */
  id: string;
  /** The project ID this session belongs to */
  project_id: string;
  /** The project path */
  project_path: string;
  /** Optional todo data associated with this session */
  todo_data?: any;
  /** Unix timestamp when the session file was created */
  created_at: number;
  /** First user message content (if available) */
  first_message?: string;
  /** Timestamp of the first user message (if available) */
  message_timestamp?: string;
}

/**
 * Represents the settings from ~/.claude/settings.json
 */
export interface ClaudeSettings {
  [key: string]: any;
}

/**
 * Represents the Claude Code version status
 */
export interface ClaudeVersionStatus {
  /** Whether Claude Code is installed and working */
  is_installed: boolean;
  /** The version string if available */
  version?: string;
  /** The full output from the command */
  output: string;
}

/**
 * Represents a CLAUDE.md file found in the project
 */
export interface ClaudeMdFile {
  /** Relative path from the project root */
  relative_path: string;
  /** Absolute path to the file */
  absolute_path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: number;
}

/**
 * Represents a file or directory entry
 */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  extension?: string;
}

/**
 * Represents a Claude installation found on the system
 */
export interface ClaudeInstallation {
  /** Full path to the Claude binary (or "claude-code" for sidecar) */
  path: string;
  /** Version string if available */
  version?: string;
  /** Source of discovery (e.g., "nvm", "system", "homebrew", "which", "bundled") */
  source: string;
  /** Type of installation */
  installation_type: "Bundled" | "System" | "Custom";
}

// Agent API types
export interface Agent {
  id?: number;
  name: string;
  icon: string;
  system_prompt: string;
  default_task?: string;
  model: string;
  hooks?: string; // JSON string of HooksConfiguration
  created_at: string;
  updated_at: string;
}

export interface AgentExport {
  version: number;
  exported_at: string;
  agent: {
    name: string;
    icon: string;
    system_prompt: string;
    default_task?: string;
    model: string;
    hooks?: string;
  };
}

export interface GitHubAgentFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  sha: string;
}

export interface AgentRun {
  id?: number;
  agent_id: number;
  agent_name: string;
  agent_icon: string;
  task: string;
  model: string;
  project_path: string;
  session_id: string;
  status: string; // 'pending', 'running', 'completed', 'failed', 'cancelled'
  pid?: number;
  process_started_at?: string;
  created_at: string;
  completed_at?: string;
}

export interface AgentRunMetrics {
  duration_ms?: number;
  total_tokens?: number;
  cost_usd?: number;
  message_count?: number;
}

export interface AgentRunWithMetrics {
  id?: number;
  agent_id: number;
  agent_name: string;
  agent_icon: string;
  task: string;
  model: string;
  project_path: string;
  session_id: string;
  status: string; // 'pending', 'running', 'completed', 'failed', 'cancelled'
  pid?: number;
  process_started_at?: string;
  created_at: string;
  completed_at?: string;
  metrics?: AgentRunMetrics;
  output?: string; // Real-time JSONL content
}

// Usage Dashboard types
export interface UsageEntry {
  project: string;
  timestamp: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  cost: number;
}

export interface ModelUsage {
  model: string;
  total_cost: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  session_count: number;
}

export interface DailyUsage {
  date: string;
  total_cost: number;
  total_tokens: number;
  models_used: string[];
}

export interface ProjectUsage {
  project_path: string;
  project_name: string;
  total_cost: number;
  total_tokens: number;
  session_count: number;
  last_used: string;
}

export interface ApiBaseUrlUsage {
  api_base_url: string;
  total_cost: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  session_count: number;
}

export interface UsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  total_sessions: number;
  by_model: ModelUsage[];
  by_date: DailyUsage[];
  by_project: ProjectUsage[];
  by_api_base_url?: ApiBaseUrlUsage[];
}

export interface UsageOverview {
  total_cost: number;
  total_sessions: number;
  total_tokens: number;
  today_cost: number;
  week_cost: number;
  top_model?: string;
  top_project?: string;
}

export interface SessionCacheTokens {
  session_id: string;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
}

/**
 * Represents a checkpoint in the session timeline
 */
export interface Checkpoint {
  id: string;
  sessionId: string;
  projectId: string;
  messageIndex: number;
  timestamp: string;
  description?: string;
  parentCheckpointId?: string;
  metadata: CheckpointMetadata;
}

/**
 * Metadata associated with a checkpoint
 */
export interface CheckpointMetadata {
  totalTokens: number;
  modelUsed: string;
  userPrompt: string;
  fileChanges: number;
  snapshotSize: number;
}

/**
 * Represents a file snapshot at a checkpoint
 */
export interface FileSnapshot {
  checkpointId: string;
  filePath: string;
  content: string;
  hash: string;
  isDeleted: boolean;
  permissions?: number;
  size: number;
}

/**
 * Represents a node in the timeline tree
 */
export interface TimelineNode {
  checkpoint: Checkpoint;
  children: TimelineNode[];
  fileSnapshotIds: string[];
}

/**
 * The complete timeline for a session
 */
export interface SessionTimeline {
  sessionId: string;
  rootNode?: TimelineNode;
  currentCheckpointId?: string;
  autoCheckpointEnabled: boolean;
  checkpointStrategy: CheckpointStrategy;
  totalCheckpoints: number;
}

/**
 * Strategy for automatic checkpoint creation
 */
export type CheckpointStrategy = 'manual' | 'per_prompt' | 'per_tool_use' | 'smart';

/**
 * Result of a checkpoint operation
 */
export interface CheckpointResult {
  checkpoint: Checkpoint;
  filesProcessed: number;
  warnings: string[];
}

/**
 * Diff between two checkpoints
 */
export interface CheckpointDiff {
  fromCheckpointId: string;
  toCheckpointId: string;
  modifiedFiles: FileDiff[];
  addedFiles: string[];
  deletedFiles: string[];
  tokenDelta: number;
}

/**
 * Diff for a single file
 */
export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  diffContent?: string;
}

/**
 * Provider configuration for API switching
 */
export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  base_url: string;
  auth_token?: string;
  api_key?: string;
  api_key_helper?: string;
  model?: string;
  enable_auto_api_key_helper?: boolean;
}

/**
 * Current provider configuration from environment variables
 */
export interface CurrentProviderConfig {
  anthropic_base_url?: string;
  anthropic_auth_token?: string;
  anthropic_api_key?: string;
  anthropic_api_key_helper?: string;
  anthropic_model?: string;
}

/**
 * Represents an MCP server configuration
 */
export interface MCPServer {
  /** Server name/identifier */
  name: string;
  /** Transport type: "stdio" or "sse" */
  transport: string;
  /** Command to execute (for stdio) */
  command?: string;
  /** Command arguments (for stdio) */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
  /** URL endpoint (for SSE) */
  url?: string;
  /** Configuration scope: "local", "project", or "user" */
  scope: string;
  /** Whether the server is currently active */
  is_active: boolean;
  /** Server status */
  status: ServerStatus;
}

/**
 * Server status information
 */
export interface ServerStatus {
  /** Whether the server is running */
  running: boolean;
  /** Last error message if any */
  error?: string;
  /** Last checked timestamp */
  last_checked?: number;
}

/**
 * MCP configuration for project scope (.mcp.json)
 */
export interface MCPProjectConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Individual server configuration in .mcp.json
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Represents a custom slash command
 */
export interface SlashCommand {
  /** Unique identifier for the command */
  id: string;
  /** Command name (without prefix) */
  name: string;
  /** Full command with prefix (e.g., "/project:optimize") */
  full_command: string;
  /** Command scope: "project" or "user" */
  scope: string;
  /** Optional namespace (e.g., "frontend" in "/project:frontend:component") */
  namespace?: string;
  /** Path to the markdown file */
  file_path: string;
  /** Command content (markdown body) */
  content: string;
  /** Optional description from frontmatter */
  description?: string;
  /** Allowed tools from frontmatter */
  allowed_tools: string[];
  /** Whether the command has bash commands (!) */
  has_bash_commands: boolean;
  /** Whether the command has file references (@) */
  has_file_references: boolean;
  /** Whether the command uses $ARGUMENTS placeholder */
  accepts_arguments: boolean;
}


/**
 * Result of saving clipboard image
 */
export interface SavedImageResult {
  success: boolean;
  file_path?: string;
  error?: string;
}

/**
 * Result of adding a server
 */
export interface AddServerResult {
  success: boolean;
  message: string;
  server_name?: string;
}

/**
 * Translation configuration interface
 */
export interface TranslationConfig {
  enabled: boolean;
  api_base_url: string;
  api_key: string;
  model: string;
  timeout_seconds: number;
  cache_ttl_seconds: number;
}

/**
 * Translation cache statistics
 */
export interface TranslationCacheStats {
  total_entries: number;
  expired_entries: number;
  active_entries: number;
}

/**
 * Auto-compact configuration
 */
export interface AutoCompactConfig {
  /** Enable automatic compaction */
  enabled: boolean;
  /** Maximum context tokens before triggering compaction */
  max_context_tokens: number;
  /** Threshold percentage to trigger compaction (0.0-1.0) */
  compaction_threshold: number;
  /** Minimum time between compactions in seconds */
  min_compaction_interval: number;
  /** Strategy for compaction */
  compaction_strategy: CompactionStrategy;
  /** Whether to preserve recent messages */
  preserve_recent_messages: boolean;
  /** Number of recent messages to preserve */
  preserve_message_count: number;
  /** Custom compaction instructions */
  custom_instructions?: string;
}

/**
 * Compaction strategies
 */
export type CompactionStrategy =
  | 'Smart'
  | 'Aggressive'
  | 'Conservative'
  | { Custom: string };

/**
 * Session context information
 */
export interface SessionContext {
  session_id: string;
  project_path: string;
  current_tokens: number;
  message_count: number;
  last_compaction?: string; // ISO timestamp
  compaction_count: number;
  model: string;
  status: SessionStatus;
}

/**
 * Session status
 */
export type SessionStatus =
  | 'Active'
  | 'Idle'
  | 'Compacting'
  | { CompactionFailed: string };

/**
 * Auto-compact status information
 */
export interface AutoCompactStatus {
  enabled: boolean;
  is_monitoring: boolean;
  sessions_count: number;
  total_compactions: number;
  max_context_tokens: number;
  compaction_threshold: number;
}

/**
 * Import result for multiple servers
 */
export interface ImportResult {
  imported_count: number;
  failed_count: number;
  servers: ImportServerResult[];
}

/**
 * Result for individual server import
 */
export interface ImportServerResult {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * API client for interacting with the Rust backend
 */
export const api = {
  /**
   * Lists all projects in the ~/.claude/projects directory
   * @returns Promise resolving to an array of projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      return await invoke<Project[]>("list_projects");
    } catch (error) {
      console.error("Failed to list projects:", error);
      throw error;
    }
  },

  /**
   * Retrieves sessions for a specific project
   * @param projectId - The ID of the project to retrieve sessions for
   * @returns Promise resolving to an array of sessions
   */
  async getProjectSessions(projectId: string): Promise<Session[]> {
    try {
      return await invoke<Session[]>('get_project_sessions', { projectId });
    } catch (error) {
      console.error("Failed to get project sessions:", error);
      throw error;
    }
  },

  /**
   * Removes a project from the project list (without deleting files)
   * @param projectId - The ID of the project to remove from list
   * @returns Promise resolving to success message
   */
  async deleteProject(projectId: string): Promise<string> {
    try {
      return await invoke<string>('delete_project', { projectId });
    } catch (error) {
      console.error("Failed to remove project from list:", error);
      throw error;
    }
  },

  /**
   * Restores a hidden project back to the project list
   * @param projectId - The ID of the project to restore
   * @returns Promise resolving to success message
   */
  async restoreProject(projectId: string): Promise<string> {
    try {
      return await invoke<string>('restore_project', { projectId });
    } catch (error) {
      console.error("Failed to restore project:", error);
      throw error;
    }
  },

  /**
   * Lists all hidden projects
   * @returns Promise resolving to array of hidden project IDs
   */
  async listHiddenProjects(): Promise<string[]> {
    try {
      return await invoke<string[]>('list_hidden_projects');
    } catch (error) {
      console.error("Failed to list hidden projects:", error);
      throw error;
    }
  },

  /**
   * Permanently delete a project and all its files
   * @param projectId - The project ID to permanently delete
   * @returns Promise resolving to success message
   */
  async deleteProjectPermanently(projectId: string): Promise<string> {
    try {
      return await invoke<string>('delete_project_permanently', { projectId });
    } catch (error) {
      console.error("Failed to permanently delete project:", error);
      throw error;
    }
  },

  /**
   * Fetch list of agents from GitHub repository
   * @returns Promise resolving to list of available agents on GitHub
   */
  async fetchGitHubAgents(): Promise<GitHubAgentFile[]> {
    try {
      return await invoke<GitHubAgentFile[]>('fetch_github_agents');
    } catch (error) {
      console.error("Failed to fetch GitHub agents:", error);
      throw error;
    }
  },

  /**
   * Fetch and preview a specific agent from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the agent export data
   */
  async fetchGitHubAgentContent(downloadUrl: string): Promise<AgentExport> {
    try {
      return await invoke<AgentExport>('fetch_github_agent_content', { downloadUrl });
    } catch (error) {
      console.error("Failed to fetch GitHub agent content:", error);
      throw error;
    }
  },

  /**
   * Import an agent directly from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromGitHub(downloadUrl: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_github', { downloadUrl });
    } catch (error) {
      console.error("Failed to import agent from GitHub:", error);
      throw error;
    }
  },

  /**
   * Reads the Claude settings file
   * @returns Promise resolving to the settings object
   */
  async getClaudeSettings(): Promise<ClaudeSettings> {
    try {
      const result = await invoke<ClaudeSettings>("get_claude_settings");
      console.log("Raw result from get_claude_settings:", result);
      
      // Due to #[serde(flatten)] in Rust, the result is directly the settings object
      return result;
    } catch (error) {
      console.error("Failed to get Claude settings:", error);
      throw error;
    }
  },

  /**
   * Opens a new Claude Code session
   * @param path - Optional path to open the session in
   * @returns Promise resolving when the session is opened
   */
  async openNewSession(path?: string): Promise<string> {
    try {
      return await invoke<string>("open_new_session", { path });
    } catch (error) {
      console.error("Failed to open new session:", error);
      throw error;
    }
  },

  /**
   * Reads the CLAUDE.md system prompt file
   * @returns Promise resolving to the system prompt content
   */
  async getSystemPrompt(): Promise<string> {
    try {
      return await invoke<string>("get_system_prompt");
    } catch (error) {
      console.error("Failed to get system prompt:", error);
      throw error;
    }
  },

  /**
   * Checks if Claude Code is installed and gets its version
   * @returns Promise resolving to the version status
   */
  async checkClaudeVersion(): Promise<ClaudeVersionStatus> {
    try {
      return await invoke<ClaudeVersionStatus>("check_claude_version");
    } catch (error) {
      console.error("Failed to check Claude version:", error);
      throw error;
    }
  },

  /**
   * Saves the CLAUDE.md system prompt file
   * @param content - The new content for the system prompt
   * @returns Promise resolving when the file is saved
   */
  async saveSystemPrompt(content: string): Promise<string> {
    try {
      return await invoke<string>("save_system_prompt", { content });
    } catch (error) {
      console.error("Failed to save system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves the Claude settings file
   * @param settings - The settings object to save
   * @returns Promise resolving when the settings are saved
   */
  async saveClaudeSettings(settings: ClaudeSettings): Promise<string> {
    try {
      console.log("Saving Claude settings:", settings);
      return await invoke<string>("save_claude_settings", { settings });
    } catch (error) {
      console.error("Failed to save Claude settings:", error);
      throw error;
    }
  },

  /**
   * Finds all CLAUDE.md files in a project directory
   * @param projectPath - The absolute path to the project
   * @returns Promise resolving to an array of CLAUDE.md files
   */
  async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    try {
      return await invoke<ClaudeMdFile[]>("find_claude_md_files", { projectPath });
    } catch (error) {
      console.error("Failed to find CLAUDE.md files:", error);
      throw error;
    }
  },

  /**
   * Reads a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @returns Promise resolving to the file content
   */
  async readClaudeMdFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_claude_md_file", { filePath });
    } catch (error) {
      console.error("Failed to read CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Saves a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @param content - The new content for the file
   * @returns Promise resolving when the file is saved
   */
  async saveClaudeMdFile(filePath: string, content: string): Promise<string> {
    try {
      return await invoke<string>("save_claude_md_file", { filePath, content });
    } catch (error) {
      console.error("Failed to save CLAUDE.md file:", error);
      throw error;
    }
  },

  // Agent API methods
  
  /**
   * Lists all CC agents
   * @returns Promise resolving to an array of agents
   */
  async listAgents(): Promise<Agent[]> {
    try {
      return await invoke<Agent[]>('list_agents');
    } catch (error) {
      console.error("Failed to list agents:", error);
      throw error;
    }
  },

  /**
   * Creates a new agent
   * @param name - The agent name
   * @param icon - The icon identifier
   * @param system_prompt - The system prompt for the agent
   * @param default_task - Optional default task
   * @param model - Optional model (defaults to 'sonnet')
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the created agent
   */
  async createAgent(
    name: string, 
    icon: string, 
    system_prompt: string, 
    default_task?: string, 
    model?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('create_agent', { 
        name, 
        icon, 
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model,
        hooks
      });
    } catch (error) {
      console.error("Failed to create agent:", error);
      throw error;
    }
  },

  /**
   * Updates an existing agent
   * @param id - The agent ID
   * @param name - The updated name
   * @param icon - The updated icon
   * @param system_prompt - The updated system prompt
   * @param default_task - Optional default task
   * @param model - Optional model
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the updated agent
   */
  async updateAgent(
    id: number, 
    name: string, 
    icon: string, 
    system_prompt: string, 
    default_task?: string, 
    model?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('update_agent', { 
        id, 
        name, 
        icon, 
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model,
        hooks
      });
    } catch (error) {
      console.error("Failed to update agent:", error);
      throw error;
    }
  },

  /**
   * Deletes an agent
   * @param id - The agent ID to delete
   * @returns Promise resolving when the agent is deleted
   */
  async deleteAgent(id: number): Promise<void> {
    try {
      return await invoke('delete_agent', { id });
    } catch (error) {
      console.error("Failed to delete agent:", error);
      throw error;
    }
  },

  /**
   * Gets a single agent by ID
   * @param id - The agent ID
   * @returns Promise resolving to the agent
   */
  async getAgent(id: number): Promise<Agent> {
    try {
      return await invoke<Agent>('get_agent', { id });
    } catch (error) {
      console.error("Failed to get agent:", error);
      throw error;
    }
  },

  /**
   * Exports a single agent to JSON format
   * @param id - The agent ID to export
   * @returns Promise resolving to the JSON string
   */
  async exportAgent(id: number): Promise<string> {
    try {
      return await invoke<string>('export_agent', { id });
    } catch (error) {
      console.error("Failed to export agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from JSON data
   * @param jsonData - The JSON string containing the agent export
   * @returns Promise resolving to the imported agent
   */
  async importAgent(jsonData: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent', { jsonData });
    } catch (error) {
      console.error("Failed to import agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from a file
   * @param filePath - The path to the JSON file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromFile(filePath: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_file', { filePath });
    } catch (error) {
      console.error("Failed to import agent from file:", error);
      throw error;
    }
  },

  /**
   * Executes an agent
   * @param agentId - The agent ID to execute
   * @param projectPath - The project path to run the agent in
   * @param task - The task description
   * @param model - Optional model override
   * @returns Promise resolving to the run ID when execution starts
   */
  async executeAgent(agentId: number, projectPath: string, task: string, model?: string): Promise<number> {
    try {
      return await invoke<number>('execute_agent', { agentId, projectPath, task, model });
    } catch (error) {
      console.error("Failed to execute agent:", error);
      // Return a sentinel value to indicate error
      throw new Error(`Failed to execute agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Lists agent runs with metrics
   * @param agentId - Optional agent ID to filter runs
   * @returns Promise resolving to an array of agent runs with metrics
   */
  async listAgentRuns(agentId?: number): Promise<AgentRunWithMetrics[]> {
    try {
      return await invoke<AgentRunWithMetrics[]>('list_agent_runs', { agentId });
    } catch (error) {
      console.error("Failed to list agent runs:", error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  /**
   * Gets a single agent run by ID with metrics
   * @param id - The run ID
   * @returns Promise resolving to the agent run with metrics
   */
  async getAgentRun(id: number): Promise<AgentRunWithMetrics> {
    try {
      return await invoke<AgentRunWithMetrics>('get_agent_run', { id });
    } catch (error) {
      console.error("Failed to get agent run:", error);
      throw new Error(`Failed to get agent run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Gets a single agent run by ID with real-time metrics from JSONL
   * @param id - The run ID
   * @returns Promise resolving to the agent run with metrics
   */
  async getAgentRunWithRealTimeMetrics(id: number): Promise<AgentRunWithMetrics> {
    try {
      return await invoke<AgentRunWithMetrics>('get_agent_run_with_real_time_metrics', { id });
    } catch (error) {
      console.error("Failed to get agent run with real-time metrics:", error);
      throw new Error(`Failed to get agent run with real-time metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Lists all currently running agent sessions
   * @returns Promise resolving to list of running agent sessions
   */
  async listRunningAgentSessions(): Promise<AgentRun[]> {
    try {
      return await invoke<AgentRun[]>('list_running_sessions');
    } catch (error) {
      console.error("Failed to list running agent sessions:", error);
      throw new Error(`Failed to list running agent sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Kills a running agent session
   * @param runId - The run ID to kill
   * @returns Promise resolving to whether the session was successfully killed
   */
  async killAgentSession(runId: number): Promise<boolean> {
    try {
      return await invoke<boolean>('kill_agent_session', { runId });
    } catch (error) {
      console.error("Failed to kill agent session:", error);
      throw new Error(`Failed to kill agent session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Gets the status of a specific agent session
   * @param runId - The run ID to check
   * @returns Promise resolving to the session status or null if not found
   */
  async getSessionStatus(runId: number): Promise<string | null> {
    try {
      return await invoke<string | null>('get_session_status', { runId });
    } catch (error) {
      console.error("Failed to get session status:", error);
      throw new Error(`Failed to get session status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Cleanup finished processes and update their status
   * @returns Promise resolving to list of run IDs that were cleaned up
   */
  async cleanupFinishedProcesses(): Promise<number[]> {
    try {
      return await invoke<number[]>('cleanup_finished_processes');
    } catch (error) {
      console.error("Failed to cleanup finished processes:", error);
      throw new Error(`Failed to cleanup finished processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get real-time output for a running session (with live output fallback)
   * @param runId - The run ID to get output for
   * @returns Promise resolving to the current session output (JSONL format)
   */
  async getSessionOutput(runId: number): Promise<string> {
    try {
      return await invoke<string>('get_session_output', { runId });
    } catch (error) {
      console.error("Failed to get session output:", error);
      throw new Error(`Failed to get session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get live output directly from process stdout buffer
   * @param runId - The run ID to get live output for
   * @returns Promise resolving to the current live output
   */
  async getLiveSessionOutput(runId: number): Promise<string> {
    try {
      return await invoke<string>('get_live_session_output', { runId });
    } catch (error) {
      console.error("Failed to get live session output:", error);
      throw new Error(`Failed to get live session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Start streaming real-time output for a running session
   * @param runId - The run ID to stream output for
   * @returns Promise that resolves when streaming starts
   */
  async streamSessionOutput(runId: number): Promise<void> {
    try {
      return await invoke<void>('stream_session_output', { runId });
    } catch (error) {
      console.error("Failed to start streaming session output:", error);
      throw new Error(`Failed to start streaming session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Loads the JSONL history for a specific session
   */
  async loadSessionHistory(sessionId: string, projectId: string): Promise<any[]> {
    return invoke("load_session_history", { sessionId, projectId });
  },

  /**
   * Loads the JSONL history for a specific agent session
   * Similar to loadSessionHistory but searches across all project directories
   * @param sessionId - The session ID (UUID)
   * @returns Promise resolving to array of session messages
   */
  async loadAgentSessionHistory(sessionId: string): Promise<any[]> {
    try {
      return await invoke<any[]>('load_agent_session_history', { sessionId });
    } catch (error) {
      console.error("Failed to load agent session history:", error);
      throw error;
    }
  },

  /**
   * Executes a new interactive Claude Code session with streaming output
   */
  async executeClaudeCode(projectPath: string, prompt: string, model: string): Promise<void> {
    return invoke("execute_claude_code", { projectPath, prompt, model });
  },

  /**
   * Continues an existing Claude Code conversation with streaming output
   */
  async continueClaudeCode(projectPath: string, prompt: string, model: string): Promise<void> {
    return invoke("continue_claude_code", { projectPath, prompt, model });
  },

  /**
   * Resumes an existing Claude Code session by ID with streaming output
   */
  async resumeClaudeCode(projectPath: string, sessionId: string, prompt: string, model: string): Promise<void> {
    return invoke("resume_claude_code", { projectPath, sessionId, prompt, model });
  },

  /**
   * Cancels the currently running Claude Code execution
   * @param sessionId - Optional session ID to cancel a specific session
   */
  async cancelClaudeExecution(sessionId?: string): Promise<void> {
    return invoke("cancel_claude_execution", { sessionId });
  },

  /**
   * Lists all currently running Claude sessions
   * @returns Promise resolving to list of running Claude sessions
   */
  async listRunningClaudeSessions(): Promise<any[]> {
    return invoke("list_running_claude_sessions");
  },

  /**
   * Gets live output from a Claude session
   * @param sessionId - The session ID to get output for
   * @returns Promise resolving to the current live output
   */
  async getClaudeSessionOutput(sessionId: string): Promise<string> {
    return invoke("get_claude_session_output", { sessionId });
  },

  /**
   * Lists files and directories in a given path
   */
  async listDirectoryContents(directoryPath: string): Promise<FileEntry[]> {
    return invoke("list_directory_contents", { directoryPath });
  },

  /**
   * Searches for files and directories matching a pattern
   */
  async searchFiles(basePath: string, query: string): Promise<FileEntry[]> {
    return invoke("search_files", { basePath, query });
  },

  /**
   * Gets overall usage statistics
   * @returns Promise resolving to usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_usage_stats");
    } catch (error) {
      console.error("Failed to get usage stats:", error);
      throw error;
    }
  },

  /**
   * Get usage overview statistics - fast loading with essential metrics only
   */
  async getUsageOverview(): Promise<UsageOverview> {
    try {
      return await invoke<UsageOverview>("get_usage_overview");
    } catch (error) {
      console.error("Failed to get usage overview:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics filtered by date range
   * @param startDate - Start date (ISO format)
   * @param endDate - End date (ISO format)
   * @returns Promise resolving to usage statistics
   */
  async getUsageByDateRange(startDate: string, endDate: string): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_usage_by_date_range", { startDate, endDate });
    } catch (error) {
      console.error("Failed to get usage by date range:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics grouped by session
   * @param since - Optional start date (YYYYMMDD)
   * @param until - Optional end date (YYYYMMDD)
   * @param order - Optional sort order ('asc' or 'desc')
   * @returns Promise resolving to an array of session usage data
   */
  async getSessionStats(
    since?: string,
    until?: string,
    order?: "asc" | "desc"
  ): Promise<ProjectUsage[]> {
    try {
      return await invoke<ProjectUsage[]>("get_session_stats", {
        since,
        until,
        order,
      });
    } catch (error) {
      console.error("Failed to get session stats:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics for today only
   * @returns Promise resolving to today's usage statistics
   */
  async getTodayUsageStats(): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_today_usage_stats");
    } catch (error) {
      console.error("Failed to get today's usage stats:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics grouped by API Base URL
   * @returns Promise resolving to array of API Base URL usage statistics
   */
  async getUsageByApiBaseUrl(): Promise<ApiBaseUrlUsage[]> {
    try {
      return await invoke<ApiBaseUrlUsage[]>("get_usage_by_api_base_url");
    } catch (error) {
      console.error("Failed to get usage by API Base URL:", error);
      throw error;
    }
  },

  /**
   * Gets detailed usage entries with optional filtering
   * @param limit - Optional limit for number of entries
   * @returns Promise resolving to array of usage entries
   */
  async getUsageDetails(limit?: number): Promise<UsageEntry[]> {
    try {
      return await invoke<UsageEntry[]>("get_usage_details", { limit });
    } catch (error) {
      console.error("Failed to get usage details:", error);
      throw error;
    }
  },

  /**
   * Gets cache tokens for a specific session
   * @param sessionId - The session ID to get cache tokens for
   * @returns Promise resolving to session cache tokens
   */
  async getSessionCacheTokens(sessionId: string): Promise<SessionCacheTokens> {
    try {
      return await invoke<SessionCacheTokens>("get_session_cache_tokens", { sessionId });
    } catch (error) {
      console.error("Failed to get session cache tokens:", error);
      throw error;
    }
  },

  /**
   * Creates a checkpoint for the current session state
   */
  async createCheckpoint(
    sessionId: string,
    projectId: string,
    projectPath: string,
    messageIndex?: number,
    description?: string
  ): Promise<CheckpointResult> {
    return invoke("create_checkpoint", {
      sessionId,
      projectId,
      projectPath,
      messageIndex,
      description
    });
  },

  /**
   * Restores a session to a specific checkpoint
   */
  async restoreCheckpoint(
    checkpointId: string,
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<CheckpointResult> {
    return invoke("restore_checkpoint", {
      checkpointId,
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Lists all checkpoints for a session
   */
  async listCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<Checkpoint[]> {
    return invoke("list_checkpoints", {
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Forks a new timeline branch from a checkpoint
   */
  async forkFromCheckpoint(
    checkpointId: string,
    sessionId: string,
    projectId: string,
    projectPath: string,
    newSessionId: string,
    description?: string
  ): Promise<CheckpointResult> {
    return invoke("fork_from_checkpoint", {
      checkpointId,
      sessionId,
      projectId,
      projectPath,
      newSessionId,
      description
    });
  },

  /**
   * Gets the timeline for a session
   */
  async getSessionTimeline(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<SessionTimeline> {
    return invoke("get_session_timeline", {
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Updates checkpoint settings for a session
   */
  async updateCheckpointSettings(
    sessionId: string,
    projectId: string,
    projectPath: string,
    autoCheckpointEnabled: boolean,
    checkpointStrategy: CheckpointStrategy
  ): Promise<void> {
    return invoke("update_checkpoint_settings", {
      sessionId,
      projectId,
      projectPath,
      autoCheckpointEnabled,
      checkpointStrategy
    });
  },

  /**
   * Gets diff between two checkpoints
   */
  async getCheckpointDiff(
    fromCheckpointId: string,
    toCheckpointId: string,
    sessionId: string,
    projectId: string
  ): Promise<CheckpointDiff> {
    try {
      return await invoke<CheckpointDiff>("get_checkpoint_diff", {
        fromCheckpointId,
        toCheckpointId,
        sessionId,
        projectId
      });
    } catch (error) {
      console.error("Failed to get checkpoint diff:", error);
      throw error;
    }
  },

  /**
   * Tracks a message for checkpointing
   */
  async trackCheckpointMessage(
    sessionId: string,
    projectId: string,
    projectPath: string,
    message: string
  ): Promise<void> {
    try {
      await invoke("track_checkpoint_message", {
        sessionId,
        projectId,
        projectPath,
        message
      });
    } catch (error) {
      console.error("Failed to track checkpoint message:", error);
      throw error;
    }
  },

  /**
   * Checks if auto-checkpoint should be triggered
   */
  async checkAutoCheckpoint(
    sessionId: string,
    projectId: string,
    projectPath: string,
    message: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>("check_auto_checkpoint", {
        sessionId,
        projectId,
        projectPath,
        message
      });
    } catch (error) {
      console.error("Failed to check auto checkpoint:", error);
      throw error;
    }
  },

  /**
   * Triggers cleanup of old checkpoints
   */
  async cleanupOldCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string,
    keepCount: number
  ): Promise<number> {
    try {
      return await invoke<number>("cleanup_old_checkpoints", {
        sessionId,
        projectId,
        projectPath,
        keepCount
      });
    } catch (error) {
      console.error("Failed to cleanup old checkpoints:", error);
      throw error;
    }
  },

  /**
   * Gets checkpoint settings for a session
   */
  async getCheckpointSettings(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<{
    auto_checkpoint_enabled: boolean;
    checkpoint_strategy: CheckpointStrategy;
    total_checkpoints: number;
    current_checkpoint_id?: string;
  }> {
    try {
      return await invoke("get_checkpoint_settings", {
        sessionId,
        projectId,
        projectPath
      });
    } catch (error) {
      console.error("Failed to get checkpoint settings:", error);
      throw error;
    }
  },

  /**
   * Clears checkpoint manager for a session (cleanup on session end)
   */
  async clearCheckpointManager(sessionId: string): Promise<void> {
    try {
      await invoke("clear_checkpoint_manager", { sessionId });
    } catch (error) {
      console.error("Failed to clear checkpoint manager:", error);
      throw error;
    }
  },

  /**
   * Tracks a batch of messages for a session for checkpointing
   */
  trackSessionMessages: (
    sessionId: string, 
    projectId: string, 
    projectPath: string, 
    messages: string[]
  ): Promise<void> =>
    invoke("track_session_messages", { sessionId, projectId, projectPath, messages }),

  /**
   * Adds a new MCP server
   */
  async mcpAdd(
    name: string,
    transport: string,
    command?: string,
    args: string[] = [],
    env: Record<string, string> = {},
    url?: string,
    scope: string = "local"
  ): Promise<AddServerResult> {
    try {
      return await invoke<AddServerResult>("mcp_add", {
        name,
        transport,
        command,
        args,
        env,
        url,
        scope
      });
    } catch (error) {
      console.error("Failed to add MCP server:", error);
      throw error;
    }
  },

  /**
   * Lists all configured MCP servers
   */
  async mcpList(): Promise<MCPServer[]> {
    try {
      console.log("API: Calling mcp_list...");
      const result = await invoke<MCPServer[]>("mcp_list");
      console.log("API: mcp_list returned:", result);
      return result;
    } catch (error) {
      console.error("API: Failed to list MCP servers:", error);
      throw error;
    }
  },

  /**
   * Gets details for a specific MCP server
   */
  async mcpGet(name: string): Promise<MCPServer> {
    try {
      return await invoke<MCPServer>("mcp_get", { name });
    } catch (error) {
      console.error("Failed to get MCP server:", error);
      throw error;
    }
  },

  /**
   * Removes an MCP server
   */
  async mcpRemove(name: string): Promise<string> {
    try {
      return await invoke<string>("mcp_remove", { name });
    } catch (error) {
      console.error("Failed to remove MCP server:", error);
      throw error;
    }
  },

  /**
   * Adds an MCP server from JSON configuration
   */
  async mcpAddJson(name: string, jsonConfig: string, scope: string = "local"): Promise<AddServerResult> {
    try {
      return await invoke<AddServerResult>("mcp_add_json", { name, jsonConfig, scope });
    } catch (error) {
      console.error("Failed to add MCP server from JSON:", error);
      throw error;
    }
  },

  /**
   * Imports MCP servers from Claude Desktop
   */
  async mcpAddFromClaudeDesktop(scope: string = "local"): Promise<ImportResult> {
    try {
      return await invoke<ImportResult>("mcp_add_from_claude_desktop", { scope });
    } catch (error) {
      console.error("Failed to import from Claude Desktop:", error);
      throw error;
    }
  },

  /**
   * Starts Claude Code as an MCP server
   */
  async mcpServe(): Promise<string> {
    try {
      return await invoke<string>("mcp_serve");
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      throw error;
    }
  },

  /**
   * Tests connection to an MCP server
   */
  async mcpTestConnection(name: string): Promise<string> {
    try {
      return await invoke<string>("mcp_test_connection", { name });
    } catch (error) {
      console.error("Failed to test MCP connection:", error);
      throw error;
    }
  },

  /**
   * Exports MCP server configuration from .claude.json
   */
  async mcpExportConfig(): Promise<string> {
    try {
      return await invoke<string>("mcp_export_config");
    } catch (error) {
      console.error("Failed to export MCP configuration:", error);
      throw error;
    }
  },

  /**
   * Resets project-scoped server approval choices
   */
  async mcpResetProjectChoices(): Promise<string> {
    try {
      return await invoke<string>("mcp_reset_project_choices");
    } catch (error) {
      console.error("Failed to reset project choices:", error);
      throw error;
    }
  },

  /**
   * Gets the status of MCP servers
   */
  async mcpGetServerStatus(): Promise<Record<string, ServerStatus>> {
    try {
      return await invoke<Record<string, ServerStatus>>("mcp_get_server_status");
    } catch (error) {
      console.error("Failed to get server status:", error);
      throw error;
    }
  },

  /**
   * Reads .mcp.json from the current project
   */
  async mcpReadProjectConfig(projectPath: string): Promise<MCPProjectConfig> {
    try {
      return await invoke<MCPProjectConfig>("mcp_read_project_config", { projectPath });
    } catch (error) {
      console.error("Failed to read project MCP config:", error);
      throw error;
    }
  },

  /**
   * Saves .mcp.json to the current project
   */
  async mcpSaveProjectConfig(projectPath: string, config: MCPProjectConfig): Promise<string> {
    try {
      return await invoke<string>("mcp_save_project_config", { projectPath, config });
    } catch (error) {
      console.error("Failed to save project MCP config:", error);
      throw error;
    }
  },

  /**
   * Get the stored Claude binary path from settings
   * @returns Promise resolving to the path if set, null otherwise
   */
  async getClaudeBinaryPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_claude_binary_path");
    } catch (error) {
      console.error("Failed to get Claude binary path:", error);
      throw error;
    }
  },

  /**
   * Set the Claude binary path in settings
   * @param path - The absolute path to the Claude binary
   * @returns Promise resolving when the path is saved
   */
  async setClaudeBinaryPath(path: string): Promise<void> {
    try {
      return await invoke<void>("set_claude_binary_path", { path });
    } catch (error) {
      console.error("Failed to set Claude binary path:", error);
      throw error;
    }
  },

  /**
   * List all available Claude installations on the system
   * @returns Promise resolving to an array of Claude installations
   */
  async listClaudeInstallations(): Promise<ClaudeInstallation[]> {
    try {
      return await invoke<ClaudeInstallation[]>("list_claude_installations");
    } catch (error) {
      console.error("Failed to list Claude installations:", error);
      throw error;
    }
  },

  // Storage API methods

  /**
   * Lists all tables in the SQLite database
   * @returns Promise resolving to an array of table information
   */
  async storageListTables(): Promise<any[]> {
    try {
      return await invoke<any[]>("storage_list_tables");
    } catch (error) {
      console.error("Failed to list tables:", error);
      throw error;
    }
  },

  /**
   * Reads table data with pagination
   * @param tableName - Name of the table to read
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of rows per page
   * @param searchQuery - Optional search query
   * @returns Promise resolving to table data with pagination info
   */
  async storageReadTable(
    tableName: string,
    page: number,
    pageSize: number,
    searchQuery?: string
  ): Promise<any> {
    try {
      return await invoke<any>("storage_read_table", {
        tableName,
        page,
        pageSize,
        searchQuery,
      });
    } catch (error) {
      console.error("Failed to read table:", error);
      throw error;
    }
  },

  /**
   * Updates a row in a table
   * @param tableName - Name of the table
   * @param primaryKeyValues - Map of primary key column names to values
   * @param updates - Map of column names to new values
   * @returns Promise resolving when the row is updated
   */
  async storageUpdateRow(
    tableName: string,
    primaryKeyValues: Record<string, any>,
    updates: Record<string, any>
  ): Promise<void> {
    try {
      return await invoke<void>("storage_update_row", {
        tableName,
        primaryKeyValues,
        updates,
      });
    } catch (error) {
      console.error("Failed to update row:", error);
      throw error;
    }
  },

  /**
   * Deletes a row from a table
   * @param tableName - Name of the table
   * @param primaryKeyValues - Map of primary key column names to values
   * @returns Promise resolving when the row is deleted
   */
  async storageDeleteRow(
    tableName: string,
    primaryKeyValues: Record<string, any>
  ): Promise<void> {
    try {
      return await invoke<void>("storage_delete_row", {
        tableName,
        primaryKeyValues,
      });
    } catch (error) {
      console.error("Failed to delete row:", error);
      throw error;
    }
  },

  /**
   * Inserts a new row into a table
   * @param tableName - Name of the table
   * @param values - Map of column names to values
   * @returns Promise resolving to the last insert row ID
   */
  async storageInsertRow(
    tableName: string,
    values: Record<string, any>
  ): Promise<number> {
    try {
      return await invoke<number>("storage_insert_row", {
        tableName,
        values,
      });
    } catch (error) {
      console.error("Failed to insert row:", error);
      throw error;
    }
  },

  /**
   * Executes a raw SQL query
   * @param query - SQL query string
   * @returns Promise resolving to query result
   */
  async storageExecuteSql(query: string): Promise<any> {
    try {
      return await invoke<any>("storage_execute_sql", { query });
    } catch (error) {
      console.error("Failed to execute SQL:", error);
      throw error;
    }
  },

  /**
   * Resets the entire database
   * @returns Promise resolving when the database is reset
   */
  async storageResetDatabase(): Promise<void> {
    try {
      return await invoke<void>("storage_reset_database");
    } catch (error) {
      console.error("Failed to reset database:", error);
      throw error;
    }
  },

  /**
   * Get hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to the hooks configuration
   */
  async getHooksConfig(scope: 'user' | 'project' | 'local', projectPath?: string): Promise<HooksConfiguration> {
    try {
      return await invoke<HooksConfiguration>("get_hooks_config", { scope, projectPath });
    } catch (error) {
      console.error("Failed to get hooks config:", error);
      throw error;
    }
  },

  /**
   * Update hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param hooks - The hooks configuration to save
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to success message
   */
  async updateHooksConfig(
    scope: 'user' | 'project' | 'local',
    hooks: HooksConfiguration,
    projectPath?: string
  ): Promise<string> {
    try {
      return await invoke<string>("update_hooks_config", { scope, projectPath, hooks });
    } catch (error) {
      console.error("Failed to update hooks config:", error);
      throw error;
    }
  },

  /**
   * Validate a hook command syntax
   * @param command - The shell command to validate
   * @returns Promise resolving to validation result
   */
  async validateHookCommand(command: string): Promise<{ valid: boolean; message: string }> {
    try {
      return await invoke<{ valid: boolean; message: string }>("validate_hook_command", { command });
    } catch (error) {
      console.error("Failed to validate hook command:", error);
      throw error;
    }
  },

  /**
   * Get merged hooks configuration (respecting priority)
   * @param projectPath - The project path
   * @returns Promise resolving to merged hooks configuration
   */
  async getMergedHooksConfig(projectPath: string): Promise<HooksConfiguration> {
    try {
      const [userHooks, projectHooks, localHooks] = await Promise.all([
        this.getHooksConfig('user'),
        this.getHooksConfig('project', projectPath),
        this.getHooksConfig('local', projectPath)
      ]);

      // Import HooksManager for merging
      const { HooksManager } = await import('@/lib/hooksManager');
      return HooksManager.mergeConfigs(userHooks, projectHooks, localHooks);
    } catch (error) {
      console.error("Failed to get merged hooks config:", error);
      throw error;
    }
  },

  // Slash Commands API methods

  /**
   * Lists all available slash commands
   * @param projectPath - Optional project path to include project-specific commands
   * @returns Promise resolving to array of slash commands
   */
  async slashCommandsList(projectPath?: string): Promise<SlashCommand[]> {
    try {
      return await invoke<SlashCommand[]>("slash_commands_list", { projectPath });
    } catch (error) {
      console.error("Failed to list slash commands:", error);
      throw error;
    }
  },

  /**
   * Gets a single slash command by ID
   * @param commandId - Unique identifier of the command
   * @returns Promise resolving to the slash command
   */
  async slashCommandGet(commandId: string): Promise<SlashCommand> {
    try {
      return await invoke<SlashCommand>("slash_command_get", { commandId });
    } catch (error) {
      console.error("Failed to get slash command:", error);
      throw error;
    }
  },

  /**
   * Creates or updates a slash command
   * @param scope - Command scope: "project" or "user"
   * @param name - Command name (without prefix)
   * @param namespace - Optional namespace for organization
   * @param content - Markdown content of the command
   * @param description - Optional description
   * @param allowedTools - List of allowed tools for this command
   * @param projectPath - Required for project scope commands
   * @returns Promise resolving to the saved command
   */
  async slashCommandSave(
    scope: string,
    name: string,
    namespace: string | undefined,
    content: string,
    description: string | undefined,
    allowedTools: string[],
    projectPath?: string
  ): Promise<SlashCommand> {
    try {
      return await invoke<SlashCommand>("slash_command_save", {
        scope,
        name,
        namespace,
        content,
        description,
        allowedTools,
        projectPath
      });
    } catch (error) {
      console.error("Failed to save slash command:", error);
      throw error;
    }
  },

  /**
   * Deletes a slash command
   * @param commandId - Unique identifier of the command to delete
   * @param projectPath - Optional project path for deleting project commands
   * @returns Promise resolving to deletion message
   */
  async slashCommandDelete(commandId: string, projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("slash_command_delete", { commandId, projectPath });
    } catch (error) {
      console.error("Failed to delete slash command:", error);
      throw error;
    }
  },

  /**
   * Set custom Claude CLI path
   * @param customPath - Path to custom Claude CLI executable
   * @returns Promise resolving when path is set successfully
   */
  async setCustomClaudePath(customPath: string): Promise<void> {
    try {
      return await invoke<void>("set_custom_claude_path", { customPath });
    } catch (error) {
      console.error("Failed to set custom Claude path:", error);
      throw error;
    }
  },

  /**
   * Get current Claude CLI path (custom or auto-detected)
   * @returns Promise resolving to current Claude CLI path
   */
  async getClaudePath(): Promise<string> {
    try {
      return await invoke<string>("get_claude_path");
    } catch (error) {
      console.error("Failed to get Claude path:", error);
      throw error;
    }
  },

  /**
   * Clear custom Claude CLI path and revert to auto-detection
   * @returns Promise resolving when custom path is cleared
   */
  async clearCustomClaudePath(): Promise<void> {
    try {
      return await invoke<void>("clear_custom_claude_path");
    } catch (error) {
      console.error("Failed to clear custom Claude path:", error);
      throw error;
    }
  },



  // Clipboard API methods

  /**
   * Saves clipboard image data to a temporary file
   * @param base64Data - Base64 encoded image data
   * @param format - Optional image format
   * @returns Promise resolving to saved image result
   */
  async saveClipboardImage(base64Data: string, format?: string): Promise<SavedImageResult> {
    try {
      return await invoke<SavedImageResult>("save_clipboard_image", { base64Data, format });
    } catch (error) {
      console.error("Failed to save clipboard image:", error);
      throw error;
    }
  },

  // Provider Management API methods

  /**
   * Gets the list of preset provider configurations
   * @returns Promise resolving to array of provider configurations
   */
  async getProviderPresets(): Promise<ProviderConfig[]> {
    try {
      return await invoke<ProviderConfig[]>("get_provider_presets");
    } catch (error) {
      console.error("Failed to get provider presets:", error);
      throw error;
    }
  },

  /**
   * Gets the current provider configuration from environment variables
   * @returns Promise resolving to current configuration
   */
  async getCurrentProviderConfig(): Promise<CurrentProviderConfig> {
    try {
      return await invoke<CurrentProviderConfig>("get_current_provider_config");
    } catch (error) {
      console.error("Failed to get current provider config:", error);
      throw error;
    }
  },

  /**
   * Switches to a new provider configuration
   * @param config - The provider configuration to switch to
   * @returns Promise resolving to success message
   */
  async switchProviderConfig(config: ProviderConfig): Promise<string> {
    try {
      return await invoke<string>("switch_provider_config", { config });
    } catch (error) {
      console.error("Failed to switch provider config:", error);
      throw error;
    }
  },

  /**
   * Clears all provider-related environment variables
   * @returns Promise resolving to success message
   */
  async clearProviderConfig(): Promise<string> {
    try {
      return await invoke<string>("clear_provider_config");
    } catch (error) {
      console.error("Failed to clear provider config:", error);
      throw error;
    }
  },

  /**
   * Tests connection to a provider endpoint
   * @param baseUrl - The base URL to test
   * @returns Promise resolving to test result message
   */
  async testProviderConnection(baseUrl: string): Promise<string> {
    try {
      return await invoke<string>("test_provider_connection", { baseUrl });
    } catch (error) {
      console.error("Failed to test provider connection:", error);
      throw error;
    }
  },

  /**
   * Adds a new provider configuration
   * @param config - The provider configuration to add
   * @returns Promise resolving to success message
   */
  async addProviderConfig(config: Omit<ProviderConfig, 'id'>): Promise<string> {
    // Generate ID from name
    const id = config.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
      
    const fullConfig: ProviderConfig = {
      ...config,
      id
    };
    
    try {
      return await invoke<string>("add_provider_config", { config: fullConfig });
    } catch (error) {
      console.error("Failed to add provider config:", error);
      throw error;
    }
  },

  /**
   * Updates an existing provider configuration
   * @param config - The provider configuration to update (with id)
   * @returns Promise resolving to success message
   */
  async updateProviderConfig(config: ProviderConfig): Promise<string> {
    try {
      return await invoke<string>("update_provider_config", { config });
    } catch (error) {
      console.error("Failed to update provider config:", error);
      throw error;
    }
  },

  /**
   * Deletes a provider configuration by ID
   * @param id - The ID of the provider configuration to delete
   * @returns Promise resolving to success message
   */
  async deleteProviderConfig(id: string): Promise<string> {
    try {
      return await invoke<string>("delete_provider_config", { id });
    } catch (error) {
      console.error("Failed to delete provider config:", error);
      throw error;
    }
  },

  /**
   * Gets a single provider configuration by ID
   * @param id - The ID of the provider configuration to get
   * @returns Promise resolving to provider configuration
   */
  async getProviderConfig(id: string): Promise<ProviderConfig> {
    try {
      return await invoke<ProviderConfig>("get_provider_config", { id });
    } catch (error) {
      console.error("Failed to get provider config:", error);
      throw error;
    }
  },

  /**
   * Enhances a prompt using Claude Code SDK
   * @param prompt - The original prompt to enhance
   * @param model - The model to use for enhancement
   * @param context - Optional conversation context (recent messages)
   * @returns Promise resolving to the enhanced prompt
   */
  async enhancePrompt(prompt: string, model: "sonnet" | "opus" | "sonnet1m", context?: string[]): Promise<string> {
    try {
      return await invoke<string>("enhance_prompt", { prompt, model, context });
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
      throw error;
    }
  },

  /**
   * Enhances a prompt using Gemini CLI with gemini-2.5-pro model
   * @param prompt - The original prompt to enhance
   * @param context - Optional conversation context (recent messages)
   * @returns Promise resolving to the enhanced prompt
   */
  async enhancePromptWithGemini(prompt: string, context?: string[]): Promise<string> {
    try {
      return await invoke<string>("enhance_prompt_with_gemini", { prompt, context });
    } catch (error) {
      console.error("Failed to enhance prompt with Gemini:", error);
      throw error;
    }
  },

  // Translation API methods

  /**
   * Translates text using the translation service
   * @param text - The text to translate
   * @param targetLang - Optional target language (defaults to auto-detection)
   * @returns Promise resolving to translated text
   */
  async translateText(text: string, targetLang?: string): Promise<string> {
    try {
      return await invoke<string>("translate", { text, targetLang });
    } catch (error) {
      console.error("Failed to translate text:", error);
      throw error;
    }
  },

  /**
   * Translates multiple texts in batch
   * @param texts - Array of texts to translate
   * @param targetLang - Optional target language
   * @returns Promise resolving to array of translated texts
   */
  async translateBatch(texts: string[], targetLang?: string): Promise<string[]> {
    try {
      return await invoke<string[]>("translate_batch", { texts, targetLang });
    } catch (error) {
      console.error("Failed to batch translate texts:", error);
      throw error;
    }
  },

  /**
   * Gets the current translation configuration
   * @returns Promise resolving to translation configuration
   */
  async getTranslationConfig(): Promise<TranslationConfig> {
    try {
      return await invoke<TranslationConfig>("get_translation_config");
    } catch (error) {
      console.error("Failed to get translation config:", error);
      throw error;
    }
  },

  /**
   * Updates the translation configuration
   * @param config - New translation configuration
   * @returns Promise resolving to success message
   */
  async updateTranslationConfig(config: TranslationConfig): Promise<string> {
    try {
      return await invoke<string>("update_translation_config", { config });
    } catch (error) {
      console.error("Failed to update translation config:", error);
      throw error;
    }
  },

  /**
   * Clears the translation cache
   * @returns Promise resolving to success message
   */
  async clearTranslationCache(): Promise<string> {
    try {
      return await invoke<string>("clear_translation_cache");
    } catch (error) {
      console.error("Failed to clear translation cache:", error);
      throw error;
    }
  },

  /**
   * Gets translation cache statistics
   * @returns Promise resolving to cache statistics
   */
  async getTranslationCacheStats(): Promise<TranslationCacheStats> {
    try {
      return await invoke<TranslationCacheStats>("get_translation_cache_stats");
    } catch (error) {
      console.error("Failed to get translation cache stats:", error);
      throw error;
    }
  },

  /**
   * Detects the language of the given text
   * @param text - The text to analyze
   * @returns Promise resolving to detected language code
   */
  async detectTextLanguage(text: string): Promise<string> {
    try {
      return await invoke<string>("detect_text_language", { text });
    } catch (error) {
      console.error("Failed to detect text language:", error);
      throw error;
    }
  },

  /**
   * Initializes the translation service
   * @param config - Optional translation configuration
   * @returns Promise resolving to success message
   */
  async initTranslationService(config?: TranslationConfig): Promise<string> {
    try {
      return await invoke<string>("init_translation_service_command", { config });
    } catch (error) {
      console.error("Failed to initialize translation service:", error);
      throw error;
    }
  },

  // Auto-Compact Context Management API methods

  /**
   * Initializes the auto-compact manager
   * @returns Promise resolving when manager is initialized
   */
  async initAutoCompactManager(): Promise<void> {
    try {
      return await invoke<void>("init_auto_compact_manager");
    } catch (error) {
      console.error("Failed to initialize auto-compact manager:", error);
      throw error;
    }
  },

  /**
   * Registers a Claude session for auto-compact monitoring
   * @param sessionId - The session ID to register
   * @param projectPath - The project path
   * @param model - The model being used
   * @returns Promise resolving when session is registered
   */
  async registerAutoCompactSession(sessionId: string, projectPath: string, model: string): Promise<void> {
    try {
      return await invoke<void>("register_auto_compact_session", { sessionId, projectPath, model });
    } catch (error) {
      console.error("Failed to register auto-compact session:", error);
      throw error;
    }
  },

  /**
   * Updates session token count and checks for auto-compact trigger
   * @param sessionId - The session ID
   * @param tokenCount - Current token count
   * @returns Promise resolving to whether compaction was triggered
   */
  async updateSessionContext(sessionId: string, tokenCount: number): Promise<boolean> {
    try {
      return await invoke<boolean>("update_session_context", { sessionId, tokenCount });
    } catch (error) {
      console.error("Failed to update session context:", error);
      throw error;
    }
  },

  /**
   * Manually triggers compaction for a session
   * @param sessionId - The session ID
   * @param customInstructions - Optional custom compaction instructions
   * @returns Promise resolving when compaction is complete
   */
  async triggerManualCompaction(sessionId: string, customInstructions?: string): Promise<void> {
    try {
      return await invoke<void>("trigger_manual_compaction", { sessionId, customInstructions });
    } catch (error) {
      console.error("Failed to trigger manual compaction:", error);
      throw error;
    }
  },

  /**
   * Gets the current auto-compact configuration
   * @returns Promise resolving to the configuration
   */
  async getAutoCompactConfig(): Promise<AutoCompactConfig> {
    try {
      return await invoke<AutoCompactConfig>("get_auto_compact_config");
    } catch (error) {
      console.error("Failed to get auto-compact config:", error);
      throw error;
    }
  },

  /**
   * Updates the auto-compact configuration
   * @param config - The new configuration
   * @returns Promise resolving when configuration is updated
   */
  async updateAutoCompactConfig(config: AutoCompactConfig): Promise<void> {
    try {
      return await invoke<void>("update_auto_compact_config", { config });
    } catch (error) {
      console.error("Failed to update auto-compact config:", error);
      throw error;
    }
  },

  /**
   * Gets session context statistics
   * @param sessionId - The session ID
   * @returns Promise resolving to session context information
   */
  async getSessionContextStats(sessionId: string): Promise<SessionContext | null> {
    try {
      return await invoke<SessionContext | null>("get_session_context_stats", { sessionId });
    } catch (error) {
      console.error("Failed to get session context stats:", error);
      throw error;
    }
  },

  /**
   * Gets all monitored sessions
   * @returns Promise resolving to array of session contexts
   */
  async getAllMonitoredSessions(): Promise<SessionContext[]> {
    try {
      return await invoke<SessionContext[]>("get_all_monitored_sessions");
    } catch (error) {
      console.error("Failed to get monitored sessions:", error);
      throw error;
    }
  },

  /**
   * Unregisters session from auto-compact monitoring
   * @param sessionId - The session ID to unregister
   * @returns Promise resolving when session is unregistered
   */
  async unregisterAutoCompactSession(sessionId: string): Promise<void> {
    try {
      return await invoke<void>("unregister_auto_compact_session", { sessionId });
    } catch (error) {
      console.error("Failed to unregister auto-compact session:", error);
      throw error;
    }
  },

  /**
   * Stops auto-compact monitoring
   * @returns Promise resolving when monitoring is stopped
   */
  async stopAutoCompactMonitoring(): Promise<void> {
    try {
      return await invoke<void>("stop_auto_compact_monitoring");
    } catch (error) {
      console.error("Failed to stop auto-compact monitoring:", error);
      throw error;
    }
  },

  /**
   * Starts auto-compact monitoring
   * @returns Promise resolving when monitoring is started
   */
  async startAutoCompactMonitoring(): Promise<void> {
    try {
      return await invoke<void>("start_auto_compact_monitoring");
    } catch (error) {
      console.error("Failed to start auto-compact monitoring:", error);
      throw error;
    }
  },

  /**
   * Gets auto-compact status and statistics
   * @returns Promise resolving to status information
   */
  async getAutoCompactStatus(): Promise<AutoCompactStatus> {
    try {
      return await invoke<AutoCompactStatus>("get_auto_compact_status");
    } catch (error) {
      console.error("Failed to get auto-compact status:", error);
      throw error;
    }
  },

  /**
   * Gets active sessions information
   * @returns Promise resolving to array of active session info
   */
  async getActiveSessions(): Promise<any[]> {
    try {
      return await invoke("get_active_sessions");
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      throw error;
    }
  },

  // Subagent Management & Specialization API methods

  /**
   * Initializes the subagent specialization system
   * @returns Promise resolving to success message
   */
  async initSubagentSystem(): Promise<string> {
    try {
      return await invoke<string>("init_subagent_system");
    } catch (error) {
      console.error("Failed to initialize subagent system:", error);
      throw error;
    }
  },

  /**
   * Lists all available subagent specialties
   * @returns Promise resolving to array of subagent specialties
   */
  async listSubagentSpecialties(): Promise<any[]> {
    try {
      return await invoke<any[]>("list_subagent_specialties");
    } catch (error) {
      console.error("Failed to list subagent specialties:", error);
      throw error;
    }
  },

  /**
   * Intelligent routing - selects most suitable subagent for user request
   * @param userRequest - The user's request to route
   * @returns Promise resolving to routing decision
   */
  async routeToSubagent(userRequest: string): Promise<any> {
    try {
      return await invoke<any>("route_to_subagent", { userRequest });
    } catch (error) {
      console.error("Failed to route to subagent:", error);
      throw error;
    }
  },

  /**
   * Updates subagent specialty configuration
   * @param agentId - The agent ID to update
   * @param specialty - The specialty type
   * @param specialtyConfig - Optional JSON configuration
   * @param routingKeywords - Optional JSON array of routing keywords
   * @param autoInvoke - Whether to auto-invoke this subagent
   * @returns Promise resolving when update is complete
   */
  async updateSubagentSpecialty(
    agentId: number,
    specialty: string,
    specialtyConfig?: string,
    routingKeywords?: string,
    autoInvoke?: boolean
  ): Promise<void> {
    try {
      return await invoke<void>("update_subagent_specialty", {
        agentId,
        specialty,
        specialtyConfig,
        routingKeywords,
        autoInvoke
      });
    } catch (error) {
      console.error("Failed to update subagent specialty:", error);
      throw error;
    }
  },

  /**
   * Gets subagent routing history
   * @param limit - Optional limit for number of entries
   * @returns Promise resolving to array of routing history entries
   */
  async getRoutingHistory(limit?: number): Promise<any[]> {
    try {
      return await invoke<any[]>("get_routing_history", { limit });
    } catch (error) {
      console.error("Failed to get routing history:", error);
      throw error;
    }
  },

  /**
   * Provides feedback on routing decision for ML improvement
   * @param logId - The routing log ID
   * @param feedback - Feedback score (1: good, 0: neutral, -1: bad)
   * @returns Promise resolving when feedback is recorded
   */
  async provideRoutingFeedback(logId: number, feedback: number): Promise<void> {
    try {
      return await invoke<void>("provide_routing_feedback", { logId, feedback });
    } catch (error) {
      console.error("Failed to provide routing feedback:", error);
      throw error;
    }
  },

  /**
   * Executes professional code review using specialized code-reviewer agent
   * @param filePaths - Array of file paths to review
   * @param reviewScope - Optional scope: "security", "performance", "all" (default)
   * @returns Promise resolving to detailed code review results
   */
  async executeCodeReview(filePaths: string[], reviewScope?: string): Promise<import('@/types/subagents').CodeReviewResult> {
    try {
      return await invoke<import('@/types/subagents').CodeReviewResult>("execute_code_review", {
        filePaths,
        reviewScope
      });
    } catch (error) {
      console.error("Failed to execute code review:", error);
      throw error;
    }
  },

  // Enhanced Hooks Automation API methods

  /**
   * Triggers a hook event with context
   * @param event - The hook event name
   * @param context - The hook execution context
   * @returns Promise resolving to hook chain execution result
   */
  async triggerHookEvent(event: string, context: any): Promise<any> {
    try {
      return await invoke<any>("trigger_hook_event", { event, context });
    } catch (error) {
      console.error("Failed to trigger hook event:", error);
      throw error;
    }
  },

  /**
   * Tests a hook condition expression
   * @param condition - The condition expression to test
   * @param context - The hook context for evaluation
   * @returns Promise resolving to whether condition is true
   */
  async testHookCondition(condition: string, context: any): Promise<boolean> {
    try {
      return await invoke<boolean>("test_hook_condition", { condition, context });
    } catch (error) {
      console.error("Failed to test hook condition:", error);
      throw error;
    }
  },

  /**
   * Executes pre-commit code review hook with intelligent decision making
   * @param projectPath - The project path to review
   * @param config - Optional configuration for the review hook
   * @returns Promise resolving to commit decision
   */
  async executePreCommitReview(
    projectPath: string,
    config?: import('@/types/enhanced-hooks').PreCommitCodeReviewConfig
  ): Promise<import('@/types/enhanced-hooks').CommitDecision> {
    try {
      return await invoke<import('@/types/enhanced-hooks').CommitDecision>("execute_pre_commit_review", {
        projectPath,
        config
      });
    } catch (error) {
      console.error("Failed to execute pre-commit review:", error);
      throw error;
    }
  },

};
