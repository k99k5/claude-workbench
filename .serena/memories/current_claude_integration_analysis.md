# 当前Claude CLI集成架构分析

## 核心架构模式

### 1. 进程管理架构
```rust
// 核心进程启动函数
pub async fn execute_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String>

// 进程spawn和管理
async fn spawn_claude_process(
    app: AppHandle, 
    mut cmd: Command, 
    prompt: String, 
    model: String, 
    project_path: String
) -> Result<(), String>
```

### 2. 当前参数配置
```bash
# 基础参数模式
claude "prompt" --model claude-3-sonnet-20240229 --output-format stream-json --verbose --dangerously-skip-permissions

# 继续对话模式
claude -c "prompt" --model model --output-format stream-json --verbose --dangerously-skip-permissions

# 恢复会话模式  
claude --resume session_id "prompt" --model model --output-format stream-json --verbose --dangerously-skip-permissions
```

### 3. 流式输出处理机制
- **输出格式**: `--output-format stream-json` 
- **实时解析**: 逐行解析JSON消息
- **会话ID提取**: 从`type: "system", subtype: "init"`消息中提取session_id
- **进程注册**: 使用提取的session_id注册到ProcessRegistry

### 4. 权限处理
- **当前方式**: `--dangerously-skip-permissions`（跳过所有权限检查）
- **安全风险**: 完全绕过Claude的安全机制

### 5. 错误处理和日志
- **日志级别**: `--verbose`启用详细日志
- **错误处理**: Rust Result<(), String>模式
- **进程监控**: 通过PID跟踪进程状态

## 状态管理架构

### 1. 全局状态
```rust
// Claude进程状态（向后兼容）
ClaudeProcessState::default()

// 进程注册表（新架构）
ProcessRegistryState::default()
```

### 2. 会话管理
- **会话ID生成**: Claude CLI自动生成
- **项目路径编码**: `encode_project_path()` - 单破折号编码
- **会话文件**: `~/.claude/projects/{encoded_path}/{session_id}.jsonl`

### 3. 事件系统
- **通用监听器**: `claude-output`
- **会话特定监听器**: `claude-output:${sessionId}`
- **前端事件处理**: React组件中的内联监听器

## 当前实现的优势
1. **流式体验**: 实时显示Claude响应
2. **会话持久化**: 自动保存对话历史
3. **多会话支持**: 可同时运行多个Claude实例
4. **Windows优化**: 针对Windows进程创建优化

## 当前实现的局限性
1. **权限安全**: 完全跳过权限检查存在安全风险
2. **参数硬编码**: 缺乏灵活的参数配置
3. **错误处理**: 依赖字符串错误，缺乏结构化错误处理
4. **工具权限**: 没有细粒度的工具权限控制
5. **配置管理**: 缺乏运行时配置调整能力