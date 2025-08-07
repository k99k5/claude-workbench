use crate::router::{
    RouterProcessManager, ConfigManager,
    RouterConfig, RoutingMode,
    AIModel, RouterStats, ClaudeRequest, ClaudeResponse,
    init_router_module, get_default_router_config,
};
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tauri::State;

/// Router管理器状态
pub struct RouterManagerState {
    manager: Mutex<Option<Arc<RwLock<RouterProcessManager>>>>,
    config_manager: Mutex<Option<Arc<RwLock<ConfigManager>>>>,
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
                client.get_available_models().await.map_err(|e| e.to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
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
                client.get_active_model().await.map_err(|e| e.to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
    }
}

/// 获取Router统计信息
#[tauri::command]
pub async fn router_get_stats(
    state: State<'_, RouterManagerState>,
) -> Result<RouterStats, String> {
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
                client.get_router_stats().await.map_err(|e| e.to_string())
            } else {
                Err("Router代理客户端未初始化".to_string())
            }
        }
        None => Err("Router管理器未初始化".to_string()),
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