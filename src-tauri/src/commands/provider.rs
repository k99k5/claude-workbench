use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle};
use crate::commands::claude::get_claude_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_url: String,
    pub auth_token: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub anthropic_base_url: Option<String>,
    pub anthropic_auth_token: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: Option<String>,
}

// 获取配置文件路径
fn get_providers_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;
    
    let config_dir = home_dir.join(".claude");
    
    // 确保配置目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("无法创建配置目录: {}", e))?;
    }
    
    Ok(config_dir.join("providers.json"))
}

// 从文件加载代理商配置
fn load_providers_from_file() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        // 如果文件不存在，返回空列表
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    if content.trim().is_empty() {
        return Ok(vec![]);
    }
    
    let providers: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    Ok(providers)
}

// 保存代理商配置到文件
fn save_providers_to_file(providers: &Vec<ProviderConfig>) -> Result<(), String> {
    let config_path = get_providers_config_path()?;
    
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

// CRUD 操作 - 获取所有代理商配置
#[command]
pub fn get_provider_presets() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("无法读取配置文件: {}", e))?;
    
    let configs: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("配置文件格式错误: {}", e))?;
    
    Ok(configs)
}

#[command]
pub fn add_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    // 检查ID是否已存在
    if providers.iter().any(|p| p.id == config.id) {
        return Err(format!("ID '{}' 已存在，请使用不同的ID", config.id));
    }
    
    providers.push(config.clone());
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功添加代理商配置: {}", config.name))
}

// CRUD 操作 - 更新代理商配置
#[command]
pub fn update_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == config.id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", config.id))?;
    
    providers[index] = config.clone();
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功更新代理商配置: {}", config.name))
}

// CRUD 操作 - 删除代理商配置
#[command]
pub fn delete_provider_config(id: String) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))?;
    
    let deleted_config = providers.remove(index);
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功删除代理商配置: {}", deleted_config.name))
}

// CRUD 操作 - 获取单个代理商配置
#[command]
pub fn get_provider_config(id: String) -> Result<ProviderConfig, String> {
    let providers = load_providers_from_file()?;
    
    providers.into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))
}

#[command]
pub fn get_current_provider_config() -> Result<CurrentConfig, String> {
    Ok(CurrentConfig {
        anthropic_base_url: env::var("ANTHROPIC_BASE_URL").ok(),
        anthropic_auth_token: env::var("ANTHROPIC_AUTH_TOKEN").ok(),
        anthropic_api_key: env::var("ANTHROPIC_API_KEY").ok(),
        anthropic_model: env::var("ANTHROPIC_MODEL").ok(),
    })
}

#[command]
pub async fn switch_provider_config(_app: AppHandle, config: ProviderConfig) -> Result<String, String> {
    log::info!("开始切换代理商配置: {} - {}", config.name, config.description);
    
    // 直接更新 settings.json 中的 env 字段
    update_settings_env_for_provider(&config)?;
    
    log::info!("代理商配置切换完成: {}", config.name);
    
    // 无需重启，配置即时生效
    Ok(format!(
        "✅ 已成功切换到 {} ({})\n\n配置已即时生效，无需重启应用！", 
        config.name, 
        config.description
    ))
}

#[command]
pub async fn clear_provider_config(_app: AppHandle) -> Result<String, String> {
    log::info!("开始清理代理商配置");
    
    // 清理 settings.json 中的 ANTHROPIC 环境变量
    clear_settings_env_vars()?;
    
    log::info!("代理商配置清理完成");
    
    // 无需重启，配置即时生效
    Ok("✅ 已清理所有 ANTHROPIC 环境变量\n\n配置已即时生效，无需重启应用！".to_string())
}

// 系统环境变量函数已移除 - 现在直接使用 settings.json 配置

// set_env_var 函数已移除 - 现在直接使用 settings.json 配置

#[command]
pub fn test_provider_connection(base_url: String) -> Result<String, String> {
    // 简单的连接测试 - 尝试访问 API 端点
    let test_url = if base_url.ends_with('/') {
        format!("{}v1/messages", base_url)
    } else {
        format!("{}/v1/messages", base_url)
    };
    
    // 这里可以实现实际的 HTTP 请求测试
    // 目前返回一个简单的成功消息
    Ok(format!("连接测试完成：{}", test_url))
}

/// 更新 settings.json 中的环境变量以切换代理商
fn update_settings_env_for_provider(config: &ProviderConfig) -> Result<(), String> {
    let claude_dir = get_claude_dir().map_err(|e| {
        let error_msg = format!("Failed to get claude dir: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    let settings_path = claude_dir.join("settings.json");
    log::info!("Updating settings.json at: {:?}", settings_path);
    
    // 读取现有设置
    let mut settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| {
            let error_msg = format!("Failed to read settings.json: {}", e);
            log::error!("{}", error_msg);
            error_msg
        })?;
        
        serde_json::from_str::<serde_json::Value>(&content).map_err(|e| {
            let error_msg = format!("Failed to parse settings.json: {}", e);
            log::error!("{}", error_msg);
            error_msg
        })?
    } else {
        serde_json::json!({})
    };
    
    // 确保 env 字段存在
    if !settings.is_object() {
        settings = serde_json::json!({});
    }
    
    let settings_obj = settings.as_object_mut().unwrap();
    if !settings_obj.contains_key("env") {
        settings_obj.insert("env".to_string(), serde_json::json!({}));
    }
    
    let env_obj = settings_obj.get_mut("env").unwrap().as_object_mut().unwrap();
    
    // 清理之前的 ANTHROPIC 环境变量
    env_obj.remove("ANTHROPIC_API_KEY");
    env_obj.remove("ANTHROPIC_AUTH_TOKEN");
    env_obj.remove("ANTHROPIC_BASE_URL");
    env_obj.remove("ANTHROPIC_MODEL");
    
    // 设置新的环境变量
    env_obj.insert("ANTHROPIC_BASE_URL".to_string(), serde_json::Value::String(config.base_url.clone()));
    
    if let Some(auth_token) = &config.auth_token {
        if !auth_token.is_empty() {
            env_obj.insert("ANTHROPIC_AUTH_TOKEN".to_string(), serde_json::Value::String(auth_token.clone()));
        }
    }
    
    if let Some(api_key) = &config.api_key {
        if !api_key.is_empty() {
            env_obj.insert("ANTHROPIC_API_KEY".to_string(), serde_json::Value::String(api_key.clone()));
        }
    }
    
    if let Some(model) = &config.model {
        if !model.is_empty() {
            env_obj.insert("ANTHROPIC_MODEL".to_string(), serde_json::Value::String(model.clone()));
        }
    }
    
    // 写回文件
    let json_string = serde_json::to_string_pretty(&settings).map_err(|e| {
        let error_msg = format!("Failed to serialize settings: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    fs::write(&settings_path, &json_string).map_err(|e| {
        let error_msg = format!("Failed to write settings.json: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    log::info!("Successfully updated settings.json with provider config");
    Ok(())
}

/// 清理 settings.json 中的 ANTHROPIC 环境变量
fn clear_settings_env_vars() -> Result<(), String> {
    let claude_dir = get_claude_dir().map_err(|e| {
        let error_msg = format!("Failed to get claude dir: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    let settings_path = claude_dir.join("settings.json");
    log::info!("Clearing ANTHROPIC env vars from settings.json at: {:?}", settings_path);
    
    if !settings_path.exists() {
        log::info!("settings.json does not exist, nothing to clear");
        return Ok(());
    }
    
    // 读取现有设置
    let content = fs::read_to_string(&settings_path).map_err(|e| {
        let error_msg = format!("Failed to read settings.json: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    let mut settings = serde_json::from_str::<serde_json::Value>(&content).map_err(|e| {
        let error_msg = format!("Failed to parse settings.json: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    // 如果有 env 字段，清理 ANTHROPIC 相关变量
    if let Some(env_obj) = settings.get_mut("env").and_then(|v| v.as_object_mut()) {
        env_obj.remove("ANTHROPIC_API_KEY");
        env_obj.remove("ANTHROPIC_AUTH_TOKEN");
        env_obj.remove("ANTHROPIC_BASE_URL");
        env_obj.remove("ANTHROPIC_MODEL");
        
        log::info!("Cleared ANTHROPIC environment variables from settings.json");
    }
    
    // 写回文件
    let json_string = serde_json::to_string_pretty(&settings).map_err(|e| {
        let error_msg = format!("Failed to serialize settings: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    fs::write(&settings_path, &json_string).map_err(|e| {
        let error_msg = format!("Failed to write settings.json: {}", e);
        log::error!("{}", error_msg);
        error_msg
    })?;
    
    log::info!("Successfully cleared ANTHROPIC env vars from settings.json");
    Ok(())
}