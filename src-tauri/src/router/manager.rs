use std::process::{Child, Command};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{Duration, interval};
use crate::router::{
    RouterConfig, RouterProxyClient, HealthStatus,
    RouterError, RouterResult, RouterErrorExt
};
use std::path::PathBuf;

/// Router进程管理器
/// 负责claude-code-router进程的启动、停止、监控和自动恢复
pub struct RouterProcessManager {
    /// Router进程实例
    process: Arc<RwLock<Option<Child>>>,
    /// Router配置
    config: Arc<RwLock<RouterConfig>>,
    /// HTTP代理客户端
    proxy_client: Option<RouterProxyClient>,
    /// 健康状态通道
    health_tx: mpsc::Sender<HealthStatus>,
    #[allow(dead_code)]
    health_rx: Arc<RwLock<mpsc::Receiver<HealthStatus>>>,
    /// 是否正在运行
    running: Arc<RwLock<bool>>,
}

impl RouterProcessManager {
    /// 创建新的进程管理器
    pub async fn new(config: RouterConfig) -> RouterResult<Self> {
        let (health_tx, health_rx) = mpsc::channel(32);
        
        let proxy_client = if config.enabled {
            // Always use port 3456 - the default ccr port
            Some(RouterProxyClient::new(
                3456,  // ccr always runs on port 3456
                config.timeout_ms,
                config.max_retries,
            )?)
        } else {
            None
        };
        
        Ok(Self {
            process: Arc::new(RwLock::new(None)),
            config: Arc::new(RwLock::new(config)),
            proxy_client,
            health_tx,
            health_rx: Arc::new(RwLock::new(health_rx)),
            running: Arc::new(RwLock::new(false)),
        })
    }
    
    /// 启动Router服务
    pub async fn start(&self, _router_config_path: &PathBuf) -> RouterResult<()> {
        log::info!("启动claude-code-router服务...");
        
        let config = self.config.read().await;
        if !config.enabled {
            return Err(RouterError::ConfigError("Router未启用".to_string()));
        }
        
        // 检查是否已经运行
        if self.is_running().await {
            log::warn!("Router服务已在运行");
            return Ok(());
        }
        
        // 在Windows上通过cmd执行ccr命令（ccr是.cmd批处理文件）
        // 使用cmd /c来执行批处理文件
        let output = std::process::Command::new("cmd")
            .args(&["/c", "ccr", "start"])
            .output()
            .or_else(|_| {
                // 如果失败，尝试直接执行ccr.cmd
                std::process::Command::new("ccr.cmd")
                    .arg("start")
                    .output()
            })
            .process_context("执行ccr start失败")?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        log::info!("ccr start输出: {}", stdout);
        if !stderr.is_empty() {
            log::info!("ccr start错误输出: {}", stderr);
        }
        
        if !output.status.success() {
            return Err(RouterError::ProcessError(
                format!("ccr start失败: {}", stderr)
            ));
        }
        
        // 等待服务就绪
        self.wait_for_service_ready().await?;
        
        // 更新运行状态
        *self.running.write().await = true;
        
        log::info!("Router服务启动完成");
        Ok(())
    }
    
    /// 停止Router服务
    pub async fn stop(&self) -> RouterResult<()> {
        log::info!("停止claude-code-router服务...");
        
        // 在Windows上通过cmd执行ccr stop命令
        let output = std::process::Command::new("cmd")
            .args(&["/c", "ccr", "stop"])
            .output()
            .process_context("执行ccr stop失败")?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        log::info!("ccr stop输出: {}", stdout);
        if !stderr.is_empty() {
            log::info!("ccr stop错误输出: {}", stderr);
        }
        
        // 更新运行状态
        *self.running.write().await = false;
        
        log::info!("Router服务停止完成");
        Ok(())
    }
    
    /// 重启Router服务
    pub async fn restart(&self, _router_config_path: &PathBuf) -> RouterResult<()> {
        log::info!("重启Router服务...");
        
        // 在Windows上通过cmd执行ccr restart命令
        let output = std::process::Command::new("cmd")
            .args(&["/c", "ccr", "restart"])
            .output()
            .process_context("执行ccr restart失败")?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        log::info!("ccr restart输出: {}", stdout);
        if !stderr.is_empty() {
            log::info!("ccr restart错误输出: {}", stderr);
        }
        
        if !output.status.success() {
            return Err(RouterError::ProcessError(
                format!("ccr restart失败: {}", stderr)
            ));
        }
        
        // 等待服务就绪
        self.wait_for_service_ready().await?;
        
        log::info!("Router服务重启完成");
        Ok(())
    }
    
    /// 检查Router服务是否在运行
    pub async fn is_running(&self) -> bool {
        // 在Windows上通过cmd执行ccr status命令
        if let Ok(output) = std::process::Command::new("cmd")
            .args(&["/c", "ccr", "status"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Check for "Running" status (case-sensitive as shown in user's output)
            stdout.contains("Running") || stdout.contains("running")
        } else {
            false
        }
    }
    
    /// 获取进程PID (已简化，不再管理进程)
    pub async fn get_process_id(&self) -> Option<u32> {
        // Router服务由ccr命令管理，我们不再跟踪进程ID
        None
    }
    
    /// 获取Router代理客户端
    pub fn get_proxy_client(&self) -> Option<&RouterProxyClient> {
        self.proxy_client.as_ref()
    }
    
    /// 更新配置
    #[allow(dead_code)]
    pub async fn update_config(&self, new_config: RouterConfig) -> RouterResult<()> {
        let mut config = self.config.write().await;
        let needs_restart = config.port != new_config.port || 
                           config.enabled != new_config.enabled;
        
        *config = new_config.clone();
        
        if needs_restart && self.is_running().await {
            drop(config); // 释放锁
            log::info!("配置变更需要重启Router进程");
            // 重启逻辑需要在调用方实现，因为需要config_path参数
        }
        
        Ok(())
    }
    
    /// 检测Node.js路径
    fn detect_node_path(&self) -> RouterResult<String> {
        // 尝试多个可能的路径
        let candidates = vec![
            "node",
            "nodejs",
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files (x86)\\nodejs\\node.exe",
        ];
        
        for candidate in candidates {
            if let Ok(output) = Command::new(candidate)
                .args(&["--version"])
                .output()
            {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout);
                    log::info!("找到Node.js: {} (版本: {})", candidate, version.trim());
                    return Ok(candidate.to_string());
                }
            }
        }
        
        Err(RouterError::ProcessError(
            "未找到Node.js，请确保已安装Node.js".to_string()
        ))
    }
    
    /// 获取Router命令路径
    fn get_router_command_path(&self) -> RouterResult<String> {
        // 首先尝试全局安装的claude-code-router命令
        let global_commands = vec![
            "claude-code-router",
            "ccr",
            // Windows特定路径
            "claude-code-router.cmd",
            "ccr.cmd",
        ];
        
        // 检查全局命令
        for cmd in global_commands {
            if let Ok(output) = std::process::Command::new("where")
                .arg(cmd)
                .output() 
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        log::info!("找到全局Router命令: {}", path);
                        return Ok(cmd.to_string()); // 返回命令名，让系统PATH解析
                    }
                }
            }
        }
        
        // 如果找不到全局命令，尝试本地脚本路径
        let app_dir = std::env::current_exe()
            .process_context("获取应用程序路径失败")?
            .parent()
            .ok_or_else(|| RouterError::ProcessError("无效的应用程序路径".to_string()))?
            .to_path_buf();
        
        let local_candidates = vec![
            app_dir.join("resources").join("router").join("index.js"),
            app_dir.join("router").join("index.js"),
            // 开发环境路径
            std::env::current_dir()
                .unwrap_or_default()
                .join("router")
                .join("dist")
                .join("index.js"),
        ];
        
        for candidate in local_candidates {
            if candidate.exists() {
                log::info!("找到本地Router脚本: {:?}", candidate);
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
        
        Err(RouterError::ProcessError(
            "未找到claude-code-router命令或脚本文件，请确保已安装claude-code-router".to_string()
        ))
    }
    
    /// 等待服务就绪
    async fn wait_for_service_ready(&self) -> RouterResult<()> {
        log::info!("等待Router服务就绪...");
        
        for attempt in 1..=30 { // 最多等待30秒
            // 使用ccr status检查服务状态
            if let Ok(output) = std::process::Command::new("cmd")
                .args(&["/c", "ccr", "status"])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // 检查是否包含"Running"状态
                if stdout.contains("Running") || stdout.contains("running") {
                    log::info!("Router服务已就绪");
                    
                    // 从status输出中解析端口信息
                    if let Some(port_line) = stdout.lines().find(|line| line.contains("Port:")) {
                        if let Some(port_str) = port_line.split(':').nth(1) {
                            let port: u16 = port_str.trim().parse().unwrap_or(3456);
                            log::info!("Router服务运行在端口: {}", port);
                            
                            // 更新proxy_client的端口（如果需要的话）
                            // 这里我们已经知道服务在运行，可以直接返回
                        }
                    }
                    
                    return Ok(());
                }
            }
            
            if attempt % 5 == 0 {
                log::debug!("等待服务就绪... (第{}次检查)", attempt);
            }
            
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        
        Err(RouterError::ProcessError(
            "Router服务启动超时".to_string()
        ))
    }
    
    /// 启动健康监控
    async fn start_health_monitor(&self, client: RouterProxyClient) -> RouterResult<()> {
        let health_tx = self.health_tx.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                // 检查是否还在运行
                if !*running.read().await {
                    break;
                }
                
                // 执行健康检查
                let status = match client.health_check().await {
                    Ok(true) => HealthStatus::Healthy,
                    Ok(false) => HealthStatus::Unhealthy("服务响应异常".to_string()),
                    Err(e) => HealthStatus::Unhealthy(format!("健康检查失败: {}", e)),
                };
                
                // 发送健康状态
                if let Err(e) = health_tx.send(status).await {
                    log::error!("发送健康状态失败: {}", e);
                    break;
                }
            }
        });
        
        Ok(())
    }
    
    /// 获取健康状态接收器
    #[allow(dead_code)]
    pub fn get_health_receiver(&self) -> Arc<RwLock<mpsc::Receiver<HealthStatus>>> {
        self.health_rx.clone()
    }
}

impl Drop for RouterProcessManager {
    fn drop(&mut self) {
        // 尝试清理进程
        if let Ok(Some(mut process)) = self.process.try_write().map(|mut p| p.take()) {
            let _ = process.kill();
        }
    }
}