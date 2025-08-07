// Router模块 - Claude Code Router集成
//
// 提供HTTP代理、进程管理、配置同步等核心功能
// 实现Claude Workbench与claude-code-router的深度集成

pub mod client;
pub mod config;
pub mod manager;
pub mod error;
pub mod health;

// 导出主要类型和结构
pub use client::RouterProxyClient;
pub use config::{RouterConfig, RoutingMode, ConfigManager};
pub use manager::RouterProcessManager;
pub use error::{RouterError, RouterResult, RouterErrorExt};
pub use health::HealthStatus;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// AI模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIModel {
    /// 模型名称
    pub name: String,
    /// 显示名称
    pub display_name: String,
    /// 提供商
    pub provider: String,
    /// 每token成本 (美元)
    pub cost_per_token: Option<f64>,
    /// 上下文长度限制
    pub context_limit: Option<u32>,
    /// 是否可用
    pub available: bool,
}

/// Claude请求结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeRequest {
    /// 用户提示
    pub prompt: String,
    /// 会话ID
    pub session_id: Option<String>,
    /// 项目路径
    pub project_path: Option<String>,
    /// 模型偏好
    pub model_preference: Option<String>,
    /// 最大token数
    pub max_tokens: Option<u32>,
}

/// Claude响应结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeResponse {
    /// 响应内容
    pub content: String,
    /// 使用的模型
    pub model_used: String,
    /// 提供商
    pub provider: String,
    /// Token使用情况
    pub token_usage: Option<TokenUsage>,
    /// 响应时间(毫秒)
    pub response_time_ms: Option<u64>,
}

/// Token使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    /// 输入token数
    pub input_tokens: u32,
    /// 输出token数
    pub output_tokens: u32,
    /// 总token数
    pub total_tokens: u32,
    /// 估算成本(美元)
    pub estimated_cost: Option<f64>,
}

/// 路由统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterStats {
    /// 总请求数
    pub total_requests: u64,
    /// 成功请求数
    pub successful_requests: u64,
    /// 失败请求数
    pub failed_requests: u64,
    /// 总成本
    pub total_cost: f64,
    /// 平均响应时间
    pub average_response_time: f64,
    /// 最后更新时间
    pub last_updated: DateTime<Utc>,
}

/// Router模块初始化
pub async fn init_router_module() -> RouterResult<()> {
    log::info!("初始化Router模块...");
    
    // 创建配置目录
    let config_dir = get_router_config_dir()?;
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)?;
        log::info!("创建Router配置目录: {:?}", config_dir);
    }
    
    Ok(())
}

/// 获取Router配置目录
pub fn get_router_config_dir() -> RouterResult<std::path::PathBuf> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| RouterError::ConfigError("无法获取用户主目录".to_string()))?;
    
    Ok(home_dir.join(".claude").join("router"))
}

/// 获取默认Router配置
pub fn get_default_router_config() -> RouterConfig {
    RouterConfig {
        enabled: false,
        port: 3456,
        timeout_ms: 30000,
        max_retries: 3,
        auto_start: true,
        cost_optimization: true,
        fallback_enabled: true,
    }
}