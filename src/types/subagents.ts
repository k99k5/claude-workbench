/**
 * Subagents专业化系统 TypeScript类型定义
 * 与Rust后端的结构体保持同步
 */

/**
 * 专业化子代理类型枚举
 */
export type SpecialtyType =
  | 'general'
  | 'code-reviewer'
  | 'test-engineer'
  | 'security-auditor'
  | 'performance-optimizer'
  | string; // 支持自定义专业化

/**
 * 触发条件配置
 */
export interface TriggerCondition {
  event_type: string; // "file_change", "test_failure", "security_alert"
  pattern: string;    // 匹配模式
  enabled: boolean;
}

/**
 * 专业化配置
 */
export interface SpecialtyConfig {
  allowed_tools: string[];
  trigger_conditions?: TriggerCondition[];
  context_window_size?: number;
  max_concurrent_tasks?: number;
}

/**
 * 子代理专业化定义
 */
export interface SubagentSpecialty {
  id?: number;
  specialty_type: string;
  display_name: string;
  description?: string;
  default_system_prompt: string;
  default_tools: string; // JSON array
  routing_patterns: string; // JSON array
  icon_suggestion?: string;
  created_at: string;
}

/**
 * 路由决策结果
 */
export interface RoutingDecision {
  agent_id?: number;
  specialty_type: string;
  confidence_score: number; // 0.0-1.0
  reasoning: string;
  matched_keywords: string[];
}

/**
 * 路由历史记录
 */
export interface RoutingHistory {
  user_request: string;
  selected_agent_id?: number;
  selected_specialty: string;
  confidence_score: number;
  routing_reason: string;
  user_feedback?: number; // 1: good, 0: neutral, -1: bad
  created_at: string;
}

/**
 * 子代理API接口
 */
export interface SubagentAPI {
  /**
   * 初始化子代理专业化系统
   */
  initSubagentSystem(): Promise<string>;

  /**
   * 获取所有专业化类型
   */
  listSubagentSpecialties(): Promise<SubagentSpecialty[]>;

  /**
   * 智能路由 - 根据用户请求选择最合适的子代理
   */
  routeToSubagent(userRequest: string): Promise<RoutingDecision>;

  /**
   * 更新子代理的专业化配置
   */
  updateSubagentSpecialty(
    agentId: number,
    specialty: string,
    specialtyConfig?: string,
    routingKeywords?: string,
    autoInvoke?: boolean
  ): Promise<void>;

  /**
   * 获取子代理路由历史
   */
  getRoutingHistory(limit?: number): Promise<RoutingHistory[]>;

  /**
   * 提供路由反馈（用于改进路由算法）
   */
  provideRoutingFeedback(logId: number, feedback: number): Promise<void>;
}

/**
 * 预定义的专业化配置模板
 */
export const SPECIALTY_TEMPLATES: Record<SpecialtyType, Partial<SubagentSpecialty>> = {
  'general': {
    display_name: '通用代理',
    description: '通用型智能代理，适合各种常规任务',
    icon_suggestion: 'bot',
  },
  'code-reviewer': {
    display_name: '代码审查专家',
    description: '专注于代码质量、安全性和最佳实践审查',
    icon_suggestion: 'shield-check',
  },
  'test-engineer': {
    display_name: '测试工程师',
    description: '专注于编写和执行测试，确保代码质量',
    icon_suggestion: 'flask-conical',
  },
  'security-auditor': {
    display_name: '安全审计员',
    description: '专注于安全漏洞检测和安全最佳实践',
    icon_suggestion: 'shield-alert',
  },
  'performance-optimizer': {
    display_name: '性能优化师',
    description: '专注于性能分析和优化',
    icon_suggestion: 'gauge',
  },
};

/**
 * 常用路由关键词
 */
export const ROUTING_KEYWORDS: Record<SpecialtyType, string[]> = {
  'general': [],
  'code-reviewer': [
    'review', '审查', 'check code', '代码检查', 'security', '安全', 'code quality', '代码质量'
  ],
  'test-engineer': [
    'test', '测试', 'unit test', '单元测试', 'e2e', 'integration', 'coverage', '覆盖率'
  ],
  'security-auditor': [
    'security', '安全', 'vulnerability', '漏洞', 'audit', '审计', 'penetration', '渗透'
  ],
  'performance-optimizer': [
    'performance', '性能', 'optimize', '优化', 'slow', '慢', 'bottleneck', '瓶颈', 'profiling'
  ],
};

// 代码审查结果类型
export interface CodeReviewResult {
  overall_score: number; // 0.0-10.0
  issues: CodeIssue[];
  recommendations: string[];
  summary: string;
  files_reviewed: string[];
}

// 代码问题类型
export interface CodeIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'security' | 'performance' | 'maintainability' | 'style';
  file_path: string;
  line?: number;
  message: string;
  suggestion?: string;
}