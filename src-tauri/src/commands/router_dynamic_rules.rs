use crate::router::config::DynamicRoutingRule;
use tauri::State;
use super::router::RouterManagerState;

/// 获取所有动态路由规则
#[tauri::command]
pub async fn router_get_dynamic_rules(
    state: State<'_, RouterManagerState>,
) -> Result<Vec<DynamicRoutingRule>, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    Ok(config.router_data.routing_rules.dynamic_rules.clone())
}

/// 添加新的动态路由规则
#[tauri::command]
pub async fn router_add_dynamic_rule(
    rule: DynamicRoutingRule,
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
    
    // 检查规则ID是否已存在
    if config.router_data.routing_rules.dynamic_rules.iter()
        .any(|r| r.id == rule.id) {
        return Err(format!("规则ID {} 已存在", rule.id));
    }
    
    config.router_data.routing_rules.dynamic_rules.push(rule);
    
    // 按优先级排序
    config.router_data.routing_rules.dynamic_rules
        .sort_by(|a, b| b.priority.cmp(&a.priority));
    
    config_manager.update_config(config).await
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok("动态路由规则添加成功".to_string())
}

/// 更新动态路由规则
#[tauri::command]
pub async fn router_update_dynamic_rule(
    rule: DynamicRoutingRule,
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
    
    // 查找并更新规则
    let rule_id = rule.id.clone();
    let mut found = false;
    for existing_rule in &mut config.router_data.routing_rules.dynamic_rules {
        if existing_rule.id == rule.id {
            *existing_rule = rule;
            found = true;
            break;
        }
    }
    
    if !found {
        return Err(format!("未找到规则ID: {}", rule_id));
    }
    
    // 重新排序
    config.router_data.routing_rules.dynamic_rules
        .sort_by(|a, b| b.priority.cmp(&a.priority));
    
    config_manager.update_config(config).await
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok("动态路由规则更新成功".to_string())
}

/// 删除动态路由规则
#[tauri::command]
pub async fn router_delete_dynamic_rule(
    rule_id: String,
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
    
    // 删除规则
    let original_len = config.router_data.routing_rules.dynamic_rules.len();
    config.router_data.routing_rules.dynamic_rules
        .retain(|r| r.id != rule_id);
    
    if config.router_data.routing_rules.dynamic_rules.len() == original_len {
        return Err(format!("未找到规则ID: {}", rule_id));
    }
    
    config_manager.update_config(config).await
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok("动态路由规则删除成功".to_string())
}

/// 根据文本匹配动态路由规则
#[tauri::command]
pub async fn router_match_dynamic_rule(
    text: String,
    state: State<'_, RouterManagerState>,
) -> Result<Option<DynamicRoutingRule>, String> {
    let config_manager_clone = {
        let config_manager_guard = state.config_manager.lock().unwrap();
        config_manager_guard.as_ref()
            .ok_or("Router尚未初始化，请先调用router_init")?
            .clone()
    };
    
    let config_manager = config_manager_clone.read().await;
    let config = config_manager.get_config();
    
    // 查找匹配的规则（已按优先级排序）
    for rule in &config.router_data.routing_rules.dynamic_rules {
        if !rule.enabled {
            continue;
        }
        
        // 检查关键词匹配
        for keyword in &rule.keywords {
            if text.to_lowercase().contains(&keyword.to_lowercase()) {
                return Ok(Some(rule.clone()));
            }
        }
    }
    
    Ok(None)
}