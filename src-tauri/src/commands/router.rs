use crate::router::{
    RouterProcessManager, ConfigManager,
    RouterConfig, RoutingMode,
    AIModel, RouterStats, ClaudeRequest, ClaudeResponse,
    init_router_module, get_default_router_config,
};
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tauri::State;
use serde::{Serialize, Deserialize};
use serde_json::Value;

/// CCR配置信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCRConfigInfo {
    pub providers: Vec<CCRProvider>,
    pub router_rules: CCRRouterRules,
    pub host: String,
    pub port: u16,
    pub api_timeout_ms: u64,
    pub log_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCRProvider {
    pub name: String,
    pub api_base_url: String,
    pub models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCRRouterRules {
    pub default: String,
    pub background: String,
    pub think: String,
    pub long_context: String,
    pub web_search: String,
    pub long_context_threshold: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCRModel {
    pub provider: String,
    pub model: String,
    pub full_name: String,
}

/// 从ConfigManager获取路由配置信息
#[tauri::command]
pub async fn router_get_config_from_manager(state: State<'_, RouterManagerState>) -> Result<CCRConfigInfo, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    // 转换配置格式为前端所需的格式
    let providers: Vec<CCRProvider> = config.router_data.providers.iter()
        .map(|p| CCRProvider {
            name: p.name.clone(),
            api_base_url: p.api_base_url.clone(),
            models: p.models.clone(),
        })
        .collect();
    
    let router_rules = CCRRouterRules {
        default: config.router_data.routing_rules.default.clone(),
        background: config.router_data.routing_rules.background.clone().unwrap_or_default(),
        think: config.router_data.routing_rules.think.clone().unwrap_or_default(),
        long_context: config.router_data.routing_rules.long_context.clone().unwrap_or_default(),
        web_search: config.router_data.routing_rules.analysis.clone().unwrap_or_default(),
        long_context_threshold: 60000, // TODO: 从配置中读取
    };
    
    Ok(CCRConfigInfo {
        providers,
        router_rules,
        host: config.router_data.global_settings.host.clone(),
        port: config.router.port,
        api_timeout_ms: config.router_data.global_settings.api_timeout_ms,
        log_enabled: config.router_data.global_settings.log_level != "none",
    })
}

/// 从ConfigManager获取所有可用的模型列表
#[tauri::command]
pub async fn router_get_models_from_config(state: State<'_, RouterManagerState>) -> Result<Vec<CCRModel>, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    let mut models = Vec::new();
    for provider in &config.router_data.providers {
        for model_name in &provider.models {
            models.push(CCRModel {
                provider: provider.name.clone(),
                model: model_name.clone(),
                full_name: format!("{},{}", provider.name, model_name),
            });
        }
    }
    
    Ok(models)
}

/// 自动发现提供商的可用模型
#[tauri::command]
pub async fn router_discover_provider_models(
    provider_name: String,
    state: State<'_, RouterManagerState>,
) -> Result<Vec<String>, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    // 查找指定的提供商
    let provider = config.router_data.providers.iter()
        .find(|p| p.name == provider_name)
        .ok_or(format!("未找到提供商: {}", provider_name))?;
    
    // 构建 API URL
    let models_url = if provider.api_base_url.contains("/chat/completions") {
        provider.api_base_url.replace("/chat/completions", "/models")
    } else if provider.api_base_url.contains("/v1") {
        format!("{}/models", provider.api_base_url.split("/v1").next().unwrap())
    } else {
        return Err("无法确定模型列表API端点".to_string());
    };
    
    // 发起请求
    let client = reqwest::Client::new();
    let mut request = client.get(&models_url);
    
    // 添加API密钥
    if !provider.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", provider.api_key));
    }
    
    let response = request.send().await
        .map_err(|e| format!("请求模型列表失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("获取模型列表失败: {}", response.status()));
    }
    
    let models_json: Value = response.json().await
        .map_err(|e| format!("解析模型列表失败: {}", e))?;
    
    // 解析模型列表
    let models = if let Some(data_array) = models_json["data"].as_array() {
        data_array.iter()
            .filter_map(|model| model["id"].as_str().map(String::from))
            .collect()
    } else if let Some(models_array) = models_json["models"].as_array() {
        models_array.iter()
            .filter_map(|model| model["name"].as_str().or(model["id"].as_str()).map(String::from))
            .collect()
    } else {
        vec![]
    };
    
    Ok(models)
}

/// 更新提供商的模型列表
#[tauri::command]
pub async fn router_update_provider_models(
    provider_name: String,
    models: Vec<String>,
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let mut config_manager = config_manager_clone.write().await;
    let mut config = config_manager.get_config().clone();
    
    // 更新指定提供商的模型列表
    if let Some(provider) = config.router_data.providers.iter_mut()
        .find(|p| p.name == provider_name) {
        provider.models = models;
    } else {
        return Err(format!("未找到提供商: {}", provider_name));
    }
    
    // 保存配置
    config_manager.update_config(config).await
        .map_err(|e| format!("更新配置失败: {}", e))?;
    
    Ok("模型列表更新成功".to_string())
}

/// 检查CCR服务是否健康
#[tauri::command]
pub async fn router_ccr_health_check() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client
        .get("http://127.0.0.1:3456/health")
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Value>().await {
                    Ok(json) => {
                        let status = json["status"].as_str().unwrap_or("");
                        Ok(status == "ok")
                    }
                    Err(_) => Ok(false)
                }
            } else {
                Ok(false)
            }
        }
        Err(_) => Ok(false)
    }
}

/// [已废弃] 发送模型切换命令到Claude CLI
/// 请使用 router_switch_model 进行统一的模型切换
#[allow(dead_code)]
#[deprecated(note = "请使用 router_switch_model 替代")]
pub async fn router_send_model_command(
    _provider_name: String,
    _model_name: String,
    _session_id: Option<String>,
) -> Result<String, String> {
    // 直接调用统一的模型切换API
    log::warn!("router_send_model_command 已废弃，请使用 router_switch_model");
    Err("此功能已废弃，请使用 router_switch_model 进行模型切换".to_string())
}

/// Router管理器状态
pub struct RouterManagerState {
    pub manager: Mutex<Option<Arc<RwLock<RouterProcessManager>>>>,
    pub config_manager: Mutex<Option<Arc<RwLock<ConfigManager>>>>,
}

impl Default for RouterManagerState {
    fn default() -> Self {
        Self {
            manager: Mutex::new(None),
            config_manager: Mutex::new(None),
        }
    }
}

/// 初始化Router模块
#[tauri::command]
pub async fn router_init(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    init_router_module().await.map_err(|e| e.to_string())?;
    
    // 延迟初始化ConfigManager
    let config_manager_opt = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.is_none()
    };
    
    if config_manager_opt {
        let config_manager = ConfigManager::new().await.map_err(|e| e.to_string())?;
        let mut config_manager_guard = state.config_manager.lock().unwrap();
        *config_manager_guard = Some(Arc::new(RwLock::new(config_manager)));
    }
    
    Ok("Router模块初始化成功".to_string())
}

/// 获取Router配置
#[tauri::command]
pub async fn router_get_config(
    state: State<'_, RouterManagerState>,
) -> Result<RouterConfig, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    Ok(config_manager.get_config().router.clone())
}

/// 更新Router配置
#[tauri::command]
pub async fn router_update_config(
    config: RouterConfig,
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let mut config_manager = config_manager_clone.write().await;
    config_manager.update_router_config(config).await.map_err(|e| e.to_string())?;
    Ok("Router配置更新成功".to_string())
}

/// 获取路由模式
#[tauri::command]
pub async fn router_get_routing_mode(
    state: State<'_, RouterManagerState>,
) -> Result<RoutingMode, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    Ok(config_manager.get_config().integration.routing_mode.clone())
}

/// 设置路由模式
#[tauri::command]
pub async fn router_set_routing_mode(
    mode: RoutingMode,
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let mut config_manager = config_manager_clone.write().await;
    config_manager.update_routing_mode(mode).await.map_err(|e| e.to_string())?;
    Ok("路由模式设置成功".to_string())
}

/// 启动Router进程
#[tauri::command]
pub async fn router_start_process(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let router_config_path = {
        let config_manager_clone = {
            let config_manager_guard = state.config_manager.lock().unwrap();
            let config_manager = config_manager_guard.as_ref()
                .ok_or("Router尚未初始化，请先调用router_init")?;
            config_manager.clone()
        };
        
        let config_manager_read = config_manager_clone.read().await;
        let router_config_path = config_manager_read.get_router_config_path().clone();
        drop(config_manager_read);
        
        router_config_path
    };
    
    // 创建或获取进程管理器
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(existing_manager) => Some(existing_manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            manager.read().await.start(&router_config_path).await.map_err(|e| e.to_string())?;
            Ok("Router进程启动成功".to_string())
        }
        None => Err("Router管理器未初始化，请先调用router_init_manager".to_string()),
    }
}

/// 初始化Router管理器
#[tauri::command]
pub async fn router_init_manager(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let config_clone = {
        let config_manager_clone = {
            let config_manager_guard = state.config_manager.lock().unwrap();
            let config_manager = config_manager_guard.as_ref()
                .ok_or("Router尚未初始化，请先调用router_init")?;
            config_manager.clone()
        };
        
        let config_manager_read = config_manager_clone.read().await;
        let config = config_manager_read.get_config().router.clone();
        drop(config_manager_read);
        
        config
    };
    
    let manager = RouterProcessManager::new(config_clone).await.map_err(|e| e.to_string())?;
    let manager_arc = Arc::new(RwLock::new(manager));
    
    {
        let mut manager_guard = state.manager.lock().unwrap();
        *manager_guard = Some(manager_arc);
    }
    
    Ok("Router管理器初始化成功".to_string())
}

/// 停止Router进程
#[tauri::command]
pub async fn router_stop_process(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        manager_guard.as_ref()
            .ok_or("Router管理器未初始化")?
            .clone()
    };
    
    manager_clone.read().await.stop().await.map_err(|e| e.to_string())?;
    Ok("Router进程停止成功".to_string())
}

/// 重启Router进程
#[tauri::command]
pub async fn router_restart_process(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let (manager_clone, router_config_path) = {
        let config_manager_clone = {
            let config_manager_guard = state.config_manager.lock().unwrap();
            let config_manager = config_manager_guard.as_ref()
                .ok_or("Router尚未初始化")?;
            config_manager.clone()
        };
        
        let config_manager_read = config_manager_clone.read().await;
        let router_config_path = config_manager_read.get_router_config_path().clone();
        drop(config_manager_read);
        
        let manager_clone = {
            let manager_guard = state.manager.lock().unwrap();
            let manager = manager_guard.as_ref()
                .ok_or("Router管理器未初始化")?;
            manager.clone()
        };
        
        (manager_clone, router_config_path)
    };
    
    manager_clone.read().await.restart(&router_config_path).await.map_err(|e| e.to_string())?;
    Ok("Router进程重启成功".to_string())
}

/// 检查Router进程状态
#[tauri::command]
pub async fn router_is_running(
    state: State<'_, RouterManagerState>,
) -> Result<bool, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let result = manager.read().await.is_running().await;
            Ok(result)
        }
        None => Ok(false),
    }
}

/// 获取Router进程PID
#[tauri::command]
pub async fn router_get_process_id(
    state: State<'_, RouterManagerState>,
) -> Result<Option<u32>, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let result = manager.read().await.get_process_id().await;
            Ok(result)
        }
        None => Ok(None),
    }
}

/// 获取可用的AI模型列表
#[tauri::command]
pub async fn router_get_available_models(
    state: State<'_, RouterManagerState>,
) -> Result<Vec<AIModel>, String> {
    // 优先从ConfigManager获取模型列表，避免依赖ProxyClient
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    // 转换为AIModel格式
    let mut models = Vec::new();
    for provider in &config.router_data.providers {
        for model_name in &provider.models {
            models.push(AIModel {
                provider: provider.name.clone(),
                name: model_name.clone(),
                display_name: format!("{} - {}", provider.name, model_name),
                available: provider.enabled,
                context_limit: None,
                cost_per_token: None,
            });
        }
    }
    
    Ok(models)
}

/// 手动切换模型
#[tauri::command]
pub async fn router_switch_model(
    provider: String,
    model: String,
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let manager_read = manager.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                client.switch_model(&provider, &model).await.map_err(|e| e.to_string())?;
                Ok(format!("成功切换到模型: {} -> {}", provider, model))
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
}

// 以下是批量修复的剩余函数
/// 获取当前活跃的模型
#[tauri::command]
pub async fn router_get_active_model(
    state: State<'_, RouterManagerState>,
) -> Result<(String, String), String> {
    // 从配置中获取默认模型
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    // 解析默认路由规则中的模型信息
    let default_model = &config.router_data.routing_rules.default;
    let parts: Vec<&str> = default_model.split(',').collect();
    
    if parts.len() == 2 {
        Ok((parts[0].to_string(), parts[1].to_string()))
    } else {
        // 如果格式不正确，返回默认值
        Ok(("anthropic".to_string(), "claude-3-sonnet-20240229".to_string()))
    }
}

/// 获取Router统计信息
#[tauri::command]
pub async fn router_get_stats(
    state: State<'_, RouterManagerState>,
) -> Result<RouterStats, String> {
    // 如果Manager和ProxyClient已初始化，尝试从Router获取实时统计
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let manager_read = manager.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                // 尝试从Router获取统计信息
                match client.get_router_stats().await {
                    Ok(stats) => Ok(stats),
                    Err(_) => {
                        // 如果失败，返回默认统计信息
                        Ok(RouterStats {
                            total_requests: 0,
                            successful_requests: 0,
                            failed_requests: 0,
                            total_cost: 0.0,
                            average_response_time: 0.0,
                            last_updated: chrono::Utc::now(),
                        })
                    }
                }
            } else {
                // ProxyClient未初始化，返回默认统计信息
                Ok(RouterStats {
                    total_requests: 0,
                    successful_requests: 0,
                    failed_requests: 0,
                    total_cost: 0.0,
                    average_response_time: 0.0,
                    last_updated: chrono::Utc::now(),
                })
            }
        }
        None => {
            // Manager未初始化，返回默认统计信息
            Ok(RouterStats {
                total_requests: 0,
                successful_requests: 0,
                failed_requests: 0,
                total_cost: 0.0,
                average_response_time: 0.0,
                last_updated: chrono::Utc::now(),
            })
        }
    }
}

/// 重置Router统计信息
#[tauri::command]
pub async fn router_reset_stats(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let manager_read = manager.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                client.reset_router_stats().await.map_err(|e| e.to_string())?;
                Ok("Router统计信息已重置".to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
}

/// 测试Router连接
#[tauri::command]
pub async fn router_test_connection(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let manager_read = manager.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                client.test_connection().await.map_err(|e| e.to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
}

/// 路由Claude请求
#[tauri::command]
pub async fn router_route_claude_request(
    request: ClaudeRequest,
    state: State<'_, RouterManagerState>,
) -> Result<ClaudeResponse, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager) => {
            let manager_read = manager.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                client.route_claude_request(request).await.map_err(|e| e.to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
}

/// 验证Router配置
#[tauri::command]
pub async fn router_validate_config(
    state: State<'_, RouterManagerState>,
) -> Result<Vec<String>, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager_read = config_manager_clone.read().await;
    config_manager_read.validate_config().map_err(|e| e.to_string())
}

/// 从Workbench同步配置到Router
#[tauri::command]
pub async fn router_sync_from_workbench(
    state: State<'_, RouterManagerState>,
) -> Result<String, String> {
    // 获取Workbench的提供商配置
    let providers = crate::commands::provider::get_provider_presets()?;
    
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let mut config_manager_write = config_manager_clone.write().await;
    config_manager_write.sync_from_workbench(&providers).await.map_err(|e| e.to_string())?;
    
    Ok(format!("已从Workbench同步{}个提供商配置到Router", providers.len()))
}

/// 获取默认Router配置
#[tauri::command]
pub async fn router_get_default_config() -> Result<RouterConfig, String> {
    Ok(get_default_router_config())
}

/// 健康检查
#[tauri::command]
pub async fn router_health_check(
    state: State<'_, RouterManagerState>,
) -> Result<bool, String> {
    let manager_clone = {
        let manager_guard = state.manager.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => Some(manager.clone()),
            None => None,
        }
    };
    
    match manager_clone {
        Some(manager_clone) => {
            let manager_read = manager_clone.read().await;
            if let Some(client) = manager_read.get_proxy_client() {
                client.health_check().await.map_err(|e| e.to_string())
            } else {
                Ok(false)
            }
        }
        None => Ok(false),
    }
}
