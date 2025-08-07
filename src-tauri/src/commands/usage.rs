use chrono::{DateTime, Local, NaiveDate, Duration};
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::env;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeSettings {
    env: Option<HashMap<String, serde_json::Value>>,
}

fn get_api_base_url() -> String {
    // First check environment variable
    if let Ok(api_base_url) = env::var("ANTHROPIC_BASE_URL") {
        return api_base_url;
    }
    
    // Then check Claude settings.json
    if let Some(home_dir) = dirs::home_dir() {
        let settings_path = home_dir.join(".claude").join("settings.json");
        if let Ok(settings_content) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<ClaudeSettings>(&settings_content) {
                if let Some(env_vars) = settings.env {
                    if let Some(api_base_url) = env_vars.get("ANTHROPIC_BASE_URL") {
                        if let Some(url_str) = api_base_url.as_str() {
                            return url_str.to_string();
                        }
                    }
                }
            }
        }
    }
    
    // Default fallback
    "https://api.anthropic.com".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageEntry {
    timestamp: String,
    model: String,
    input_tokens: u64,
    output_tokens: u64,
    cache_creation_tokens: u64,
    cache_read_tokens: u64,
    cost: f64,
    session_id: String,
    project_path: String,
    api_base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageStats {
    total_cost: f64,
    total_tokens: u64,
    total_input_tokens: u64,
    total_output_tokens: u64,
    total_cache_creation_tokens: u64,
    total_cache_read_tokens: u64,
    total_sessions: u64,
    by_model: Vec<ModelUsage>,
    by_date: Vec<DailyUsage>,
    by_project: Vec<ProjectUsage>,
    by_api_base_url: Vec<ApiBaseUrlUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelUsage {
    model: String,
    total_cost: f64,
    total_tokens: u64,
    input_tokens: u64,
    output_tokens: u64,
    cache_creation_tokens: u64,
    cache_read_tokens: u64,
    session_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyUsage {
    date: String,
    total_cost: f64,
    total_tokens: u64,
    models_used: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectUsage {
    project_path: String,
    project_name: String,
    total_cost: f64,
    total_tokens: u64,
    session_count: u64,
    last_used: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiBaseUrlUsage {
    api_base_url: String,
    total_cost: f64,
    total_tokens: u64,
    input_tokens: u64,
    output_tokens: u64,
    cache_creation_tokens: u64,
    cache_read_tokens: u64,
    session_count: u64,
}

// Claude 4 pricing constants (per million tokens) - Updated January 2025
const OPUS_4_INPUT_PRICE: f64 = 15.0;
const OPUS_4_OUTPUT_PRICE: f64 = 75.0;
const OPUS_4_CACHE_WRITE_PRICE: f64 = 18.75;
const OPUS_4_CACHE_READ_PRICE: f64 = 1.50;

const SONNET_4_INPUT_PRICE: f64 = 3.0;
const SONNET_4_OUTPUT_PRICE: f64 = 15.0;
const SONNET_4_CACHE_WRITE_PRICE: f64 = 3.75;
const SONNET_4_CACHE_READ_PRICE: f64 = 0.30;

// Claude 3.7 pricing constants (per million tokens)
const SONNET_37_INPUT_PRICE: f64 = 3.0;
const SONNET_37_OUTPUT_PRICE: f64 = 15.0;
const SONNET_37_CACHE_WRITE_PRICE: f64 = 3.75;
const SONNET_37_CACHE_READ_PRICE: f64 = 0.30;

// Claude 3.5 pricing constants (per million tokens)
const SONNET_35_INPUT_PRICE: f64 = 3.0;
const SONNET_35_OUTPUT_PRICE: f64 = 15.0;
const SONNET_35_CACHE_WRITE_PRICE: f64 = 3.75;
const SONNET_35_CACHE_READ_PRICE: f64 = 0.30;

const HAIKU_35_INPUT_PRICE: f64 = 0.80;
const HAIKU_35_OUTPUT_PRICE: f64 = 4.0;
const HAIKU_35_CACHE_WRITE_PRICE: f64 = 1.0;
const HAIKU_35_CACHE_READ_PRICE: f64 = 0.08;

// Claude Code session window duration (5 hours)
const SESSION_WINDOW_HOURS: i64 = 5;

// Helper function to check if a session is still active based on Claude Code's 5-hour window
#[allow(dead_code)]
fn is_session_active(session_start: &str, current_time: &DateTime<Local>) -> bool {
    if let Ok(start_time) = DateTime::parse_from_rfc3339(session_start) {
        let elapsed = current_time.signed_duration_since(start_time);
        elapsed.num_hours() < SESSION_WINDOW_HOURS
    } else {
        false
    }
}

// Enhanced session tracking with time window awareness
fn track_active_sessions(entries: &[UsageEntry]) -> HashMap<String, DateTime<Local>> {
    let mut session_starts: HashMap<String, DateTime<Local>> = HashMap::new();
    
    for entry in entries {
        if let Ok(entry_time) = DateTime::parse_from_rfc3339(&entry.timestamp) {
            let local_time = entry_time.with_timezone(&Local);
            
            // Track the earliest timestamp for each session
            session_starts
                .entry(entry.session_id.clone())
                .and_modify(|start| {
                    if local_time < *start {
                        *start = local_time;
                    }
                })
                .or_insert(local_time);
        }
    }
    
    session_starts
}

#[derive(Debug, Deserialize)]
struct JsonlEntry {
    timestamp: String,
    message: Option<MessageData>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    #[serde(rename = "costUSD")]
    cost_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct MessageData {
    id: Option<String>,
    model: Option<String>,
    usage: Option<UsageData>,
}

#[derive(Debug, Deserialize)]
struct UsageData {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
}

fn calculate_cost(model: &str, usage: &UsageData) -> f64 {
    let input_tokens = usage.input_tokens.unwrap_or(0) as f64;
    let output_tokens = usage.output_tokens.unwrap_or(0) as f64;
    let cache_creation_tokens = usage.cache_creation_input_tokens.unwrap_or(0) as f64;
    let cache_read_tokens = usage.cache_read_input_tokens.unwrap_or(0) as f64;

    // Calculate cost based on model - improved pattern matching
    let (input_price, output_price, cache_write_price, cache_read_price) =
        if model.contains("opus-4") || model.contains("claude-opus-4") {
            (
                OPUS_4_INPUT_PRICE,
                OPUS_4_OUTPUT_PRICE,
                OPUS_4_CACHE_WRITE_PRICE,
                OPUS_4_CACHE_READ_PRICE,
            )
        } else if model.contains("sonnet-4") || model.contains("claude-sonnet-4") {
            (
                SONNET_4_INPUT_PRICE,
                SONNET_4_OUTPUT_PRICE,
                SONNET_4_CACHE_WRITE_PRICE,
                SONNET_4_CACHE_READ_PRICE,
            )
        } else if model.contains("sonnet-3.7") || model.contains("claude-sonnet-3.7") {
            (
                SONNET_37_INPUT_PRICE,
                SONNET_37_OUTPUT_PRICE,
                SONNET_37_CACHE_WRITE_PRICE,
                SONNET_37_CACHE_READ_PRICE,
            )
        } else if model.contains("sonnet-3.5") || model.contains("claude-sonnet-3.5") {
            (
                SONNET_35_INPUT_PRICE,
                SONNET_35_OUTPUT_PRICE,
                SONNET_35_CACHE_WRITE_PRICE,
                SONNET_35_CACHE_READ_PRICE,
            )
        } else if model.contains("haiku-3.5") || model.contains("claude-haiku-3.5") {
            (
                HAIKU_35_INPUT_PRICE,
                HAIKU_35_OUTPUT_PRICE,
                HAIKU_35_CACHE_WRITE_PRICE,
                HAIKU_35_CACHE_READ_PRICE,
            )
        } else {
            // Return 0 for unknown models to avoid incorrect cost estimations (旧版本逻辑)
            (0.0, 0.0, 0.0, 0.0)
        };

    // Calculate cost (prices are per million tokens)
    let cost = (input_tokens * input_price / 1_000_000.0)
        + (output_tokens * output_price / 1_000_000.0)
        + (cache_creation_tokens * cache_write_price / 1_000_000.0)
        + (cache_read_tokens * cache_read_price / 1_000_000.0);

    cost
}

fn parse_jsonl_file(
    path: &PathBuf,
    encoded_project_name: &str,
    processed_hashes: &mut HashSet<String>,
) -> Vec<UsageEntry> {
    let mut entries = Vec::new();
    let mut actual_project_path: Option<String> = None;

    if let Ok(content) = fs::read_to_string(path) {
        // Extract session ID from the file path
        let session_id = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                // Extract the actual project path from cwd if we haven't already
                if actual_project_path.is_none() {
                    if let Some(cwd) = json_value.get("cwd").and_then(|v| v.as_str()) {
                        actual_project_path = Some(cwd.to_string());
                    }
                }

                // Get API Base URL from configuration
                let api_base_url = get_api_base_url();

                // Try to parse as JsonlEntry for usage data
                if let Ok(entry) = serde_json::from_value::<JsonlEntry>(json_value.clone()) {
                    if let Some(message) = &entry.message {
                        if let Some(usage) = &message.usage {
                            // 智能去重策略：结合两个版本的优点（最真实的统计方式）
                            let has_io_tokens = usage.input_tokens.unwrap_or(0) > 0 || usage.output_tokens.unwrap_or(0) > 0;
                            let has_cache_tokens = usage.cache_creation_input_tokens.unwrap_or(0) > 0 || usage.cache_read_input_tokens.unwrap_or(0) > 0;
                            
                            if has_io_tokens {
                                // 对输入输出token使用严格去重（确保准确性）
                                if let Some(msg_id) = &message.id {
                                    let unique_hash = format!("io:{}:{}", session_id, msg_id);
                                    if processed_hashes.contains(&unique_hash) {
                                        continue; // Skip duplicate IO entry
                                    }
                                    processed_hashes.insert(unique_hash);
                                }
                            } else if has_cache_tokens {
                                // 对缓存token使用旧版本宽松去重（保持准确性）
                                if let (Some(msg_id), Some(req_id)) = (&message.id, &entry.request_id) {
                                    let unique_hash = format!("cache:{}:{}", msg_id, req_id);
                                    if processed_hashes.contains(&unique_hash) {
                                        continue; // Skip duplicate cache entry
                                    }
                                    processed_hashes.insert(unique_hash);
                                }
                            }
                            // Skip entries without meaningful token usage
                            if usage.input_tokens.unwrap_or(0) == 0
                                && usage.output_tokens.unwrap_or(0) == 0
                                && usage.cache_creation_input_tokens.unwrap_or(0) == 0
                                && usage.cache_read_input_tokens.unwrap_or(0) == 0
                            {
                                continue;
                            }

                            let cost = entry.cost_usd.unwrap_or_else(|| {
                                if let Some(model_str) = &message.model {
                                    calculate_cost(model_str, usage)
                                } else {
                                    0.0
                                }
                            });

                            // Use actual project path if found, otherwise use encoded name
                            let project_path = actual_project_path
                                .clone()
                                .unwrap_or_else(|| encoded_project_name.to_string());

                            entries.push(UsageEntry {
                                timestamp: entry.timestamp,
                                model: message
                                    .model
                                    .clone()
                                    .unwrap_or_else(|| "unknown".to_string()),
                                input_tokens: usage.input_tokens.unwrap_or(0),
                                output_tokens: usage.output_tokens.unwrap_or(0),
                                cache_creation_tokens: usage
                                    .cache_creation_input_tokens
                                    .unwrap_or(0),
                                cache_read_tokens: usage.cache_read_input_tokens.unwrap_or(0),
                                cost,
                                session_id: entry.session_id.unwrap_or_else(|| session_id.clone()),
                                project_path,
                                api_base_url,
                            });
                        }
                    }
                }
            }
        }
    }

    entries
}

fn get_earliest_timestamp(path: &PathBuf) -> Option<String> {
    if let Ok(content) = fs::read_to_string(path) {
        let mut earliest_timestamp: Option<String> = None;
        for line in content.lines() {
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(timestamp_str) = json_value.get("timestamp").and_then(|v| v.as_str()) {
                    if let Some(current_earliest) = &earliest_timestamp {
                        if timestamp_str < current_earliest.as_str() {
                            earliest_timestamp = Some(timestamp_str.to_string());
                        }
                    } else {
                        earliest_timestamp = Some(timestamp_str.to_string());
                    }
                }
            }
        }
        return earliest_timestamp;
    }
    None
}

fn get_all_usage_entries(claude_path: &PathBuf) -> Vec<UsageEntry> {
    let mut all_entries = Vec::new();
    let mut processed_hashes = HashSet::new();
    let projects_dir = claude_path.join("projects");

    let mut files_to_process: Vec<(PathBuf, String)> = Vec::new();

    if let Ok(projects) = fs::read_dir(&projects_dir) {
        for project in projects.flatten() {
            if project.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let project_name = project.file_name().to_string_lossy().to_string();
                let project_path = project.path();

                walkdir::WalkDir::new(&project_path)
                    .into_iter()
                    .filter_map(Result::ok)
                    .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
                    .for_each(|entry| {
                        files_to_process.push((entry.path().to_path_buf(), project_name.clone()));
                    });
            }
        }
    }

    // Sort files by their earliest timestamp to ensure chronological processing
    // and deterministic deduplication.
    files_to_process.sort_by_cached_key(|(path, _)| get_earliest_timestamp(path));

    for (path, project_name) in files_to_process {
        let entries = parse_jsonl_file(&path, &project_name, &mut processed_hashes);
        all_entries.extend(entries);
    }

    // Sort by timestamp
    all_entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    all_entries
}

#[command]
pub fn get_usage_stats(days: Option<u32>) -> Result<UsageStats, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);

    if all_entries.is_empty() {
        return Ok(UsageStats {
            total_cost: 0.0,
            total_tokens: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_creation_tokens: 0,
            total_cache_read_tokens: 0,
            total_sessions: 0,
            by_model: vec![],
            by_date: vec![],
            by_project: vec![],
            by_api_base_url: vec![],
        });
    }

    // Filter by days if specified
    let filtered_entries = if let Some(days) = days {
        let cutoff = Local::now().naive_local().date() - chrono::Duration::days(days as i64);
        all_entries
            .into_iter()
            .filter(|e| {
                if let Ok(dt) = DateTime::parse_from_rfc3339(&e.timestamp) {
                    dt.naive_local().date() >= cutoff
                } else {
                    false
                }
            })
            .collect()
    } else {
        all_entries
    };

    // Calculate aggregated stats
    let mut total_cost = 0.0;
    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;

    let mut model_stats: HashMap<String, ModelUsage> = HashMap::new();
    let mut daily_stats: HashMap<String, DailyUsage> = HashMap::new();
    let mut project_stats: HashMap<String, ProjectUsage> = HashMap::new();
    let mut api_base_url_stats: HashMap<String, ApiBaseUrlUsage> = HashMap::new();
    
    // Track unique sessions for accurate counting
    let mut unique_sessions: HashSet<String> = HashSet::new();
    let mut model_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut project_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut api_sessions: HashMap<String, HashSet<String>> = HashMap::new();

    for entry in &filtered_entries {
        // Update totals
        total_cost += entry.cost;
        total_input_tokens += entry.input_tokens;
        total_output_tokens += entry.output_tokens;
        total_cache_creation_tokens += entry.cache_creation_tokens;
        total_cache_read_tokens += entry.cache_read_tokens;

        // Track unique sessions
        unique_sessions.insert(entry.session_id.clone());
        
        // Track sessions per model
        model_sessions
            .entry(entry.model.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per project
        project_sessions
            .entry(entry.project_path.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per API base URL
        api_sessions
            .entry(entry.api_base_url.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());

        // Update model stats
        let model_stat = model_stats
            .entry(entry.model.clone())
            .or_insert(ModelUsage {
                model: entry.model.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        model_stat.total_cost += entry.cost;
        model_stat.input_tokens += entry.input_tokens;
        model_stat.output_tokens += entry.output_tokens;
        model_stat.cache_creation_tokens += entry.cache_creation_tokens;
        model_stat.cache_read_tokens += entry.cache_read_tokens;
        model_stat.total_tokens = model_stat.input_tokens + model_stat.output_tokens + model_stat.cache_creation_tokens + model_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking

        // Update daily stats
        let date = entry
            .timestamp
            .split('T')
            .next()
            .unwrap_or(&entry.timestamp)
            .to_string();
        let daily_stat = daily_stats.entry(date.clone()).or_insert(DailyUsage {
            date,
            total_cost: 0.0,
            total_tokens: 0,
            models_used: vec![],
        });
        daily_stat.total_cost += entry.cost;
        daily_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        if !daily_stat.models_used.contains(&entry.model) {
            daily_stat.models_used.push(entry.model.clone());
        }

        // Update project stats
        let project_stat =
            project_stats
                .entry(entry.project_path.clone())
                .or_insert(ProjectUsage {
                    project_path: entry.project_path.clone(),
                    project_name: entry
                        .project_path
                        .split('/')
                        .last()
                        .unwrap_or(&entry.project_path)
                        .to_string(),
                    total_cost: 0.0,
                    total_tokens: 0,
                    session_count: 0,
                    last_used: entry.timestamp.clone(),
                });
        project_stat.total_cost += entry.cost;
        project_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        // Session count will be set later from unique session tracking
        if entry.timestamp > project_stat.last_used {
            project_stat.last_used = entry.timestamp.clone();
        }

        // Update API base URL stats
        let api_base_url_stat = api_base_url_stats
            .entry(entry.api_base_url.clone())
            .or_insert(ApiBaseUrlUsage {
                api_base_url: entry.api_base_url.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        api_base_url_stat.total_cost += entry.cost;
        api_base_url_stat.input_tokens += entry.input_tokens;
        api_base_url_stat.output_tokens += entry.output_tokens;
        api_base_url_stat.cache_creation_tokens += entry.cache_creation_tokens;
        api_base_url_stat.cache_read_tokens += entry.cache_read_tokens;
        api_base_url_stat.total_tokens = api_base_url_stat.input_tokens + api_base_url_stat.output_tokens + api_base_url_stat.cache_creation_tokens + api_base_url_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;
    let total_sessions = unique_sessions.len() as u64;

    // Set correct session counts and convert hashmaps to sorted vectors
    let mut by_model: Vec<ModelUsage> = model_stats.into_iter().map(|(model, mut stat)| {
        stat.session_count = model_sessions.get(&model).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_model.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_date: Vec<DailyUsage> = daily_stats.into_values().collect();
    by_date.sort_by(|a, b| b.date.cmp(&a.date));

    let mut by_project: Vec<ProjectUsage> = project_stats.into_iter().map(|(project_path, mut stat)| {
        stat.session_count = project_sessions.get(&project_path).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_project.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_api_base_url: Vec<ApiBaseUrlUsage> = api_base_url_stats.into_iter().map(|(api_url, mut stat)| {
        stat.session_count = api_sessions.get(&api_url).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_api_base_url.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    Ok(UsageStats {
        total_cost,
        total_tokens,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_sessions,
        by_model,
        by_date,
        by_project,
        by_api_base_url,
    })
}

#[command]
pub fn get_usage_by_date_range(start_date: String, end_date: String) -> Result<UsageStats, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);

    // Parse dates
    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d").or_else(|_| {
        // Try parsing ISO datetime format
        DateTime::parse_from_rfc3339(&start_date)
            .map(|dt| dt.naive_local().date())
            .map_err(|e| format!("Invalid start date: {}", e))
    })?;
    let end = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d").or_else(|_| {
        // Try parsing ISO datetime format
        DateTime::parse_from_rfc3339(&end_date)
            .map(|dt| dt.naive_local().date())
            .map_err(|e| format!("Invalid end date: {}", e))
    })?;

    // Filter entries by date range
    let filtered_entries: Vec<_> = all_entries
        .into_iter()
        .filter(|e| {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&e.timestamp) {
                let date = dt.naive_local().date();
                date >= start && date <= end
            } else {
                false
            }
        })
        .collect();

    if filtered_entries.is_empty() {
        return Ok(UsageStats {
            total_cost: 0.0,
            total_tokens: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_creation_tokens: 0,
            total_cache_read_tokens: 0,
            total_sessions: 0,
            by_model: vec![],
            by_date: vec![],
            by_project: vec![],
            by_api_base_url: vec![],
        });
    }

    // Calculate aggregated stats (same logic as get_usage_stats)
    let mut total_cost = 0.0;
    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;

    let mut model_stats: HashMap<String, ModelUsage> = HashMap::new();
    let mut daily_stats: HashMap<String, DailyUsage> = HashMap::new();
    let mut project_stats: HashMap<String, ProjectUsage> = HashMap::new();
    let mut api_base_url_stats: HashMap<String, ApiBaseUrlUsage> = HashMap::new();
    
    // Track unique sessions for accurate counting  
    let mut unique_sessions: HashSet<String> = HashSet::new();
    let mut model_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut project_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut api_sessions: HashMap<String, HashSet<String>> = HashMap::new();

    for entry in &filtered_entries {
        // Update totals
        total_cost += entry.cost;
        total_input_tokens += entry.input_tokens;
        total_output_tokens += entry.output_tokens;
        total_cache_creation_tokens += entry.cache_creation_tokens;
        total_cache_read_tokens += entry.cache_read_tokens;

        // Track unique sessions
        unique_sessions.insert(entry.session_id.clone());
        
        // Track sessions per model
        model_sessions
            .entry(entry.model.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per project
        project_sessions
            .entry(entry.project_path.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per API base URL
        api_sessions
            .entry(entry.api_base_url.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());

        // Update model stats
        let model_stat = model_stats
            .entry(entry.model.clone())
            .or_insert(ModelUsage {
                model: entry.model.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        model_stat.total_cost += entry.cost;
        model_stat.input_tokens += entry.input_tokens;
        model_stat.output_tokens += entry.output_tokens;
        model_stat.cache_creation_tokens += entry.cache_creation_tokens;
        model_stat.cache_read_tokens += entry.cache_read_tokens;
        model_stat.total_tokens = model_stat.input_tokens + model_stat.output_tokens + model_stat.cache_creation_tokens + model_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking

        // Update daily stats
        let date = entry
            .timestamp
            .split('T')
            .next()
            .unwrap_or(&entry.timestamp)
            .to_string();
        let daily_stat = daily_stats.entry(date.clone()).or_insert(DailyUsage {
            date,
            total_cost: 0.0,
            total_tokens: 0,
            models_used: vec![],
        });
        daily_stat.total_cost += entry.cost;
        daily_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        if !daily_stat.models_used.contains(&entry.model) {
            daily_stat.models_used.push(entry.model.clone());
        }

        // Update project stats
        let project_stat =
            project_stats
                .entry(entry.project_path.clone())
                .or_insert(ProjectUsage {
                    project_path: entry.project_path.clone(),
                    project_name: entry
                        .project_path
                        .split('/')
                        .last()
                        .unwrap_or(&entry.project_path)
                        .to_string(),
                    total_cost: 0.0,
                    total_tokens: 0,
                    session_count: 0,
                    last_used: entry.timestamp.clone(),
                });
        project_stat.total_cost += entry.cost;
        project_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        // Session count will be set later from unique session tracking
        if entry.timestamp > project_stat.last_used {
            project_stat.last_used = entry.timestamp.clone();
        }

        // Update API base URL stats
        let api_base_url_stat = api_base_url_stats
            .entry(entry.api_base_url.clone())
            .or_insert(ApiBaseUrlUsage {
                api_base_url: entry.api_base_url.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        api_base_url_stat.total_cost += entry.cost;
        api_base_url_stat.input_tokens += entry.input_tokens;
        api_base_url_stat.output_tokens += entry.output_tokens;
        api_base_url_stat.cache_creation_tokens += entry.cache_creation_tokens;
        api_base_url_stat.cache_read_tokens += entry.cache_read_tokens;
        api_base_url_stat.total_tokens = api_base_url_stat.input_tokens + api_base_url_stat.output_tokens + api_base_url_stat.cache_creation_tokens + api_base_url_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;
    let total_sessions = unique_sessions.len() as u64;

    // Set correct session counts and convert hashmaps to sorted vectors
    let mut by_model: Vec<ModelUsage> = model_stats.into_iter().map(|(model, mut stat)| {
        stat.session_count = model_sessions.get(&model).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_model.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_date: Vec<DailyUsage> = daily_stats.into_values().collect();
    by_date.sort_by(|a, b| b.date.cmp(&a.date));

    let mut by_project: Vec<ProjectUsage> = project_stats.into_iter().map(|(project_path, mut stat)| {
        stat.session_count = project_sessions.get(&project_path).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_project.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_api_base_url: Vec<ApiBaseUrlUsage> = api_base_url_stats.into_iter().map(|(api_url, mut stat)| {
        stat.session_count = api_sessions.get(&api_url).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_api_base_url.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    Ok(UsageStats {
        total_cost,
        total_tokens,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_sessions,
        by_model,
        by_date,
        by_project,
        by_api_base_url,
    })
}

#[command]
pub fn get_usage_details(
    project_path: Option<String>,
    date: Option<String>,
) -> Result<Vec<UsageEntry>, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let mut all_entries = get_all_usage_entries(&claude_path);

    // Filter by project if specified
    if let Some(project) = project_path {
        all_entries.retain(|e| e.project_path == project);
    }

    // Filter by date if specified
    if let Some(date) = date {
        all_entries.retain(|e| e.timestamp.starts_with(&date));
    }

    Ok(all_entries)
}

#[command]
pub fn get_today_usage_stats() -> Result<UsageStats, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);

    // Get today's date
    let today = Local::now().naive_local().date();
    
    // Filter entries for today only
    let today_entries: Vec<_> = all_entries
        .into_iter()
        .filter(|e| {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&e.timestamp) {
                dt.naive_local().date() == today
            } else {
                false
            }
        })
        .collect();

    if today_entries.is_empty() {
        return Ok(UsageStats {
            total_cost: 0.0,
            total_tokens: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_creation_tokens: 0,
            total_cache_read_tokens: 0,
            total_sessions: 0,
            by_model: vec![],
            by_date: vec![],
            by_project: vec![],
            by_api_base_url: vec![],
        });
    }

    // Calculate aggregated stats for today
    let mut total_cost = 0.0;
    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;

    let mut model_stats: HashMap<String, ModelUsage> = HashMap::new();
    let mut daily_stats: HashMap<String, DailyUsage> = HashMap::new();
    let mut project_stats: HashMap<String, ProjectUsage> = HashMap::new();
    let mut api_base_url_stats: HashMap<String, ApiBaseUrlUsage> = HashMap::new();
    
    // Track unique sessions for accurate counting
    let mut unique_sessions: HashSet<String> = HashSet::new();
    let mut model_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut project_sessions: HashMap<String, HashSet<String>> = HashMap::new();
    let mut api_sessions: HashMap<String, HashSet<String>> = HashMap::new();

    for entry in &today_entries {
        // Update totals
        total_cost += entry.cost;
        total_input_tokens += entry.input_tokens;
        total_output_tokens += entry.output_tokens;
        total_cache_creation_tokens += entry.cache_creation_tokens;
        total_cache_read_tokens += entry.cache_read_tokens;

        // Track unique sessions
        unique_sessions.insert(entry.session_id.clone());
        
        // Track sessions per model
        model_sessions
            .entry(entry.model.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per project
        project_sessions
            .entry(entry.project_path.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
            
        // Track sessions per API base URL
        api_sessions
            .entry(entry.api_base_url.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());

        // Update model stats
        let model_stat = model_stats
            .entry(entry.model.clone())
            .or_insert(ModelUsage {
                model: entry.model.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        model_stat.total_cost += entry.cost;
        model_stat.input_tokens += entry.input_tokens;
        model_stat.output_tokens += entry.output_tokens;
        model_stat.cache_creation_tokens += entry.cache_creation_tokens;
        model_stat.cache_read_tokens += entry.cache_read_tokens;
        model_stat.total_tokens = model_stat.input_tokens + model_stat.output_tokens + model_stat.cache_creation_tokens + model_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking

        // Update daily stats
        let date = entry
            .timestamp
            .split('T')
            .next()
            .unwrap_or(&entry.timestamp)
            .to_string();
        let daily_stat = daily_stats.entry(date.clone()).or_insert(DailyUsage {
            date,
            total_cost: 0.0,
            total_tokens: 0,
            models_used: vec![],
        });
        daily_stat.total_cost += entry.cost;
        daily_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        if !daily_stat.models_used.contains(&entry.model) {
            daily_stat.models_used.push(entry.model.clone());
        }

        // Update project stats
        let project_stat =
            project_stats
                .entry(entry.project_path.clone())
                .or_insert(ProjectUsage {
                    project_path: entry.project_path.clone(),
                    project_name: entry
                        .project_path
                        .split('/')
                        .last()
                        .unwrap_or(&entry.project_path)
                        .to_string(),
                    total_cost: 0.0,
                    total_tokens: 0,
                    session_count: 0,
                    last_used: entry.timestamp.clone(),
                });
        project_stat.total_cost += entry.cost;
        project_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        // Session count will be set later from unique session tracking
        if entry.timestamp > project_stat.last_used {
            project_stat.last_used = entry.timestamp.clone();
        }

        // Update API base URL stats
        let api_base_url_stat = api_base_url_stats
            .entry(entry.api_base_url.clone())
            .or_insert(ApiBaseUrlUsage {
                api_base_url: entry.api_base_url.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });
        api_base_url_stat.total_cost += entry.cost;
        api_base_url_stat.input_tokens += entry.input_tokens;
        api_base_url_stat.output_tokens += entry.output_tokens;
        api_base_url_stat.cache_creation_tokens += entry.cache_creation_tokens;
        api_base_url_stat.cache_read_tokens += entry.cache_read_tokens;
        api_base_url_stat.total_tokens = api_base_url_stat.input_tokens + api_base_url_stat.output_tokens + api_base_url_stat.cache_creation_tokens + api_base_url_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;
    let total_sessions = unique_sessions.len() as u64;

    // Set correct session counts and convert hashmaps to sorted vectors
    let mut by_model: Vec<ModelUsage> = model_stats.into_iter().map(|(model, mut stat)| {
        stat.session_count = model_sessions.get(&model).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_model.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_date: Vec<DailyUsage> = daily_stats.into_values().collect();
    by_date.sort_by(|a, b| b.date.cmp(&a.date));

    let mut by_project: Vec<ProjectUsage> = project_stats.into_iter().map(|(project_path, mut stat)| {
        stat.session_count = project_sessions.get(&project_path).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_project.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    let mut by_api_base_url: Vec<ApiBaseUrlUsage> = api_base_url_stats.into_iter().map(|(api_url, mut stat)| {
        stat.session_count = api_sessions.get(&api_url).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_api_base_url.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    Ok(UsageStats {
        total_cost,
        total_tokens,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_sessions,
        by_model,
        by_date,
        by_project,
        by_api_base_url,
    })
}

#[command]
pub fn get_session_stats(
    since: Option<String>,
    until: Option<String>,
    order: Option<String>,
) -> Result<Vec<ProjectUsage>, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);

    let since_date = since.and_then(|s| NaiveDate::parse_from_str(&s, "%Y%m%d").ok());
    let until_date = until.and_then(|s| NaiveDate::parse_from_str(&s, "%Y%m%d").ok());

    let filtered_entries: Vec<_> = all_entries
        .into_iter()
        .filter(|e| {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&e.timestamp) {
                let date = dt.date_naive();
                let is_after_since = since_date.map_or(true, |s| date >= s);
                let is_before_until = until_date.map_or(true, |u| date <= u);
                is_after_since && is_before_until
            } else {
                false
            }
        })
        .collect();

    let mut session_stats: HashMap<String, ProjectUsage> = HashMap::new();
    for entry in &filtered_entries {
        let session_key = format!("{}/{}", entry.project_path, entry.session_id);
        let project_stat = session_stats
            .entry(session_key)
            .or_insert_with(|| ProjectUsage {
                project_path: entry.project_path.clone(),
                project_name: entry.session_id.clone(), // Using session_id as project_name for session view
                total_cost: 0.0,
                total_tokens: 0,
                session_count: 0, // In this context, this will count entries per session
                last_used: " ".to_string(),
            });

        project_stat.total_cost += entry.cost;
        project_stat.total_tokens += entry.input_tokens
            + entry.output_tokens
            + entry.cache_creation_tokens
            + entry.cache_read_tokens;
        // Session count will be set later from unique session tracking
        if entry.timestamp > project_stat.last_used {
            project_stat.last_used = entry.timestamp.clone();
        }
    }

    let mut by_session: Vec<ProjectUsage> = session_stats.into_values().collect();

    // Sort by last_used date
    if let Some(order_str) = order {
        if order_str == "asc" {
            by_session.sort_by(|a, b| a.last_used.cmp(&b.last_used));
        } else {
            by_session.sort_by(|a, b| b.last_used.cmp(&a.last_used));
        }
    } else {
        // Default to descending
        by_session.sort_by(|a, b| b.last_used.cmp(&a.last_used));
    }

    Ok(by_session)
}

#[command]
pub fn get_usage_by_api_base_url() -> Result<Vec<ApiBaseUrlUsage>, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);

    if all_entries.is_empty() {
        return Ok(vec![]);
    }

    let mut api_base_url_stats: HashMap<String, ApiBaseUrlUsage> = HashMap::new();
    
    // Track unique sessions for accurate counting
    let mut api_sessions: HashMap<String, HashSet<String>> = HashMap::new();

    for entry in &all_entries {
        // Track sessions per API base URL
        api_sessions
            .entry(entry.api_base_url.clone())
            .or_insert_with(HashSet::new)
            .insert(entry.session_id.clone());
        let api_base_url_stat = api_base_url_stats
            .entry(entry.api_base_url.clone())
            .or_insert(ApiBaseUrlUsage {
                api_base_url: entry.api_base_url.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                session_count: 0,
            });

        api_base_url_stat.total_cost += entry.cost;
        api_base_url_stat.input_tokens += entry.input_tokens;
        api_base_url_stat.output_tokens += entry.output_tokens;
        api_base_url_stat.cache_creation_tokens += entry.cache_creation_tokens;
        api_base_url_stat.cache_read_tokens += entry.cache_read_tokens;
        api_base_url_stat.total_tokens = api_base_url_stat.input_tokens + api_base_url_stat.output_tokens + api_base_url_stat.cache_creation_tokens + api_base_url_stat.cache_read_tokens;
        // Session count will be set later from unique session tracking
    }

    let mut by_api_base_url: Vec<ApiBaseUrlUsage> = api_base_url_stats.into_iter().map(|(api_url, mut stat)| {
        stat.session_count = api_sessions.get(&api_url).map(|s| s.len()).unwrap_or(0) as u64;
        stat
    }).collect();
    by_api_base_url.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

    Ok(by_api_base_url)
}

#[derive(Debug, Serialize)]
pub struct ActiveSessionInfo {
    session_id: String,
    project_path: String,
    start_time: String,
    last_activity: String,
    total_tokens: u64,
    total_cost: f64,
    time_remaining_hours: f64,
    is_active: bool,
}

#[command]
pub fn get_active_sessions() -> Result<Vec<ActiveSessionInfo>, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);
    if all_entries.is_empty() {
        return Ok(vec![]);
    }

    let session_starts = track_active_sessions(&all_entries);
    let current_time = Local::now();
    
    // Group entries by session
    let mut session_data: HashMap<String, (u64, f64, String, String)> = HashMap::new();
    
    for entry in &all_entries {
        let session_stats = session_data
            .entry(entry.session_id.clone())
            .or_insert((0, 0.0, entry.project_path.clone(), entry.timestamp.clone()));
            
        session_stats.0 += entry.input_tokens + entry.output_tokens + entry.cache_creation_tokens + entry.cache_read_tokens;
        session_stats.1 += entry.cost;
        
        // Update last activity if this entry is more recent
        if entry.timestamp > session_stats.3 {
            session_stats.3 = entry.timestamp.clone();
        }
    }
    
    let mut active_sessions = Vec::new();
    
    for (session_id, (total_tokens, total_cost, project_path, last_activity)) in session_data {
        if let Some(start_time) = session_starts.get(&session_id) {
            let elapsed_hours = current_time.signed_duration_since(*start_time).num_hours() as f64;
            let time_remaining = (SESSION_WINDOW_HOURS as f64) - elapsed_hours;
            let is_active = time_remaining > 0.0;
            
            active_sessions.push(ActiveSessionInfo {
                session_id,
                project_path,
                start_time: start_time.to_rfc3339(),
                last_activity,
                total_tokens,
                total_cost,
                time_remaining_hours: time_remaining.max(0.0),
                is_active,
            });
        }
    }
    
    // Sort by remaining time (active sessions first, then by time remaining)
    active_sessions.sort_by(|a, b| {
        match (a.is_active, b.is_active) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.time_remaining_hours.partial_cmp(&a.time_remaining_hours).unwrap(),
        }
    });
    
    Ok(active_sessions)
}

#[derive(Debug, Serialize)]
pub struct BurnRateInfo {
    current_burn_rate: f64,  // tokens per minute
    estimated_depletion_time: Option<String>,  // when tokens will run out
    session_utilization: f64,  // percentage of session time used
    recommendations: Vec<String>,
}

#[command]
pub fn get_burn_rate_analysis() -> Result<BurnRateInfo, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let all_entries = get_all_usage_entries(&claude_path);
    if all_entries.is_empty() {
        return Ok(BurnRateInfo {
            current_burn_rate: 0.0,
            estimated_depletion_time: None,
            session_utilization: 0.0,
            recommendations: vec!["No usage data available".to_string()],
        });
    }

    let current_time = Local::now();
    let one_hour_ago = current_time - Duration::hours(1);
    
    // Filter entries from the last hour for burn rate calculation
    let recent_entries: Vec<_> = all_entries
        .iter()
        .filter(|entry| {
            if let Ok(entry_time) = DateTime::parse_from_rfc3339(&entry.timestamp) {
                entry_time.with_timezone(&Local) > one_hour_ago
            } else {
                false
            }
        })
        .collect();
    
    if recent_entries.is_empty() {
        return Ok(BurnRateInfo {
            current_burn_rate: 0.0,
            estimated_depletion_time: None,
            session_utilization: 0.0,
            recommendations: vec!["No recent activity detected".to_string()],
        });
    }
    
    // Calculate burn rate (tokens per minute)
    let total_recent_tokens: u64 = recent_entries
        .iter()
        .map(|entry| entry.input_tokens + entry.output_tokens + entry.cache_creation_tokens + entry.cache_read_tokens)
        .sum();
    
    let burn_rate = total_recent_tokens as f64 / 60.0; // per minute
    
    // Find active sessions and estimate when they'll run out
    let session_starts = track_active_sessions(&all_entries);
    let active_sessions = session_starts
        .iter()
        .filter(|(_, start_time)| {
            current_time.signed_duration_since(**start_time).num_hours() < SESSION_WINDOW_HOURS
        })
        .count();
    
    // Calculate session utilization
    let session_utilization = if !session_starts.is_empty() {
        let avg_session_age: f64 = session_starts
            .values()
            .map(|start| current_time.signed_duration_since(*start).num_hours() as f64)
            .sum::<f64>() / session_starts.len() as f64;
        
        (avg_session_age / SESSION_WINDOW_HOURS as f64 * 100.0).min(100.0)
    } else {
        0.0
    };
    
    // Generate recommendations
    let mut recommendations = Vec::new();
    
    if burn_rate > 100.0 {
        recommendations.push("High burn rate detected. Consider optimizing prompts or using smaller models.".to_string());
    }
    
    if session_utilization > 80.0 {
        recommendations.push("Sessions are nearing expiration. Plan token-intensive tasks around session resets.".to_string());
    }
    
    if active_sessions > 3 {
        recommendations.push("Multiple active sessions detected. Consider consolidating work into fewer sessions.".to_string());
    }
    
    if recommendations.is_empty() {
        recommendations.push("Usage patterns look optimal.".to_string());
    }
    
    Ok(BurnRateInfo {
        current_burn_rate: burn_rate,
        estimated_depletion_time: None, // TODO: Implement based on current session limits
        session_utilization,
        recommendations,
    })
}
