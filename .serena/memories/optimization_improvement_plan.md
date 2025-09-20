# Claude Code 集成优化改进方案

## 总体优化目标
1. **安全性增强**: 实现细粒度权限控制，移除unsafe的权限跳过
2. **配置灵活性**: 支持动态参数配置和用户自定义选项
3. **错误处理完善**: 实现结构化错误处理和更好的用户反馈
4. **性能可靠性**: 增加超时控制、重试机制和资源限制

## 分阶段实施计划

### 第一阶段：安全性改进（高优先级）

#### 1.1 权限管理系统重构
**目标**: 移除`--dangerously-skip-permissions`，实现细粒度权限控制

**实现方案**:
```rust
// 新增权限配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudePermissionConfig {
    pub allowed_tools: Vec<String>,
    pub disallowed_tools: Vec<String>,
    pub permission_mode: PermissionMode,
    pub auto_approve_edits: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PermissionMode {
    Interactive,        // 需要用户确认
    AcceptEdits,       // 自动接受编辑
    ReadOnly,          // 只读模式
}
```

**配置界面设计**:
- 在Settings中新增"Claude权限"标签页
- 提供预设权限模板（开发模式、安全模式、自定义模式）
- 实时权限状态显示

#### 1.2 工具权限细分
```rust
// 预定义工具权限组
pub const DEVELOPMENT_TOOLS: &[&str] = &["Bash", "Read", "Write", "Edit"];
pub const SAFE_TOOLS: &[&str] = &["Read", "Search"];
pub const ALL_TOOLS: &[&str] = &["Bash", "Read", "Write", "Edit", "WebFetch", "Task"];

// 权限检查函数
fn build_permission_args(config: &ClaudePermissionConfig) -> Vec<String> {
    let mut args = Vec::new();
    
    if !config.allowed_tools.is_empty() {
        args.push("--allowedTools".to_string());
        args.push(config.allowed_tools.join(","));
    }
    
    if !config.disallowed_tools.is_empty() {
        args.push("--disallowedTools".to_string());
        args.push(config.disallowed_tools.join(","));
    }
    
    args.push("--permission-mode".to_string());
    args.push(config.permission_mode.to_string());
    
    args
}
```

### 第二阶段：参数配置灵活性（中优先级）

#### 2.1 动态参数配置系统
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeExecutionConfig {
    pub output_format: OutputFormat,
    pub timeout_seconds: Option<u32>,
    pub max_tokens: Option<u32>,
    pub verbose: bool,
    pub context_preservation: ContextMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OutputFormat {
    StreamJson,
    Json,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextMode {
    Full,      // 保持完整上下文
    Compact,   // 压缩上下文
    Minimal,   // 最小上下文
}
```

#### 2.2 配置管理接口
```rust
// 新增Tauri命令
#[tauri::command]
pub async fn get_claude_execution_config() -> Result<ClaudeExecutionConfig, String> {
    // 读取执行配置
}

#[tauri::command]
pub async fn update_claude_execution_config(
    config: ClaudeExecutionConfig
) -> Result<(), String> {
    // 更新执行配置
}

#[tauri::command]
pub async fn reset_claude_execution_config() -> Result<(), String> {
    // 重置为默认配置
}
```

### 第三阶段：错误处理和可靠性（中优先级）

#### 3.1 结构化错误处理
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClaudeError {
    ProcessSpawnError { message: String, code: Option<i32> },
    PermissionDenied { tool: String, action: String },
    TimeoutError { timeout_seconds: u32 },
    ConfigurationError { field: String, message: String },
    NetworkError { message: String },
}

impl From<ClaudeError> for String {
    fn from(error: ClaudeError) -> Self {
        match error {
            ClaudeError::ProcessSpawnError { message, code } => {
                format!("进程启动失败: {} (代码: {:?})", message, code)
            },
            ClaudeError::PermissionDenied { tool, action } => {
                format!("权限被拒绝: 工具 '{}' 无法执行 '{}'", tool, action)
            },
            ClaudeError::TimeoutError { timeout_seconds } => {
                format!("操作超时: {}秒后未响应", timeout_seconds)
            },
            // ... 其他错误类型
        }
    }
}
```

#### 3.2 超时和重试机制
```rust
async fn execute_claude_with_timeout(
    cmd: Command,
    timeout_seconds: u32,
) -> Result<Child, ClaudeError> {
    match tokio::time::timeout(
        Duration::from_secs(timeout_seconds as u64),
        cmd.spawn()
    ).await {
        Ok(Ok(child)) => Ok(child),
        Ok(Err(e)) => Err(ClaudeError::ProcessSpawnError { 
            message: e.to_string(), 
            code: None 
        }),
        Err(_) => Err(ClaudeError::TimeoutError { timeout_seconds }),
    }
}
```

### 第四阶段：高级功能增强（低优先级）

#### 4.1 智能上下文管理
```rust
#[derive(Debug, Clone)]
pub struct ContextManager {
    pub max_context_length: usize,
    pub compression_strategy: CompressionStrategy,
    pub priority_preservation: Vec<MessageType>,
}

#[derive(Debug, Clone)]
pub enum CompressionStrategy {
    KeepRecent(usize),     // 保留最近N条消息
    KeepImportant,         // 保留重要消息
    Adaptive,              // 自适应压缩
}
```

#### 4.2 会话恢复增强
```rust
#[tauri::command]
pub async fn resume_claude_with_checkpoint(
    project_path: String,
    session_id: String,
    checkpoint_id: Option<String>,
    prompt: String,
    config: ClaudeExecutionConfig,
) -> Result<(), String> {
    // 支持从特定检查点恢复会话
}
```

## 实施时间线

### 第1-2周：安全性改进
- [ ] 权限配置数据结构设计
- [ ] 权限管理UI组件开发
- [ ] 基础权限检查逻辑实现
- [ ] 安全模式测试

### 第3-4周：配置系统
- [ ] 动态参数配置结构
- [ ] 配置管理界面
- [ ] 配置持久化机制
- [ ] 向后兼容性测试

### 第5-6周：错误处理
- [ ] 结构化错误类型定义
- [ ] 超时和重试机制
- [ ] 用户友好的错误消息
- [ ] 错误恢复机制

### 第7-8周：高级功能
- [ ] 智能上下文管理
- [ ] 高级会话控制
- [ ] 性能监控和分析
- [ ] 全面测试和优化

## 向后兼容性策略
1. **配置迁移**: 自动检测旧配置并提供迁移路径
2. **功能开关**: 新功能默认关闭，用户可选择启用
3. **API保持**: 保持现有Tauri命令接口不变
4. **渐进式升级**: 支持用户按需升级到新权限模式