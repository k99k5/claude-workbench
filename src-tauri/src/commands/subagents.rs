/// Subagents专业化系统核心实现
///
/// 这个模块实现了智能子代理系统，包括：
/// - 专业化子代理类型定义
/// - 智能路由器（根据用户请求自动选择最合适的子代理）
/// - 专业化模板管理
/// - 与现有Agent系统的无缝集成

use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use log::{info, warn, debug, error};

/// 专业化子代理类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum SpecialtyType {
    General,          // 通用型
    CodeReviewer,     // 代码审查
    TestEngineer,     // 测试工程师
    SecurityAuditor,  // 安全审计
    PerformanceOptimizer, // 性能优化
    Custom(String),   // 自定义专业化
}

impl SpecialtyType {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &str {
        match self {
            SpecialtyType::General => "general",
            SpecialtyType::CodeReviewer => "code-reviewer",
            SpecialtyType::TestEngineer => "test-engineer",
            SpecialtyType::SecurityAuditor => "security-auditor",
            SpecialtyType::PerformanceOptimizer => "performance-optimizer",
            SpecialtyType::Custom(s) => s,
        }
    }

    #[allow(dead_code)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "general" => SpecialtyType::General,
            "code-reviewer" => SpecialtyType::CodeReviewer,
            "test-engineer" => SpecialtyType::TestEngineer,
            "security-auditor" => SpecialtyType::SecurityAuditor,
            "performance-optimizer" => SpecialtyType::PerformanceOptimizer,
            _ => SpecialtyType::Custom(s.to_string()),
        }
    }
}

/// 专业化配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecialtyConfig {
    /// 允许的工具列表
    pub allowed_tools: Vec<String>,
    /// 触发条件（用于自动调用）
    pub trigger_conditions: Option<Vec<TriggerCondition>>,
    /// 上下文窗口大小
    pub context_window_size: Option<usize>,
    /// 最大并发任务数
    pub max_concurrent_tasks: Option<usize>,
}

/// 触发条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerCondition {
    pub event_type: String, // "file_change", "test_failure", "security_alert"
    pub pattern: String,    // 匹配模式
    pub enabled: bool,
}

/// 子代理专业化定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubagentSpecialty {
    pub id: Option<i64>,
    pub specialty_type: String,
    pub display_name: String,
    pub description: Option<String>,
    pub default_system_prompt: String,
    pub default_tools: String, // JSON array
    pub routing_patterns: String, // JSON array
    pub icon_suggestion: Option<String>,
    pub created_at: String,
}

/// 路由决策结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingDecision {
    /// 选中的子代理ID
    pub agent_id: Option<i64>,
    /// 专业化类型
    pub specialty_type: String,
    /// 置信度分数 (0.0-1.0)
    pub confidence_score: f64,
    /// 路由原因
    pub reasoning: String,
    /// 匹配的关键词
    pub matched_keywords: Vec<String>,
}

/// 智能路由器 - 保留用于未来扩展
#[allow(dead_code)]
pub struct SubagentRouter {
    db: std::sync::Arc<Mutex<Connection>>,
}

#[allow(dead_code)]
impl SubagentRouter {
    pub fn new(db: std::sync::Arc<Mutex<Connection>>) -> Self {
        Self { db }
    }

    /// 根据用户请求智能选择最合适的子代理
    pub fn route_request(&self, user_request: &str) -> Result<RoutingDecision, String> {
        let request_lower = user_request.to_lowercase();
        debug!("Routing request: {}", user_request);

        // 获取所有可用的专业化子代理
        let conn = self.db.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT a.id, a.specialty, a.name, a.routing_keywords, s.routing_patterns, s.display_name
             FROM agents a
             LEFT JOIN subagent_specialties s ON a.specialty = s.specialty_type
             WHERE a.specialty != 'general'
             ORDER BY a.id"
        ).map_err(|e| e.to_string())?;

        let mut candidates: Vec<(i64, String, String, Vec<String>, f64)> = Vec::new();

        let rows = stmt.query_map([], |row| {
            let agent_id: i64 = row.get(0)?;
            let specialty: String = row.get(1)?;
            let agent_name: String = row.get(2)?;
            let routing_keywords: Option<String> = row.get(3)?;
            let routing_patterns: Option<String> = row.get(4)?;

            Ok((agent_id, specialty, agent_name, routing_keywords, routing_patterns))
        }).map_err(|e| e.to_string())?;

        for row_result in rows {
            let (agent_id, specialty, agent_name, routing_keywords, routing_patterns) =
                row_result.map_err(|e| e.to_string())?;

            // 合并关键词来源
            let mut all_keywords = Vec::new();

            // 从agent的routing_keywords中提取
            if let Some(keywords_json) = routing_keywords {
                if let Ok(keywords) = serde_json::from_str::<Vec<String>>(&keywords_json) {
                    all_keywords.extend(keywords);
                }
            }

            // 从specialty的routing_patterns中提取
            if let Some(patterns_json) = routing_patterns {
                if let Ok(patterns) = serde_json::from_str::<Vec<String>>(&patterns_json) {
                    all_keywords.extend(patterns);
                }
            }

            // 计算匹配分数
            let (score, matched) = self.calculate_match_score(&request_lower, &all_keywords);

            if score > 0.0 {
                candidates.push((agent_id, specialty.clone(), agent_name.clone(), matched, score));
                debug!("Candidate: {} ({}), score: {:.2}", agent_name, specialty, score);
            }
        }

        // 选择得分最高的候选
        if let Some((best_agent_id, best_specialty, best_name, matched_keywords, best_score)) =
            candidates.iter().max_by(|a, b| a.4.partial_cmp(&b.4).unwrap()) {

            let reasoning = format!(
                "Selected '{}' ({}) based on matching keywords: {}",
                best_name,
                best_specialty,
                matched_keywords.join(", ")
            );

            info!("Routing decision: {} with confidence {:.2}", reasoning, best_score);

            // 记录路由日志
            let _ = self.log_routing_decision(
                user_request,
                Some(*best_agent_id),
                best_specialty,
                *best_score,
                &reasoning
            );

            return Ok(RoutingDecision {
                agent_id: Some(*best_agent_id),
                specialty_type: best_specialty.clone(),
                confidence_score: *best_score,
                reasoning,
                matched_keywords: matched_keywords.clone(),
            });
        }

        // 没有找到匹配的专业化子代理，返回通用建议
        warn!("No specialized agent found for request, suggesting general agent");

        Ok(RoutingDecision {
            agent_id: None,
            specialty_type: "general".to_string(),
            confidence_score: 0.0,
            reasoning: "No specialized agent matched the request. Consider creating a general agent or adding more routing keywords.".to_string(),
            matched_keywords: vec![],
        })
    }

    /// 计算匹配分数
    fn calculate_match_score(&self, request: &str, keywords: &[String]) -> (f64, Vec<String>) {
        let mut score = 0.0;
        let mut matched = Vec::new();

        for keyword in keywords {
            let keyword_lower = keyword.to_lowercase();
            if request.contains(&keyword_lower) {
                // 关键词长度越长，权重越高（更具体的匹配）
                let weight = 1.0 + (keyword_lower.len() as f64 * 0.1);
                score += weight;
                matched.push(keyword.clone());
            }
        }

        // 归一化分数到 0-1 范围
        let normalized_score = if score > 0.0 {
            (score / (keywords.len() as f64 * 1.5)).min(1.0)
        } else {
            0.0
        };

        (normalized_score, matched)
    }

    /// 记录路由决策到数据库
    fn log_routing_decision(
        &self,
        user_request: &str,
        agent_id: Option<i64>,
        specialty: &str,
        confidence: f64,
        reasoning: &str,
    ) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO subagent_routing_log (user_request, selected_agent_id, selected_specialty, confidence_score, routing_reason)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![user_request, agent_id, specialty, confidence, reasoning]
        ).map_err(|e| format!("Failed to log routing decision: {}", e))?;

        Ok(())
    }
}

// ============ Tauri Commands ============

/// 初始化子代理专业化系统
#[tauri::command]
pub async fn init_subagent_system(
    db: State<'_, crate::commands::agents::AgentDb>
) -> Result<String, String> {
    info!("Initializing subagent specialization system");

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // 执行schema初始化
    let schema_sql = include_str!("subagents_schema.sql");

    // 分割并执行每个SQL语句
    for statement in schema_sql.split(';') {
        let trimmed = statement.trim();
        if !trimmed.is_empty() && !trimmed.starts_with("--") {
            conn.execute(trimmed, []).map_err(|e| {
                warn!("Failed to execute SQL statement: {}", e);
                // 继续执行，因为某些语句（如ALTER TABLE）可能已经存在
                e.to_string()
            }).ok();
        }
    }

    info!("Subagent system initialized successfully");
    Ok("Subagent system initialized".to_string())
}

/// 获取所有专业化类型
#[tauri::command]
pub async fn list_subagent_specialties(
    db: State<'_, crate::commands::agents::AgentDb>
) -> Result<Vec<SubagentSpecialty>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, specialty_type, display_name, description, default_system_prompt, default_tools, routing_patterns, icon_suggestion, created_at
         FROM subagent_specialties
         ORDER BY specialty_type"
    ).map_err(|e| e.to_string())?;

    let specialties = stmt.query_map([], |row| {
        Ok(SubagentSpecialty {
            id: row.get(0)?,
            specialty_type: row.get(1)?,
            display_name: row.get(2)?,
            description: row.get(3)?,
            default_system_prompt: row.get(4)?,
            default_tools: row.get(5)?,
            routing_patterns: row.get(6)?,
            icon_suggestion: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<SqliteResult<Vec<_>>>()
      .map_err(|e| e.to_string())?;

    Ok(specialties)
}

/// 智能路由并执行专业化代理任务
#[tauri::command]
pub async fn route_to_subagent(
    db: State<'_, crate::commands::agents::AgentDb>,
    user_request: String,
) -> Result<RoutingDecision, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let request_lower = user_request.to_lowercase();

    let mut stmt = conn.prepare(
        "SELECT a.id, a.specialty, a.name, a.routing_keywords, s.routing_patterns, s.display_name
         FROM agents a
         LEFT JOIN subagent_specialties s ON a.specialty = s.specialty_type
         WHERE a.specialty != 'general'
         ORDER BY a.id"
    ).map_err(|e| e.to_string())?;

    let mut candidates: Vec<(i64, String, String, Vec<String>, f64)> = Vec::new();

    let rows = stmt.query_map([], |row| {
        let agent_id: i64 = row.get(0)?;
        let specialty: String = row.get(1)?;
        let agent_name: String = row.get(2)?;
        let routing_keywords: Option<String> = row.get(3)?;
        let routing_patterns: Option<String> = row.get(4)?;

        Ok((agent_id, specialty, agent_name, routing_keywords, routing_patterns))
    }).map_err(|e| e.to_string())?;

    for row_result in rows {
        let (agent_id, specialty, agent_name, routing_keywords, routing_patterns) =
            row_result.map_err(|e| e.to_string())?;

        // 合并关键词来源
        let mut all_keywords = Vec::new();

        // 从agent的routing_keywords中提取
        if let Some(keywords_json) = routing_keywords {
            if let Ok(keywords) = serde_json::from_str::<Vec<String>>(&keywords_json) {
                all_keywords.extend(keywords);
            }
        }

        // 从specialty的routing_patterns中提取
        if let Some(patterns_json) = routing_patterns {
            if let Ok(patterns) = serde_json::from_str::<Vec<String>>(&patterns_json) {
                all_keywords.extend(patterns);
            }
        }

        // 计算匹配分数
        let (score, matched) = calculate_match_score(&request_lower, &all_keywords);

        if score > 0.0 {
            candidates.push((agent_id, specialty.clone(), agent_name.clone(), matched, score));
        }
    }

    // 选择得分最高的候选
    if let Some((best_agent_id, best_specialty, best_name, matched_keywords, best_score)) =
        candidates.iter().max_by(|a, b| a.4.partial_cmp(&b.4).unwrap()) {

        let reasoning = format!(
            "Selected '{}' ({}) based on matching keywords: {}",
            best_name,
            best_specialty,
            matched_keywords.join(", ")
        );

        return Ok(RoutingDecision {
            agent_id: Some(*best_agent_id),
            specialty_type: best_specialty.clone(),
            confidence_score: *best_score,
            reasoning,
            matched_keywords: matched_keywords.clone(),
        });
    }

    // 没有找到匹配的专业化子代理，返回通用建议
    Ok(RoutingDecision {
        agent_id: None,
        specialty_type: "general".to_string(),
        confidence_score: 0.0,
        reasoning: "No specialized agent matched the request. Consider creating a general agent or adding more routing keywords.".to_string(),
        matched_keywords: vec![],
    })
}

/// 计算匹配分数的辅助函数
fn calculate_match_score(request: &str, keywords: &[String]) -> (f64, Vec<String>) {
    let mut score = 0.0;
    let mut matched = Vec::new();

    for keyword in keywords {
        let keyword_lower = keyword.to_lowercase();
        if request.contains(&keyword_lower) {
            // 关键词长度越长，权重越高（更具体的匹配）
            let weight = 1.0 + (keyword_lower.len() as f64 * 0.1);
            score += weight;
            matched.push(keyword.clone());
        }
    }

    // 归一化分数到 0-1 范围
    let normalized_score = if score > 0.0 {
        (score / (keywords.len() as f64 * 1.5)).min(1.0)
    } else {
        0.0
    };

    (normalized_score, matched)
}

/// 更新子代理的专业化配置
#[tauri::command]
pub async fn update_subagent_specialty(
    db: State<'_, crate::commands::agents::AgentDb>,
    agent_id: i64,
    specialty: String,
    specialty_config: Option<String>,
    routing_keywords: Option<String>,
    auto_invoke: Option<bool>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE agents SET specialty = ?1, specialty_config = ?2, routing_keywords = ?3, auto_invoke = ?4
         WHERE id = ?5",
        params![specialty, specialty_config, routing_keywords, auto_invoke.unwrap_or(false), agent_id]
    ).map_err(|e| e.to_string())?;

    info!("Updated specialty for agent {}: {}", agent_id, specialty);
    Ok(())
}

/// 获取子代理路由历史
#[tauri::command]
pub async fn get_routing_history(
    db: State<'_, crate::commands::agents::AgentDb>,
    limit: Option<i64>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut stmt = conn.prepare(
        "SELECT user_request, selected_agent_id, selected_specialty, confidence_score, routing_reason, user_feedback, created_at
         FROM subagent_routing_log
         ORDER BY created_at DESC
         LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let logs = stmt.query_map([limit], |row| {
        Ok(serde_json::json!({
            "user_request": row.get::<_, String>(0)?,
            "selected_agent_id": row.get::<_, Option<i64>>(1)?,
            "selected_specialty": row.get::<_, String>(2)?,
            "confidence_score": row.get::<_, f64>(3)?,
            "routing_reason": row.get::<_, String>(4)?,
            "user_feedback": row.get::<_, Option<i32>>(5)?,
            "created_at": row.get::<_, String>(6)?,
        }))
    }).map_err(|e| e.to_string())?
      .collect::<SqliteResult<Vec<_>>>()
      .map_err(|e| e.to_string())?;

    Ok(logs)
}

/// 提供路由反馈（用于改进路由算法）
#[tauri::command]
pub async fn provide_routing_feedback(
    db: State<'_, crate::commands::agents::AgentDb>,
    log_id: i64,
    feedback: i32, // 1: good, 0: neutral, -1: bad
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE subagent_routing_log SET user_feedback = ?1 WHERE id = ?2",
        params![feedback, log_id]
    ).map_err(|e| e.to_string())?;

    info!("Recorded routing feedback for log {}: {}", log_id, feedback);
    Ok(())
}

/// 代码审查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeReviewResult {
    pub overall_score: f64, // 0.0-10.0
    pub issues: Vec<CodeIssue>,
    pub recommendations: Vec<String>,
    pub summary: String,
    pub files_reviewed: Vec<String>,
}

/// 代码问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    pub severity: String, // "critical", "major", "minor", "info"
    pub category: String, // "security", "performance", "maintainability", "style"
    pub file_path: String,
    pub line: Option<u32>,
    pub message: String,
    pub suggestion: Option<String>,
}

/// 执行专业化代码审查
#[tauri::command]
pub async fn execute_code_review(
    db: State<'_, crate::commands::agents::AgentDb>,
    file_paths: Vec<String>,
    review_scope: Option<String>, // "security", "performance", "all"
) -> Result<CodeReviewResult, String> {
    info!("Starting code review for {} files", file_paths.len());

    let mut issues = Vec::new();
    let mut files_reviewed = Vec::new();

    // 获取code-reviewer的专业化配置
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let _specialty_config = conn.query_row(
        "SELECT default_system_prompt, default_tools FROM subagent_specialties WHERE specialty_type = 'code-reviewer'",
        [],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?
            ))
        }
    ).map_err(|e| format!("Failed to get code-reviewer config: {}", e))?;

    drop(conn); // 释放锁

    let scope = review_scope.unwrap_or_else(|| "all".to_string());

    for file_path in &file_paths {
        info!("Reviewing file: {}", file_path);

        // 读取文件内容
        let content = match std::fs::read_to_string(file_path) {
            Ok(content) => content,
            Err(e) => {
                error!("Failed to read file {}: {}", file_path, e);
                continue;
            }
        };

        // 执行具体的代码审查逻辑
        let file_issues = perform_static_analysis(&content, file_path, &scope)?;
        issues.extend(file_issues);

        files_reviewed.push(file_path.clone());
    }

    // 生成审查建议
    let overall_score = calculate_overall_score(&issues);
    let recommendations = generate_recommendations(&issues, &scope);

    let summary = format!(
        "审查了{}个文件，发现{}个问题。总体评分：{:.1}/10.0",
        files_reviewed.len(),
        issues.len(),
        overall_score
    );

    Ok(CodeReviewResult {
        overall_score,
        issues,
        recommendations,
        summary,
        files_reviewed,
    })
}

/// 执行静态代码分析
fn perform_static_analysis(content: &str, file_path: &str, scope: &str) -> Result<Vec<CodeIssue>, String> {
    let mut issues = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    // 安全性检查
    if scope == "all" || scope == "security" {
        issues.extend(check_security_issues(&lines, file_path));
    }

    // 性能检查
    if scope == "all" || scope == "performance" {
        issues.extend(check_performance_issues(&lines, file_path));
    }

    // 可维护性检查
    if scope == "all" || scope == "maintainability" {
        issues.extend(check_maintainability_issues(&lines, file_path));
    }

    // 代码风格检查
    if scope == "all" || scope == "style" {
        issues.extend(check_style_issues(&lines, file_path));
    }

    Ok(issues)
}

/// 安全性检查
fn check_security_issues(lines: &[&str], file_path: &str) -> Vec<CodeIssue> {
    let mut issues = Vec::new();

    for (line_num, line) in lines.iter().enumerate() {
        let line_lower = line.to_lowercase();

        // 检查SQL注入风险
        if line_lower.contains("query") && (line_lower.contains("${") || line_lower.contains("+ ")) {
            issues.push(CodeIssue {
                severity: "critical".to_string(),
                category: "security".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: "可能存在SQL注入风险：动态拼接SQL语句".to_string(),
                suggestion: Some("使用参数化查询或prepared statements".to_string()),
            });
        }

        // 检查XSS风险
        if line_lower.contains("innerhtml") && !line_lower.contains("sanitize") {
            issues.push(CodeIssue {
                severity: "major".to_string(),
                category: "security".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: "可能存在XSS风险：直接设置innerHTML".to_string(),
                suggestion: Some("使用textContent或对内容进行sanitize".to_string()),
            });
        }

        // 检查硬编码密钥
        if line_lower.contains("password") || line_lower.contains("secret") || line_lower.contains("token") {
            if line.contains("=") && (line.contains("\"") || line.contains("'")) {
                issues.push(CodeIssue {
                    severity: "critical".to_string(),
                    category: "security".to_string(),
                    file_path: file_path.to_string(),
                    line: Some((line_num + 1) as u32),
                    message: "可能存在硬编码敏感信息".to_string(),
                    suggestion: Some("使用环境变量或配置文件存储敏感信息".to_string()),
                });
            }
        }
    }

    issues
}

/// 性能检查
fn check_performance_issues(lines: &[&str], file_path: &str) -> Vec<CodeIssue> {
    let mut issues = Vec::new();

    for (line_num, line) in lines.iter().enumerate() {
        let line_lower = line.to_lowercase();

        // 检查N+1查询问题
        if line_lower.contains("for") && (line_lower.contains("query") || line_lower.contains("find")) {
            issues.push(CodeIssue {
                severity: "major".to_string(),
                category: "performance".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: "可能存在N+1查询问题：循环中执行数据库查询".to_string(),
                suggestion: Some("考虑使用批量查询或JOIN操作".to_string()),
            });
        }

        // 检查大文件读取
        if line_lower.contains("readfile") && !line_lower.contains("stream") {
            issues.push(CodeIssue {
                severity: "minor".to_string(),
                category: "performance".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: "大文件读取可能影响性能".to_string(),
                suggestion: Some("对于大文件考虑使用流式读取".to_string()),
            });
        }
    }

    issues
}

/// 可维护性检查
fn check_maintainability_issues(lines: &[&str], file_path: &str) -> Vec<CodeIssue> {
    let mut issues = Vec::new();

    // 检查函数长度
    let mut in_function = false;
    let mut function_start = 0;
    let mut brace_count = 0;

    for (line_num, line) in lines.iter().enumerate() {
        if line.contains("function ") || line.contains("fn ") || line.contains("def ") {
            in_function = true;
            function_start = line_num;
            brace_count = 0;
        }

        if in_function {
            brace_count += line.matches('{').count() as i32;
            brace_count -= line.matches('}').count() as i32;

            if brace_count == 0 && line_num > function_start {
                let function_length = line_num - function_start + 1;
                if function_length > 50 {
                    issues.push(CodeIssue {
                        severity: "minor".to_string(),
                        category: "maintainability".to_string(),
                        file_path: file_path.to_string(),
                        line: Some((function_start + 1) as u32),
                        message: format!("函数过长：{}行", function_length),
                        suggestion: Some("考虑将长函数拆分为更小的函数".to_string()),
                    });
                }
                in_function = false;
            }
        }
    }

    issues
}

/// 代码风格检查
fn check_style_issues(lines: &[&str], file_path: &str) -> Vec<CodeIssue> {
    let mut issues = Vec::new();

    for (line_num, line) in lines.iter().enumerate() {
        // 检查行长度
        if line.len() > 120 {
            issues.push(CodeIssue {
                severity: "info".to_string(),
                category: "style".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: format!("行过长：{}字符", line.len()),
                suggestion: Some("考虑将长行拆分为多行".to_string()),
            });
        }

        // 检查TODO注释
        if line.to_lowercase().contains("todo") || line.to_lowercase().contains("fixme") {
            issues.push(CodeIssue {
                severity: "info".to_string(),
                category: "style".to_string(),
                file_path: file_path.to_string(),
                line: Some((line_num + 1) as u32),
                message: "存在TODO或FIXME注释".to_string(),
                suggestion: Some("及时处理或转换为正式的issue".to_string()),
            });
        }
    }

    issues
}

/// 计算总体评分
fn calculate_overall_score(issues: &[CodeIssue]) -> f64 {
    let mut score: f64 = 10.0;

    for issue in issues {
        match issue.severity.as_str() {
            "critical" => score -= 2.0,
            "major" => score -= 1.0,
            "minor" => score -= 0.5,
            "info" => score -= 0.1,
            _ => {}
        }
    }

    score.max(0.0)
}

/// 生成改进建议
fn generate_recommendations(issues: &[CodeIssue], _scope: &str) -> Vec<String> {
    let mut recommendations = Vec::new();

    let critical_count = issues.iter().filter(|i| i.severity == "critical").count();
    let major_count = issues.iter().filter(|i| i.severity == "major").count();

    if critical_count > 0 {
        recommendations.push(format!("🚨 立即修复{}个严重安全问题", critical_count));
    }

    if major_count > 0 {
        recommendations.push(format!("⚠️ 优先处理{}个重要问题", major_count));
    }

    // 基于问题类型生成建议
    let security_issues = issues.iter().filter(|i| i.category == "security").count();
    if security_issues > 0 {
        recommendations.push("🔒 建议进行安全培训和代码安全审查流程".to_string());
    }

    let performance_issues = issues.iter().filter(|i| i.category == "performance").count();
    if performance_issues > 0 {
        recommendations.push("⚡ 建议进行性能测试和优化".to_string());
    }

    if recommendations.is_empty() {
        recommendations.push("✅ 代码质量良好，继续保持".to_string());
    }

    recommendations
}