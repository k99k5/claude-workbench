// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod checkpoint;
mod claude_binary;
mod commands;
mod process;
mod router;

use checkpoint::state::CheckpointState;
use commands::agents::{
    cleanup_finished_processes, create_agent, delete_agent, execute_agent, export_agent,
    export_agent_to_file, fetch_github_agent_content, fetch_github_agents, get_agent,
    get_agent_run, get_agent_run_with_real_time_metrics, get_claude_binary_path,
    get_live_session_output, get_session_output, get_session_status, import_agent,
    import_agent_from_file, import_agent_from_github, init_database, kill_agent_session,
    list_agent_runs, list_agent_runs_with_metrics, list_agents, list_claude_installations,
    list_running_sessions, load_agent_session_history, set_claude_binary_path, stream_session_output, update_agent, AgentDb,
};
use commands::claude::{
    cancel_claude_execution, check_auto_checkpoint, check_claude_version, cleanup_old_checkpoints,
    clear_checkpoint_manager, continue_claude_code, create_checkpoint, delete_project, execute_claude_code,
    find_claude_md_files, fork_from_checkpoint, get_checkpoint_diff, get_checkpoint_settings,
    get_checkpoint_state_stats, get_claude_session_output, get_claude_settings, get_project_sessions,
    get_recently_modified_files, get_session_timeline, get_system_prompt, list_checkpoints,
    list_directory_contents, list_projects, list_running_claude_sessions, load_session_history,
    open_new_session, read_claude_md_file, restore_checkpoint, resume_claude_code,
    save_claude_md_file, save_claude_settings, save_system_prompt, search_files,
    track_checkpoint_message, track_session_messages, update_checkpoint_settings,
    get_hooks_config, update_hooks_config, validate_hook_command,
    set_custom_claude_path, get_claude_path, clear_custom_claude_path,
    restore_project, list_hidden_projects, delete_project_permanently, enhance_prompt,
    save_window_state, load_window_state, apply_window_state,
    ClaudeProcessState,
};
use commands::mcp::{
    mcp_add, mcp_add_from_claude_desktop, mcp_add_json, mcp_get, mcp_get_server_status, mcp_list,
    mcp_read_project_config, mcp_remove, mcp_reset_project_choices, mcp_save_project_config,
    mcp_serve, mcp_test_connection,
};

use commands::usage::{
    get_session_stats, get_usage_by_date_range, get_usage_details, get_usage_stats,
    get_today_usage_stats, get_usage_by_api_base_url, get_active_sessions, get_burn_rate_analysis,
};
use commands::storage::{
    storage_list_tables, storage_read_table, storage_update_row, storage_delete_row,
    storage_insert_row, storage_execute_sql, storage_reset_database,
};
use commands::clipboard::{
    save_clipboard_image,
};
use commands::provider::{
    get_provider_presets, get_current_provider_config, switch_provider_config,
    clear_provider_config, test_provider_connection, add_provider_config,
    update_provider_config, delete_provider_config, get_provider_config,
};
use commands::router::{
    router_init, router_get_config, router_update_config, router_get_routing_mode,
    router_set_routing_mode, router_start_process, router_init_manager, router_stop_process,
    router_restart_process, router_is_running, router_get_process_id, router_get_available_models,
    router_switch_model, router_get_active_model, router_get_stats, router_reset_stats,
    router_test_connection, router_route_claude_request, router_validate_config,
    router_sync_from_workbench, router_get_default_config, router_health_check,
    RouterManagerState,
};
use process::ProcessRegistryState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    // Initialize logger
    env_logger::init();


    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize agents database
            let conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            app.manage(AgentDb(Mutex::new(conn)));

            // Initialize checkpoint state
            let checkpoint_state = CheckpointState::new();

            // Set the Claude directory path
            if let Ok(claude_dir) = dirs::home_dir()
                .ok_or_else(|| "Could not find home directory")
                .and_then(|home| {
                    let claude_path = home.join(".claude");
                    claude_path
                        .canonicalize()
                        .map_err(|_| "Could not find ~/.claude directory")
                })
            {
                let state_clone = checkpoint_state.clone();
                tauri::async_runtime::spawn(async move {
                    state_clone.set_claude_dir(claude_dir).await;
                });
            }

            app.manage(checkpoint_state);

            // Initialize process registry
            app.manage(ProcessRegistryState::default());

            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());

            // Initialize Router manager state
            app.manage(RouterManagerState::default());


            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Claude & Project Management
            list_projects,
            get_project_sessions,
            delete_project,
            restore_project,
            list_hidden_projects,
            delete_project_permanently,
            get_claude_settings,
            open_new_session,
            get_system_prompt,
            check_claude_version,
            save_system_prompt,
            save_claude_settings,
            find_claude_md_files,
            read_claude_md_file,
            save_claude_md_file,
            load_session_history,
            execute_claude_code,
            continue_claude_code,
            resume_claude_code,
            cancel_claude_execution,
            list_running_claude_sessions,
            get_claude_session_output,
            list_directory_contents,
            search_files,
            get_recently_modified_files,
            get_hooks_config,
            update_hooks_config,
            validate_hook_command,
            set_custom_claude_path,
            get_claude_path,
            clear_custom_claude_path,
            enhance_prompt,
            
            // Window Management
            save_window_state,
            load_window_state,
            apply_window_state,
            
            // Checkpoint Management
            create_checkpoint,
            restore_checkpoint,
            list_checkpoints,
            fork_from_checkpoint,
            get_session_timeline,
            update_checkpoint_settings,
            get_checkpoint_diff,
            track_checkpoint_message,
            track_session_messages,
            check_auto_checkpoint,
            cleanup_old_checkpoints,
            get_checkpoint_settings,
            clear_checkpoint_manager,
            get_checkpoint_state_stats,
            
            // Agent Management
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            get_agent,
            execute_agent,
            list_agent_runs,
            get_agent_run,
            list_agent_runs_with_metrics,
            get_agent_run_with_real_time_metrics,
            list_running_sessions,
            kill_agent_session,
            get_session_status,
            cleanup_finished_processes,
            get_session_output,
            get_live_session_output,
            stream_session_output,
            load_agent_session_history,
            get_claude_binary_path,
            set_claude_binary_path,
            list_claude_installations,
            export_agent,
            export_agent_to_file,
            import_agent,
            import_agent_from_file,
            fetch_github_agents,
            fetch_github_agent_content,
            import_agent_from_github,
            
            // Usage & Analytics
            get_usage_stats,
            get_today_usage_stats,
            get_usage_by_api_base_url,
            get_usage_by_date_range,
            get_usage_details,
            get_session_stats,
            get_active_sessions,
            get_burn_rate_analysis,
            
            // MCP (Model Context Protocol)
            mcp_add,
            mcp_list,
            mcp_get,
            mcp_remove,
            mcp_add_json,
            mcp_add_from_claude_desktop,
            mcp_serve,
            mcp_test_connection,
            mcp_reset_project_choices,
            mcp_get_server_status,
            mcp_read_project_config,
            mcp_save_project_config,

            
            // Storage Management
            storage_list_tables,
            storage_read_table,
            storage_update_row,
            storage_delete_row,
            storage_insert_row,
            storage_execute_sql,
            storage_reset_database,
            
            // Slash Commands
            commands::slash_commands::slash_commands_list,
            commands::slash_commands::slash_command_get,
            commands::slash_commands::slash_command_save,
            commands::slash_commands::slash_command_delete,
            // Clipboard
            save_clipboard_image,
            
            // Provider Management  
            get_provider_presets,
            get_current_provider_config,
            switch_provider_config,
            clear_provider_config,
            test_provider_connection,
            add_provider_config,
            update_provider_config,
            delete_provider_config,
            get_provider_config,
            
            // Router Management
            router_init,
            router_get_config,
            router_update_config,
            router_get_routing_mode,
            router_set_routing_mode,
            router_get_default_config,
            router_start_process,
            router_init_manager,
            router_stop_process,
            router_restart_process,
            router_is_running,
            router_get_process_id,
            router_get_available_models,
            router_switch_model,
            router_get_active_model,
            router_get_stats,
            router_reset_stats,
            router_test_connection,
            router_route_claude_request,
            router_validate_config,
            router_sync_from_workbench,
            router_health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
