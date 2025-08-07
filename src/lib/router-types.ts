// Router模块类型定义 - 与Rust后端同步
// 该文件包含所有Router相关的TypeScript类型定义

/**
 * Router配置结构
 */
export interface RouterConfig {
  /** 是否启用Router */
  enabled: boolean;
  /** 监听端口 */
  port: number;
  /** 请求超时时间(毫秒) */
  timeoutMs: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 自动启动Router进程 */
  autoStart: boolean;
  /** 启用成本优化 */
  costOptimization: boolean;
  /** 启用故障转移 */
  fallbackEnabled: boolean;
}

/**
 * 路由模式枚举
 */
export enum RoutingMode {
  /** 仅使用原生Claude CLI */
  Native = 'native',
  /** 仅使用Router */
  RouterOnly = 'router_only',
  /** 智能路由选择 */
  SmartRouting = 'smart_routing',
  /** 手动选择模式 */
  Manual = 'manual',
}

/**
 * 健康状态枚举
 */
export type HealthStatus =
  | { type: 'healthy' }
  | { type: 'unhealthy'; message: string }
  | { type: 'unknown' }
  | { type: 'starting' }
  | { type: 'stopping' };

/**
 * AI模型信息
 */
export interface AIModel {
  /** 模型名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 提供商 */
  provider: string;
  /** 每token成本 (美元) */
  costPerToken?: number;
  /** 上下文长度限制 */
  contextLimit?: number;
  /** 是否可用 */
  available: boolean;
}

/**
 * Claude请求结构
 */
export interface ClaudeRequest {
  /** 用户提示 */
  prompt: string;
  /** 会话ID */
  sessionId?: string;
  /** 项目路径 */
  projectPath?: string;
  /** 模型偏好 */
  modelPreference?: string;
  /** 最大token数 */
  maxTokens?: number;
}

/**
 * Token使用统计
 */
export interface TokenUsage {
  /** 输入token数 */
  inputTokens: number;
  /** 输出token数 */
  outputTokens: number;
  /** 总token数 */
  totalTokens: number;
  /** 估算成本(美元) */
  estimatedCost?: number;
}

/**
 * Claude响应结构
 */
export interface ClaudeResponse {
  /** 响应内容 */
  content: string;
  /** 使用的模型 */
  modelUsed: string;
  /** 提供商 */
  provider: string;
  /** Token使用情况 */
  tokenUsage?: TokenUsage;
  /** 响应时间(毫秒) */
  responseTimeMs?: number;
}

/**
 * 路由统计信息
 */
export interface RouterStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总成本 */
  totalCost: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最后更新时间 */
  lastUpdated: string;
}

/**
 * 健康检查记录
 */
export interface HealthRecord {
  /** 检查时间 */
  timestamp: string;
  /** 健康状态 */
  status: HealthStatus;
  /** 响应时间(毫秒) */
  responseTimeMs?: number;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 健康监控统计信息
 */
export interface HealthStats {
  /** 总检查次数 */
  totalChecks: number;
  /** 健康检查次数 */
  healthyChecks: number;
  /** 不健康检查次数 */
  unhealthyChecks: number;
  /** 平均响应时间(毫秒) */
  averageResponseTime: number;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 可用性百分比 */
  availabilityPercentage: number;
  /** 监控开始时间 */
  monitoringStartTime: string;
  /** 最后检查时间 */
  lastCheckTime?: string;
}

/**
 * Router进程信息
 */
export interface RouterProcessInfo {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 进程ID */
  processId?: number;
  /** 健康状态 */
  healthStatus: HealthStatus;
  /** 配置信息 */
  config: RouterConfig;
}

// Router API 响应类型
export type RouterApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

// Tauri命令返回类型的封装
export type TauriResult<T> = Promise<T>;

/**
 * Router API 接口定义
 * 对应Rust后端的Tauri命令
 */
export interface RouterApi {
  // 初始化和配置
  init(): TauriResult<string>;
  getConfig(): TauriResult<RouterConfig>;
  updateConfig(config: RouterConfig): TauriResult<string>;
  getRoutingMode(): TauriResult<RoutingMode>;
  setRoutingMode(mode: RoutingMode): TauriResult<string>;
  getDefaultConfig(): TauriResult<RouterConfig>;

  // 进程管理
  initManager(): TauriResult<string>;
  startProcess(): TauriResult<string>;
  stopProcess(): TauriResult<string>;
  restartProcess(): TauriResult<string>;
  isRunning(): TauriResult<boolean>;
  getProcessId(): TauriResult<number | null>;

  // 模型管理
  getAvailableModels(): TauriResult<AIModel[]>;
  switchModel(provider: string, model: string): TauriResult<string>;
  getActiveModel(): TauriResult<[string, string]>;

  // 统计和监控
  getStats(): TauriResult<RouterStats>;
  resetStats(): TauriResult<string>;
  healthCheck(): TauriResult<boolean>;
  testConnection(): TauriResult<string>;

  // 路由请求
  routeClaudeRequest(request: ClaudeRequest): TauriResult<ClaudeResponse>;

  // 配置管理
  validateConfig(): TauriResult<string[]>;
  syncFromWorkbench(): TauriResult<string>;
}

/**
 * Router管理器类
 * 封装所有Router API调用的便捷类
 */
export class RouterManager implements RouterApi {
  private invoke: (cmd: string, args?: any) => Promise<any>;

  constructor(invokeFunction: (cmd: string, args?: any) => Promise<any>) {
    this.invoke = invokeFunction;
  }

  // 初始化和配置
  async init(): TauriResult<string> {
    return this.invoke('router_init');
  }

  async getConfig(): TauriResult<RouterConfig> {
    return this.invoke('router_get_config');
  }

  async updateConfig(config: RouterConfig): TauriResult<string> {
    return this.invoke('router_update_config', { config });
  }

  async getRoutingMode(): TauriResult<RoutingMode> {
    return this.invoke('router_get_routing_mode');
  }

  async setRoutingMode(mode: RoutingMode): TauriResult<string> {
    return this.invoke('router_set_routing_mode', { mode });
  }

  async getDefaultConfig(): TauriResult<RouterConfig> {
    return this.invoke('router_get_default_config');
  }

  // 进程管理
  async initManager(): TauriResult<string> {
    return this.invoke('router_init_manager');
  }

  async startProcess(): TauriResult<string> {
    return this.invoke('router_start_process');
  }

  async stopProcess(): TauriResult<string> {
    return this.invoke('router_stop_process');
  }

  async restartProcess(): TauriResult<string> {
    return this.invoke('router_restart_process');
  }

  async isRunning(): TauriResult<boolean> {
    return this.invoke('router_is_running');
  }

  async getProcessId(): TauriResult<number | null> {
    return this.invoke('router_get_process_id');
  }

  // 模型管理
  async getAvailableModels(): TauriResult<AIModel[]> {
    return this.invoke('router_get_available_models');
  }

  async switchModel(provider: string, model: string): TauriResult<string> {
    return this.invoke('router_switch_model', { provider, model });
  }

  async getActiveModel(): TauriResult<[string, string]> {
    return this.invoke('router_get_active_model');
  }

  // 统计和监控
  async getStats(): TauriResult<RouterStats> {
    return this.invoke('router_get_stats');
  }

  async resetStats(): TauriResult<string> {
    return this.invoke('router_reset_stats');
  }

  async healthCheck(): TauriResult<boolean> {
    return this.invoke('router_health_check');
  }

  async testConnection(): TauriResult<string> {
    return this.invoke('router_test_connection');
  }

  // 路由请求
  async routeClaudeRequest(request: ClaudeRequest): TauriResult<ClaudeResponse> {
    return this.invoke('router_route_claude_request', { request });
  }

  // 配置管理
  async validateConfig(): TauriResult<string[]> {
    return this.invoke('router_validate_config');
  }

  async syncFromWorkbench(): TauriResult<string> {
    return this.invoke('router_sync_from_workbench');
  }
}

/**
 * 创建Router管理器实例的工厂函数
 */
export function createRouterManager(invokeFunction: (cmd: string, args?: any) => Promise<any>): RouterManager {
  return new RouterManager(invokeFunction);
}

/**
 * Router状态管理Hook类型定义 (用于React)
 */
export interface RouterState {
  // 基本状态
  isInitialized: boolean;
  isRunning: boolean;
  config: RouterConfig | null;
  routingMode: RoutingMode;
  healthStatus: HealthStatus;
  
  // 统计信息
  stats: RouterStats | null;
  availableModels: AIModel[];
  activeModel: [string, string] | null;
  
  // 错误和加载状态
  loading: boolean;
  error: string | null;
  
  // 最后更新时间
  lastUpdated: Date | null;
}

/**
 * Router操作接口
 */
export interface RouterActions {
  // 初始化和配置
  initialize: () => Promise<void>;
  updateConfig: (config: RouterConfig) => Promise<void>;
  setRoutingMode: (mode: RoutingMode) => Promise<void>;
  
  // 进程控制
  startRouter: () => Promise<void>;
  stopRouter: () => Promise<void>;
  restartRouter: () => Promise<void>;
  
  // 模型管理
  refreshModels: () => Promise<void>;
  switchToModel: (provider: string, model: string) => Promise<void>;
  
  // 监控
  refreshStats: () => Promise<void>;
  performHealthCheck: () => Promise<void>;
  
  // 配置同步
  syncWithWorkbench: () => Promise<void>;
  
  // 清理
  cleanup: () => void;
}

/**
 * 默认Router配置
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  enabled: false,
  port: 3456,
  timeoutMs: 30000,
  maxRetries: 3,
  autoStart: true,
  costOptimization: true,
  fallbackEnabled: true,
};

/**
 * Router事件类型
 */
export type RouterEvent = 
  | { type: 'status_changed'; status: HealthStatus }
  | { type: 'config_updated'; config: RouterConfig }
  | { type: 'stats_updated'; stats: RouterStats }
  | { type: 'model_switched'; provider: string; model: string }
  | { type: 'error'; error: string };

/**
 * Router事件监听器类型
 */
export type RouterEventListener = (event: RouterEvent) => void;

/**
 * 工具函数
 */
export const RouterUtils = {
  /**
   * 格式化健康状态为显示文本
   */
  formatHealthStatus(status: HealthStatus): string {
    switch (status.type) {
      case 'healthy':
        return '正常';
      case 'unhealthy':
        return `异常: ${status.message}`;
      case 'unknown':
        return '未知';
      case 'starting':
        return '启动中';
      case 'stopping':
        return '停止中';
      default:
        return '未知状态';
    }
  },

  /**
   * 计算可用性百分比的颜色
   */
  getAvailabilityColor(percentage: number): 'green' | 'yellow' | 'red' {
    if (percentage >= 95) return 'green';
    if (percentage >= 80) return 'yellow';
    return 'red';
  },

  /**
   * 格式化成本显示
   */
  formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
  },

  /**
   * 验证Router配置
   */
  validateRouterConfig(config: RouterConfig): string[] {
    const errors: string[] = [];
    
    if (config.port < 1024 || config.port > 65535) {
      errors.push('端口号必须在1024-65535之间');
    }
    
    if (config.timeoutMs < 1000) {
      errors.push('超时时间不能少于1秒');
    }
    
    if (config.maxRetries < 1 || config.maxRetries > 10) {
      errors.push('重试次数必须在1-10之间');
    }
    
    return errors;
  },
};