/// 增强型Hooks自动化系统
///
/// 这个模块实现了事件驱动的自动化工作流系统，包括：
/// - 新的hooks事件类型（on-context-compact, on-agent-switch等）
/// - Hooks链式执行和条件触发
/// - 与现有组件深度集成（AutoCompactManager, CheckpointStorage等）
/// - 错误处理和回滚机制

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::process::Command;
use log::{info, warn, error, debug};
use tauri::{AppHandle, Emitter, State};

/// 扩展的Hook事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "PascalCase")]
pub enum HookEvent {
    // 现有事件
    PreToolUse,
    PostToolUse,
    Notification,
    Stop,
    SubagentStop,

    // 新增事件
    OnContextCompact,     // 上下文压缩时触发
    OnAgentSwitch,        // 切换子代理时触发
    OnFileChange,         // 文件修改时触发
    OnSessionStart,       // 会话开始时触发
    OnSessionEnd,         // 会话结束时触发
    OnCheckpointCreate,   // 创建检查点时触发
    OnCheckpointRestore,  // 恢复检查点时触发
    OnTabSwitch,          // 切换标签页时触发
}

impl HookEvent {
    pub fn as_str(&self) -> &str {
        match self {
            HookEvent::PreToolUse => "PreToolUse",
            HookEvent::PostToolUse => "PostToolUse",
            HookEvent::Notification => "Notification",
            HookEvent::Stop => "Stop",
            HookEvent::SubagentStop => "SubagentStop",
            HookEvent::OnContextCompact => "OnContextCompact",
            HookEvent::OnAgentSwitch => "OnAgentSwitch",
            HookEvent::OnFileChange => "OnFileChange",
            HookEvent::OnSessionStart => "OnSessionStart",
            HookEvent::OnSessionEnd => "OnSessionEnd",
            HookEvent::OnCheckpointCreate => "OnCheckpointCreate",
            HookEvent::OnCheckpointRestore => "OnCheckpointRestore",
            HookEvent::OnTabSwitch => "OnTabSwitch",
        }
    }
}

/// Hook执行上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookContext {
    pub event: String,
    pub session_id: String,
    pub project_path: String,
    pub data: serde_json::Value, // 事件特定数据
}

/// Hook执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookExecutionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub hook_command: String,
}

/// Hook链执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookChainResult {
    pub event: String,
    pub total_hooks: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<HookExecutionResult>,
    pub should_continue: bool, // 是否应该继续后续操作
}

/// 条件触发配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalTrigger {
    pub condition: String,      // 条件表达式
    pub enabled: bool,
    pub priority: Option<i32>,  // 执行优先级
}

/// 增强型Hook定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedHook {
    pub command: String,
    pub timeout: Option<u64>,
    pub retry: Option<u32>,
    pub condition: Option<ConditionalTrigger>,
    pub on_success: Option<Vec<String>>, // 成功后执行的命令
    pub on_failure: Option<Vec<String>>, // 失败后执行的命令
}

/// Hook执行器
pub struct HookExecutor {
    app: AppHandle,
}

impl HookExecutor {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 执行单个hook
    pub async fn execute_hook(
        &self,
        hook: &EnhancedHook,
        context: &HookContext,
    ) -> Result<HookExecutionResult, String> {
        let start_time = std::time::Instant::now();

        // 检查条件是否满足
        if let Some(condition) = &hook.condition {
            if condition.enabled && !self.evaluate_condition(&condition.condition, context)? {
                debug!("Hook condition not met, skipping execution");
                return Ok(HookExecutionResult {
                    success: true,
                    output: "Skipped: condition not met".to_string(),
                    error: None,
                    execution_time_ms: 0,
                    hook_command: hook.command.clone(),
                });
            }
        }

        // 准备执行环境
        let context_json = serde_json::to_string(context).map_err(|e| e.to_string())?;

        // 执行命令
        let mut retry_count = 0;
        let max_retries = hook.retry.unwrap_or(0);

        loop {
            let mut cmd = Command::new("bash");
            cmd.arg("-c")
                .arg(&hook.command)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .env("HOOK_CONTEXT", &context_json)
                .env("HOOK_EVENT", &context.event)
                .env("SESSION_ID", &context.session_id)
                .env("PROJECT_PATH", &context.project_path);

            // 设置超时
            let timeout_duration = tokio::time::Duration::from_secs(hook.timeout.unwrap_or(30));

            // 生成进程并设置超时
            let child = cmd.spawn().map_err(|e| format!("Failed to spawn hook process: {}", e))?;

            let result = tokio::time::timeout(timeout_duration, child.wait_with_output())
                .await
                .map_err(|_| "Hook execution timeout".to_string())?
                .map_err(|e| format!("Hook execution failed: {}", e))?;

            let execution_time = start_time.elapsed().as_millis() as u64;

            if result.status.success() {
                let output = String::from_utf8_lossy(&result.stdout).to_string();

                // 执行成功后的钩子
                if let Some(on_success_commands) = &hook.on_success {
                    for cmd in on_success_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            } else {
                // 失败处理
                let error_output = String::from_utf8_lossy(&result.stderr).to_string();

                if retry_count < max_retries {
                    warn!("Hook failed, retrying ({}/{})", retry_count + 1, max_retries);
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    continue;
                }

                // 执行失败后的钩子
                if let Some(on_failure_commands) = &hook.on_failure {
                    for cmd in on_failure_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(error_output),
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            }
        }
    }

    /// 执行Hook链
    pub async fn execute_hook_chain(
        &self,
        event: HookEvent,
        context: HookContext,
        hooks: Vec<EnhancedHook>,
    ) -> Result<HookChainResult, String> {
        info!("Executing hook chain for event: {:?}, {} hooks", event, hooks.len());

        let mut results = Vec::new();
        let mut successful = 0;
        let mut failed = 0;
        let mut should_continue = true;

        for (idx, hook) in hooks.iter().enumerate() {
            debug!("Executing hook {}/{}: {}", idx + 1, hooks.len(), hook.command);

            match self.execute_hook(hook, &context).await {
                Ok(result) => {
                    if result.success {
                        successful += 1;
                    } else {
                        failed += 1;
                        // 如果是PreToolUse事件且hook失败，则阻止后续操作
                        if matches!(event, HookEvent::PreToolUse) {
                            should_continue = false;
                            warn!("PreToolUse hook failed, blocking operation");
                        }
                    }
                    results.push(result);
                }
                Err(e) => {
                    error!("Hook execution error: {}", e);
                    failed += 1;
                    results.push(HookExecutionResult {
                        success: false,
                        output: String::new(),
                        error: Some(e),
                        execution_time_ms: 0,
                        hook_command: hook.command.clone(),
                    });
                }
            }
        }

        // 发送执行结果事件
        let _ = self.app.emit(&format!("hook-chain-complete:{}", context.session_id), &results);

        Ok(HookChainResult {
            event: event.as_str().to_string(),
            total_hooks: hooks.len(),
            successful,
            failed,
            results,
            should_continue,
        })
    }

    /// 执行简单命令（用于on_success和on_failure）
    async fn execute_simple_command(
        &self,
        command: &str,
        context: &HookContext,
    ) -> Result<(), String> {
        let mut cmd = Command::new("bash");
        cmd.arg("-c")
            .arg(command)
            .env("SESSION_ID", &context.session_id)
            .env("PROJECT_PATH", &context.project_path);

        let _ = cmd.spawn()
            .map_err(|e| format!("Failed to spawn command: {}", e))?
            .wait()
            .await;

        Ok(())
    }

    /// 评估条件表达式
    fn evaluate_condition(
        &self,
        condition: &str,
        context: &HookContext,
    ) -> Result<bool, String> {
        // 简单的条件评估实现
        // 支持的格式：
        // - "session_id == 'xyz'"
        // - "data.tokens > 100000"
        // - "event == 'OnContextCompact'"

        // 这里使用简单的字符串匹配，未来可以集成更强大的表达式引擎
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").collect();
            if parts.len() == 2 {
                let left = parts[0].trim();
                let right = parts[1].trim().trim_matches(|c| c == '\'' || c == '"');

                match left {
                    "event" => Ok(context.event == right),
                    "session_id" => Ok(context.session_id == right),
                    _ => Ok(false),
                }
            } else {
                Ok(false)
            }
        } else {
            // 默认返回true
            Ok(true)
        }
    }
}

// ============ Hook事件触发器 ============

/// Hook管理器 - 管理hooks的注册和触发，保留用于未来扩展
#[allow(dead_code)]
pub struct HookManager {
    executor: Arc<HookExecutor>,
    registered_hooks: Arc<Mutex<HashMap<String, Vec<EnhancedHook>>>>,
}

#[allow(dead_code)]
impl HookManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            executor: Arc::new(HookExecutor::new(app)),
            registered_hooks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 注册Hook
    pub fn register_hooks(&self, event: HookEvent, hooks: Vec<EnhancedHook>) {
        let mut registered = self.registered_hooks.lock().unwrap();
        registered.insert(event.as_str().to_string(), hooks);
    }

    /// 触发Hook事件
    pub async fn trigger(
        &self,
        event: HookEvent,
        context: HookContext,
    ) -> Result<HookChainResult, String> {
        let hooks = {
            let registered = self.registered_hooks.lock().unwrap();
            registered.get(event.as_str()).cloned().unwrap_or_default()
        };

        if hooks.is_empty() {
            debug!("No hooks registered for event: {:?}", event);
            return Ok(HookChainResult {
                event: event.as_str().to_string(),
                total_hooks: 0,
                successful: 0,
                failed: 0,
                results: vec![],
                should_continue: true,
            });
        }

        self.executor.execute_hook_chain(event, context, hooks).await
    }
}

// ============ Tauri Commands ============

/// 触发Hook事件
#[tauri::command]
pub async fn trigger_hook_event(
    app: AppHandle,
    event: String,
    context: HookContext,
) -> Result<HookChainResult, String> {
    let event_enum = match event.as_str() {
        "OnContextCompact" => HookEvent::OnContextCompact,
        "OnAgentSwitch" => HookEvent::OnAgentSwitch,
        "OnFileChange" => HookEvent::OnFileChange,
        "OnSessionStart" => HookEvent::OnSessionStart,
        "OnSessionEnd" => HookEvent::OnSessionEnd,
        "OnCheckpointCreate" => HookEvent::OnCheckpointCreate,
        "OnCheckpointRestore" => HookEvent::OnCheckpointRestore,
        "OnTabSwitch" => HookEvent::OnTabSwitch,
        _ => return Err(format!("Unknown hook event: {}", event)),
    };

    // 从配置中加载hooks
    let hooks_config = crate::commands::claude::get_hooks_config(
        "project".to_string(),
        Some(context.project_path.clone())
    ).await?;

    let hooks_array = hooks_config
        .get(&event)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<EnhancedHook>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default();

    let executor = HookExecutor::new(app);
    executor.execute_hook_chain(event_enum, context, hooks_array).await
}

/// 测试Hook条件
#[tauri::command]
pub async fn test_hook_condition(
    app: tauri::AppHandle,
    condition: String,
    context: HookContext,
) -> Result<bool, String> {
    let executor = HookExecutor::new(app);
    executor.evaluate_condition(&condition, &context)
}

// ============ 智能化自动化场景实现 ============

/// 提交前代码审查Hook配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreCommitCodeReviewConfig {
    pub enabled: bool,
    pub quality_threshold: f64,        // 最低质量分数阈值 (0.0-10.0)
    pub block_critical_issues: bool,   // 是否阻止严重问题
    pub block_major_issues: bool,      // 是否阻止重要问题
    pub review_scope: String,          // "security", "performance", "all"
    pub exclude_patterns: Vec<String>, // 排除的文件模式
    pub max_files_to_review: usize,    // 最大审查文件数量
    pub show_suggestions: bool,        // 是否显示改进建议
}

impl Default for PreCommitCodeReviewConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            quality_threshold: 6.0,
            block_critical_issues: true,
            block_major_issues: false,
            review_scope: "all".to_string(),
            exclude_patterns: vec![
                "node_modules/**".to_string(),
                "dist/**".to_string(),
                "build/**".to_string(),
                "target/**".to_string(),
                "*.min.js".to_string(),
                "*.bundle.js".to_string(),
                ".git/**".to_string(),
            ],
            max_files_to_review: 20,
            show_suggestions: true,
        }
    }
}

/// 提交前代码审查Hook - 智能化自动化场景的具体实现
pub struct PreCommitCodeReviewHook {
    config: PreCommitCodeReviewConfig,
    _app: AppHandle, // 保留用于未来扩展，如通知用户等
}

impl PreCommitCodeReviewHook {
    pub fn new(app: AppHandle, config: PreCommitCodeReviewConfig) -> Self {
        Self { config, _app: app }
    }

    /// 执行提交前代码审查
    pub async fn execute(&self, project_path: &str, db: &State<'_, crate::commands::agents::AgentDb>) -> Result<CommitDecision, String> {
        info!("🔍 开始执行提交前代码审查 - 项目路径: {}", project_path);

        if !self.config.enabled {
            debug!("提交前代码审查已禁用，允许提交");
            return Ok(CommitDecision::Allow {
                message: "代码审查已禁用".to_string(),
                suggestions: vec![],
            });
        }

        // 1. 获取git staged文件
        let staged_files = self.get_staged_files(project_path).await?;

        if staged_files.is_empty() {
            info!("没有staged文件，允许提交");
            return Ok(CommitDecision::Allow {
                message: "没有代码变更需要审查".to_string(),
                suggestions: vec![],
            });
        }

        info!("发现{}个staged文件", staged_files.len());

        // 2. 过滤需要审查的文件
        let files_to_review = self.filter_files_for_review(&staged_files)?;

        if files_to_review.is_empty() {
            info!("没有需要审查的代码文件，允许提交");
            return Ok(CommitDecision::Allow {
                message: "没有需要审查的代码文件".to_string(),
                suggestions: vec![],
            });
        }

        info!("需要审查{}个文件", files_to_review.len());

        // 3. 执行代码审查
        let review_result = self.perform_code_review(&files_to_review, db).await?;

        // 4. 基于审查结果做出决策
        let decision = self.make_commit_decision(&review_result)?;

        info!("代码审查完成 - 决策: {:?}", decision);
        Ok(decision)
    }

    /// 获取git staged文件列表
    async fn get_staged_files(&self, project_path: &str) -> Result<Vec<String>, String> {
        let output = std::process::Command::new("git")
            .arg("diff")
            .arg("--cached")
            .arg("--name-only")
            .current_dir(project_path)
            .output()
            .map_err(|e| format!("获取staged文件失败: {}", e))?;

        if !output.status.success() {
            return Err(format!("git命令执行失败: {}", String::from_utf8_lossy(&output.stderr)));
        }

        let files = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|line| {
                let file_path = line.trim();
                if file_path.starts_with('/') {
                    file_path.to_string()
                } else {
                    format!("{}/{}", project_path, file_path)
                }
            })
            .filter(|f| !f.is_empty())
            .collect();

        Ok(files)
    }

    /// 过滤需要审查的文件
    fn filter_files_for_review(&self, files: &[String]) -> Result<Vec<String>, String> {
        let mut filtered_files = Vec::new();

        for file in files {
            // 检查文件是否存在
            if !std::path::Path::new(file).exists() {
                debug!("跳过不存在的文件: {}", file);
                continue;
            }

            // 检查排除模式
            let mut should_exclude = false;
            for pattern in &self.config.exclude_patterns {
                if self.matches_pattern(file, pattern) {
                    debug!("根据模式 '{}' 排除文件: {}", pattern, file);
                    should_exclude = true;
                    break;
                }
            }

            if should_exclude {
                continue;
            }

            // 检查文件扩展名 - 只审查代码文件
            if self.is_code_file(file) {
                filtered_files.push(file.clone());
            } else {
                debug!("跳过非代码文件: {}", file);
            }

            // 限制文件数量
            if filtered_files.len() >= self.config.max_files_to_review {
                warn!("达到最大审查文件数量限制: {}", self.config.max_files_to_review);
                break;
            }
        }

        Ok(filtered_files)
    }

    /// 检查文件是否匹配模式
    fn matches_pattern(&self, file: &str, pattern: &str) -> bool {
        // 简单的glob模式匹配
        if pattern.contains("**") {
            let prefix = pattern.split("**").next().unwrap_or("");
            return file.contains(prefix);
        }

        if pattern.contains("*") {
            let parts: Vec<&str> = pattern.split('*').collect();
            if parts.len() == 2 {
                return file.starts_with(parts[0]) && file.ends_with(parts[1]);
            }
        }

        file.contains(pattern)
    }

    /// 检查是否为代码文件
    fn is_code_file(&self, file: &str) -> bool {
        let code_extensions = [
            ".js", ".jsx", ".ts", ".tsx", ".py", ".rs", ".go", ".java", ".c", ".cpp",
            ".h", ".hpp", ".cs", ".php", ".rb", ".swift", ".kt", ".scala", ".clj",
            ".sql", ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".scss",
        ];

        code_extensions.iter().any(|ext| file.to_lowercase().ends_with(ext))
    }

    /// 执行代码审查
    async fn perform_code_review(&self, files: &[String], db: &State<'_, crate::commands::agents::AgentDb>) -> Result<crate::commands::subagents::CodeReviewResult, String> {
        info!("正在审查{}个文件，范围: {}", files.len(), self.config.review_scope);

        // 直接调用code-reviewer专业化Agent
        crate::commands::subagents::execute_code_review(
            db.clone(),
            files.to_vec(),
            Some(self.config.review_scope.clone())
        ).await
    }

    /// 基于审查结果做出提交决策
    fn make_commit_decision(&self, review_result: &crate::commands::subagents::CodeReviewResult) -> Result<CommitDecision, String> {
        let critical_issues = review_result.issues.iter()
            .filter(|issue| issue.severity == "critical")
            .count();

        let major_issues = review_result.issues.iter()
            .filter(|issue| issue.severity == "major")
            .count();

        // 决策逻辑
        if self.config.block_critical_issues && critical_issues > 0 {
            return Ok(CommitDecision::Block {
                reason: format!("发现{}个严重安全问题，必须修复后才能提交", critical_issues),
                details: review_result.clone(),
                suggestions: self.generate_fix_suggestions(review_result),
            });
        }

        if self.config.block_major_issues && major_issues > 0 {
            return Ok(CommitDecision::Block {
                reason: format!("发现{}个重要问题，建议修复后再提交", major_issues),
                details: review_result.clone(),
                suggestions: self.generate_fix_suggestions(review_result),
            });
        }

        if review_result.overall_score < self.config.quality_threshold {
            return Ok(CommitDecision::Block {
                reason: format!("代码质量评分 {:.1} 低于阈值 {:.1}",
                    review_result.overall_score, self.config.quality_threshold),
                details: review_result.clone(),
                suggestions: self.generate_fix_suggestions(review_result),
            });
        }

        // 允许提交，但可能带有警告
        let message = if review_result.overall_score >= 8.0 {
            format!("🎉 代码质量优秀 (评分: {:.1}/10.0)！", review_result.overall_score)
        } else {
            format!("✅ 代码审查通过 (评分: {:.1}/10.0)", review_result.overall_score)
        };

        let suggestions = if self.config.show_suggestions && review_result.overall_score < 9.0 {
            self.generate_improvement_suggestions(review_result)
        } else {
            vec![]
        };

        Ok(CommitDecision::Allow { message, suggestions })
    }

    /// 生成修复建议
    fn generate_fix_suggestions(&self, review_result: &crate::commands::subagents::CodeReviewResult) -> Vec<String> {
        let mut suggestions = Vec::new();

        // 添加通用建议
        suggestions.extend(review_result.recommendations.clone());

        // 添加基于问题类型的具体建议
        let critical_count = review_result.issues.iter().filter(|i| i.severity == "critical").count();
        let security_count = review_result.issues.iter().filter(|i| i.category == "security").count();

        if critical_count > 0 {
            suggestions.push("🚨 建议运行安全扫描工具进行深度检查".to_string());
        }

        if security_count > 0 {
            suggestions.push("🔒 建议查阅OWASP安全指南".to_string());
            suggestions.push("🛡️ 考虑增加安全测试用例".to_string());
        }

        suggestions
    }

    /// 生成改进建议
    fn generate_improvement_suggestions(&self, review_result: &crate::commands::subagents::CodeReviewResult) -> Vec<String> {
        let mut suggestions = Vec::new();

        if review_result.overall_score < 8.0 {
            suggestions.push("💡 建议提交后进行代码重构优化".to_string());
        }

        let style_issues = review_result.issues.iter().filter(|i| i.category == "style").count();
        if style_issues > 0 {
            suggestions.push("🎨 建议配置代码格式化工具".to_string());
        }

        suggestions
    }
}

/// 提交决策结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommitDecision {
    Allow {
        message: String,
        suggestions: Vec<String>,
    },
    Block {
        reason: String,
        details: crate::commands::subagents::CodeReviewResult,
        suggestions: Vec<String>,
    },
}

/// 执行提交前代码审查Hook
#[tauri::command]
pub async fn execute_pre_commit_review(
    app: tauri::AppHandle,
    db: State<'_, crate::commands::agents::AgentDb>,
    project_path: String,
    config: Option<PreCommitCodeReviewConfig>,
) -> Result<CommitDecision, String> {
    let hook_config = config.unwrap_or_default();
    let hook = PreCommitCodeReviewHook::new(app, hook_config);
    hook.execute(&project_path, &db).await
}