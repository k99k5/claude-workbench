use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use crate::router::error::{RouterResult, RouterErrorExt};
use crate::commands::provider::ProviderConfig as WorkbenchProvider;

/// Router配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterConfig {
    /// 是否启用Router
    pub enabled: bool,
    /// 监听端口
    pub port: u16,
    /// 请求超时时间(毫秒)
    pub timeout_ms: u64,
    /// 最大重试次数
    pub max_retries: u8,
    /// 自动启动Router进程
    pub auto_start: bool,
    /// 启用成本优化
    pub cost_optimization: bool,
    /// 启用故障转移
    pub fallback_enabled: bool,
}

/// 路由模式枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutingMode {
    /// 仅使用原生Claude CLI
    Native,
    /// 仅使用Router
    RouterOnly,
    /// 智能路由选择
    SmartRouting,
    /// 手动选择模式
    Manual,
}

impl Default for RoutingMode {
    fn default() -> Self {
        RoutingMode::SmartRouting
    }
}

/// Router提供商配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterProvider {
    /// 提供商名称
    pub name: String,
    /// API基础URL
    pub api_base_url: String,
    /// API密钥
    pub api_key: String,
    /// 支持的模型列表
    pub models: Vec<String>,
    /// 可选的转换器配置
    pub transformer: Option<TransformerConfig>,
    /// 优先级 (1-10, 10最高)
    pub priority: u8,
    /// 是否启用
    pub enabled: bool,
}

/// 转换器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformerConfig {
    /// 最大token限制
    pub max_tokens: Option<u32>,
    /// 是否启用工具增强
    pub tool_enhancement: bool,
    /// 自定义参数
    pub custom_params: HashMap<String, serde_json::Value>,
}

/// 路由规则配置
/// 动态路由规则
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicRoutingRule {
    /// 规则ID
    pub id: String,
    /// 规则名称
    pub name: String,
    /// 触发关键词列表
    pub keywords: Vec<String>,
    /// 目标模型 (provider,model格式)
    pub target_model: String,
    /// 优先级 (数字越大优先级越高)
    pub priority: i32,
    /// 是否启用
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutingRules {
    /// 默认路由
    pub default: String,
    /// 后台任务路由
    pub background: Option<String>,
    /// 思考型任务路由
    pub think: Option<String>,
    /// 长上下文任务路由
    pub long_context: Option<String>,
    /// 编程任务路由
    pub coding: Option<String>,
    /// 分析任务路由
    pub analysis: Option<String>,
    /// 动态路由规则列表
    #[serde(default)]
    pub dynamic_rules: Vec<DynamicRoutingRule>,
}

impl Default for RoutingRules {
    fn default() -> Self {
        Self {
            default: "anthropic,claude-3-sonnet-20240229".to_string(),
            background: Some("deepseek,deepseek-chat".to_string()),
            think: Some("anthropic,claude-3-opus-20240229".to_string()),
            long_context: Some("google,gemini-pro".to_string()),
            coding: Some("openai,gpt-4-turbo".to_string()),
            analysis: Some("anthropic,claude-3-sonnet-20240229".to_string()),
            dynamic_rules: Vec::new(),
        }
    }
}

/// 全局设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    /// 全局API密钥
    pub api_key: Option<String>,
    /// 监听主机
    pub host: String,
    /// API超时时间(毫秒)
    pub api_timeout_ms: u64,
    /// 非交互模式
    pub non_interactive_mode: bool,
    /// 日志级别
    pub log_level: String,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            api_key: None,
            host: "127.0.0.1".to_string(),
            api_timeout_ms: 30000,
            non_interactive_mode: false,
            log_level: "info".to_string(),
        }
    }
}

/// Router数据配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterConfigData {
    /// 提供商列表
    pub providers: Vec<RouterProvider>,
    /// 路由规则
    pub routing_rules: RoutingRules,
    /// 全局设置
    pub global_settings: GlobalSettings,
}

/// 集成设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationSettings {
    /// 自动同步配置
    pub auto_sync_config: bool,
    /// 启用原生回退
    pub fallback_to_native: bool,
    /// 路由模式
    pub routing_mode: RoutingMode,
    /// 启用成本优化
    pub cost_optimization: bool,
    /// 健康检查间隔(秒)
    pub health_check_interval: u64,
}

impl Default for IntegrationSettings {
    fn default() -> Self {
        Self {
            auto_sync_config: true,
            fallback_to_native: true,
            routing_mode: RoutingMode::SmartRouting,
            cost_optimization: true,
            health_check_interval: 30,
        }
    }
}

/// 集成配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegratedConfig {
    /// Router基础配置
    pub router: RouterConfig,
    /// Router数据配置
    pub router_data: RouterConfigData,
    /// 集成设置
    pub integration: IntegrationSettings,
}

/// 统一配置管理器
pub struct ConfigManager {
    config_path: PathBuf,
    router_config_path: PathBuf,
    config: IntegratedConfig,
}

impl ConfigManager {
    /// 创建新的配置管理器
    pub async fn new() -> RouterResult<Self> {
        let config_dir = crate::router::get_router_config_dir()?;
        let config_path = config_dir.join("integrated_config.json");
        let router_config_path = config_dir.join("router_config.json");
        
        // 加载或创建默认配置
        let config = if config_path.exists() {
            Self::load_config(&config_path).await?
        } else {
            let default_config = Self::create_default_config();
            Self::save_config(&config_path, &default_config).await?;
            default_config
        };
        
        Ok(Self {
            config_path,
            router_config_path,
            config,
        })
    }
    
    /// 创建默认配置
    fn create_default_config() -> IntegratedConfig {
        IntegratedConfig {
            router: RouterConfig {
                enabled: false,
                port: 3456,
                timeout_ms: 30000,
                max_retries: 3,
                auto_start: true,
                cost_optimization: true,
                fallback_enabled: true,
            },
            router_data: RouterConfigData {
                providers: vec![],
                routing_rules: RoutingRules::default(),
                global_settings: GlobalSettings::default(),
            },
            integration: IntegrationSettings::default(),
        }
    }
    
    /// 从文件加载配置
    async fn load_config(path: &PathBuf) -> RouterResult<IntegratedConfig> {
        let content = fs::read_to_string(path).await
            .config_context("读取配置文件失败")?;
        
        let config: IntegratedConfig = serde_json::from_str(&content)
            .config_context("解析配置文件失败")?;
        
        Ok(config)
    }
    
    /// 保存配置到文件
    async fn save_config(path: &PathBuf, config: &IntegratedConfig) -> RouterResult<()> {
        let content = serde_json::to_string_pretty(config)
            .config_context("序列化配置失败")?;
        
        // 确保目录存在
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await
                .config_context("创建配置目录失败")?;
        }
        
        fs::write(path, content).await
            .config_context("写入配置文件失败")?;
        
        Ok(())
    }
    
    /// 获取当前配置
    pub fn get_config(&self) -> &IntegratedConfig {
        &self.config
    }
    
    /// 更新路由配置
    pub async fn update_router_config(&mut self, router_config: RouterConfig) -> RouterResult<()> {
        self.config.router = router_config;
        self.save_current_config().await?;
        Ok(())
    }
    
    /// 更新路由模式
    pub async fn update_routing_mode(&mut self, mode: RoutingMode) -> RouterResult<()> {
        self.config.integration.routing_mode = mode;
        self.save_current_config().await?;
        Ok(())
    }
    
    /// 更新完整配置
    pub async fn update_config(&mut self, config: IntegratedConfig) -> RouterResult<()> {
        self.config = config;
        self.save_current_config().await?;
        Ok(())
    }
    
    /// 从Workbench配置同步到Router配置
    pub async fn sync_from_workbench(&mut self, providers: &[WorkbenchProvider]) -> RouterResult<()> {
        log::info!("从Workbench同步配置到Router, 提供商数量: {}", providers.len());
        
        // 转换Workbench提供商配置到Router格式
        let router_providers: Vec<RouterProvider> = providers
            .iter()
            .enumerate()
            .map(|(index, wb_provider)| RouterProvider {
                name: wb_provider.name.clone(),
                api_base_url: wb_provider.base_url.clone(),
                api_key: wb_provider.auth_token.clone().unwrap_or_default(),
                models: vec![], // 需要从API动态获取
                transformer: None,
                priority: (10 - index.min(9)) as u8, // 基于顺序设置优先级
                enabled: true,
            })
            .collect();
            
        self.config.router_data.providers = router_providers;
        
        // 保存集成配置和Router配置
        self.save_current_config().await?;
        self.save_router_config().await?;
        
        log::info!("配置同步完成");
        Ok(())
    }
    
    /// 保存当前配置
    async fn save_current_config(&self) -> RouterResult<()> {
        Self::save_config(&self.config_path, &self.config).await
    }
    
    /// 保存Router配置文件(供claude-code-router使用)
    async fn save_router_config(&self) -> RouterResult<()> {
        let router_config = serde_json::json!({
            "providers": self.config.router_data.providers,
            "routing_rules": self.config.router_data.routing_rules,
            "global_settings": self.config.router_data.global_settings
        });
        
        let content = serde_json::to_string_pretty(&router_config)
            .config_context("序列化Router配置失败")?;
            
        fs::write(&self.router_config_path, content).await
            .config_context("写入Router配置文件失败")?;
            
        Ok(())
    }
    
    /// 获取Router配置文件路径
    pub fn get_router_config_path(&self) -> &PathBuf {
        &self.router_config_path
    }
    
    /// 验证配置有效性
    pub fn validate_config(&self) -> RouterResult<Vec<String>> {
        let mut warnings = Vec::new();
        
        // 检查Router配置
        if self.config.router.enabled && self.config.router_data.providers.is_empty() {
            warnings.push("Router已启用但未配置任何提供商".to_string());
        }
        
        if self.config.router.port < 1024 {
            warnings.push("Router端口号小于1024，可能需要管理员权限".to_string());
        }
        
        // 检查提供商配置
        for provider in &self.config.router_data.providers {
            if provider.enabled && provider.api_key.is_empty() {
                warnings.push(format!("提供商 {} 已启用但未配置API密钥", provider.name));
            }
            
            if provider.enabled && !provider.api_base_url.starts_with("http") {
                warnings.push(format!("提供商 {} 的API地址格式可能不正确", provider.name));
            }
        }
        
        Ok(warnings)
    }
}