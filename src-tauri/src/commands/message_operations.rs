use anyhow::Result;
use tauri::State;

use crate::checkpoint::manager::CheckpointManager;
use crate::checkpoint::CheckpointResult;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

/// Global state for checkpoint managers (one per session)
pub struct CheckpointManagerRegistry {
    pub managers: Arc<RwLock<HashMap<String, Arc<CheckpointManager>>>>,
}

impl Default for CheckpointManagerRegistry {
    fn default() -> Self {
        Self {
            managers: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Get or create a checkpoint manager for a session
async fn get_checkpoint_manager(
    registry: &State<'_, CheckpointManagerRegistry>,
    session_id: &str,
    project_id: &str,
    project_path: &str,
) -> Result<Arc<CheckpointManager>, String> {
    let managers = registry.managers.read().await;
    
    if let Some(manager) = managers.get(session_id) {
        return Ok(manager.clone());
    }
    
    drop(managers);
    
    // Create new manager
    let claude_dir = crate::commands::claude::get_claude_dir()
        .map_err(|e| format!("Failed to get claude dir: {}", e))?;
    
    let manager = CheckpointManager::new(
        project_id.to_string(),
        session_id.to_string(),
        std::path::PathBuf::from(project_path),
        claude_dir,
    )
    .await
    .map_err(|e| format!("Failed to create checkpoint manager: {}", e))?;
    
    let manager = Arc::new(manager);
    
    let mut managers = registry.managers.write().await;
    managers.insert(session_id.to_string(), manager.clone());
    
    Ok(manager)
}

/// Undo the last N messages
#[tauri::command]
pub async fn message_undo(
    session_id: String,
    project_id: String,
    project_path: String,
    count: Option<usize>,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<CheckpointResult, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    let count = count.unwrap_or(1);
    
    manager
        .undo_messages(count)
        .await
        .map_err(|e| format!("Failed to undo messages: {}", e))
}

/// Truncate messages to a specific index
#[tauri::command]
pub async fn message_truncate_to_index(
    session_id: String,
    project_id: String,
    project_path: String,
    message_index: usize,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<CheckpointResult, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    manager
        .truncate_to_message(message_index)
        .await
        .map_err(|e| format!("Failed to truncate messages: {}", e))
}

/// Edit a specific message
#[tauri::command]
pub async fn message_edit(
    session_id: String,
    project_id: String,
    project_path: String,
    message_index: usize,
    new_content: String,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<CheckpointResult, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    manager
        .edit_message(message_index, new_content)
        .await
        .map_err(|e| format!("Failed to edit message: {}", e))
}

/// Delete a specific message
#[tauri::command]
pub async fn message_delete(
    session_id: String,
    project_id: String,
    project_path: String,
    message_index: usize,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<CheckpointResult, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    manager
        .delete_message(message_index)
        .await
        .map_err(|e| format!("Failed to delete message: {}", e))
}

/// Get the current number of messages in a session
#[tauri::command]
pub async fn message_get_count(
    session_id: String,
    project_id: String,
    project_path: String,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<usize, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    Ok(manager.get_message_count().await)
}

/// Get a specific message by index
#[tauri::command]
pub async fn message_get_by_index(
    session_id: String,
    project_id: String,
    project_path: String,
    message_index: usize,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<String, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    manager
        .get_message(message_index)
        .await
        .map_err(|e| format!("Failed to get message: {}", e))
}

/// Get all messages in a session
#[tauri::command]
pub async fn message_get_all(
    session_id: String,
    project_id: String,
    project_path: String,
    registry: State<'_, CheckpointManagerRegistry>,
) -> Result<Vec<String>, String> {
    let manager = get_checkpoint_manager(&registry, &session_id, &project_id, &project_path).await?;
    
    Ok(manager.get_all_messages().await)
}
