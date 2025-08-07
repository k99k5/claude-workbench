use std::time::{Duration, Instant};
use tokio::time::interval;
use tokio::sync::{mpsc, RwLock};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::router::{RouterProxyClient, RouterResult};

/// 健康状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    /// 健康状态
    Healthy,
    /// 不健康状态，包含错误信息
    Unhealthy(String),
    /// 未知状态(初始化或连接中断)
    Unknown,
    /// 服务正在启动
    Starting,
    /// 服务正在停止
    Stopping,
}

impl HealthStatus {
    /// 是否为健康状态
    #[allow(dead_code)]
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }
    
    /// 获取状态显示名称
    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            HealthStatus::Healthy => "正常",
            HealthStatus::Unhealthy(_) => "异常",
            HealthStatus::Unknown => "未知",
            HealthStatus::Starting => "启动中",
            HealthStatus::Stopping => "停止中",
        }
    }
}

/// 健康检查记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthRecord {
    /// 检查时间
    pub timestamp: DateTime<Utc>,
    /// 健康状态
    pub status: HealthStatus,
    /// 响应时间(毫秒)
    pub response_time_ms: Option<u64>,
    /// 错误信息
    pub error_message: Option<String>,
}

/// 健康监控器配置
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct HealthMonitorConfig {
    /// 检查间隔(秒)
    pub check_interval_secs: u64,
    /// 历史记录保存数量
    pub history_limit: usize,
    /// 连续失败阈值
    pub failure_threshold: u8,
    /// 自动重启阈值
    pub auto_restart_threshold: u8,
}

impl Default for HealthMonitorConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 30,
            history_limit: 100,
            failure_threshold: 3,
            auto_restart_threshold: 5,
        }
    }
}

/// 健康监控统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStats {
    /// 总检查次数
    pub total_checks: u64,
    /// 健康检查次数
    pub healthy_checks: u64,
    /// 不健康检查次数
    pub unhealthy_checks: u64,
    /// 平均响应时间(毫秒)
    pub average_response_time: f64,
    /// 连续失败次数
    pub consecutive_failures: u8,
    /// 可用性百分比
    pub availability_percentage: f64,
    /// 监控开始时间
    pub monitoring_start_time: DateTime<Utc>,
    /// 最后检查时间
    pub last_check_time: Option<DateTime<Utc>>,
}

impl Default for HealthStats {
    fn default() -> Self {
        Self {
            total_checks: 0,
            healthy_checks: 0,
            unhealthy_checks: 0,
            average_response_time: 0.0,
            consecutive_failures: 0,
            availability_percentage: 0.0,
            monitoring_start_time: Utc::now(),
            last_check_time: None,
        }
    }
}

/// Router健康监控器
/// 负责定期检查Router服务健康状态，记录历史数据，并提供状态通知
#[allow(dead_code)]
pub struct HealthMonitor {
    /// 代理客户端
    client: RouterProxyClient,
    /// 监控配置
    config: HealthMonitorConfig,
    /// 当前健康状态
    current_status: Arc<RwLock<HealthStatus>>,
    /// 历史记录
    history: Arc<RwLock<Vec<HealthRecord>>>,
    /// 统计信息
    stats: Arc<RwLock<HealthStats>>,
    /// 状态通知发送器
    status_tx: mpsc::Sender<HealthStatus>,
    /// 是否正在运行
    running: Arc<RwLock<bool>>,
}

#[allow(dead_code)]
impl HealthMonitor {
    /// 创建新的健康监控器
    pub fn new(
        client: RouterProxyClient,
        config: Option<HealthMonitorConfig>,
    ) -> (Self, mpsc::Receiver<HealthStatus>) {
        let (status_tx, status_rx) = mpsc::channel(32);
        
        (
            Self {
                client,
                config: config.unwrap_or_default(),
                current_status: Arc::new(RwLock::new(HealthStatus::Unknown)),
                history: Arc::new(RwLock::new(Vec::new())),
                stats: Arc::new(RwLock::new(HealthStats::default())),
                status_tx,
                running: Arc::new(RwLock::new(false)),
            },
            status_rx,
        )
    }
    
    /// 开始健康监控
    pub async fn start_monitoring(&self) -> RouterResult<()> {
        if *self.running.read().await {
            log::warn!("健康监控器已在运行");
            return Ok(());
        }
        
        *self.running.write().await = true;
        log::info!("启动Router健康监控，检查间隔: {}秒", self.config.check_interval_secs);
        
        // 重置统计信息
        *self.stats.write().await = HealthStats::default();
        
        // 启动监控循环
        let client = self.client.clone();
        let config = self.config.clone();
        let current_status = self.current_status.clone();
        let history = self.history.clone();
        let stats = self.stats.clone();
        let status_tx = self.status_tx.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let mut interval_timer = interval(Duration::from_secs(config.check_interval_secs));
            
            while *running.read().await {
                interval_timer.tick().await;
                
                // 执行健康检查
                let check_result = Self::perform_health_check(&client).await;
                let record = HealthRecord {
                    timestamp: Utc::now(),
                    status: check_result.status.clone(),
                    response_time_ms: check_result.response_time_ms,
                    error_message: check_result.error_message.clone(),
                };
                
                // 更新当前状态
                *current_status.write().await = check_result.status.clone();
                
                // 添加到历史记录
                {
                    let mut history_lock = history.write().await;
                    history_lock.push(record.clone());
                    
                    // 保持历史记录在限制范围内
                    let history_len = history_lock.len();
                    if history_len > config.history_limit {
                        let drain_count = history_len - config.history_limit;
                        history_lock.drain(..drain_count);
                    }
                }
                
                // 更新统计信息
                Self::update_stats(&mut *stats.write().await, &record).await;
                
                // 发送状态通知
                if let Err(e) = status_tx.send(check_result.status).await {
                    log::error!("发送健康状态通知失败: {}", e);
                    break;
                }
                
                // 检查是否需要自动操作
                Self::check_auto_actions(&*stats.read().await, &config).await;
            }
            
            log::info!("健康监控器已停止");
        });
        
        Ok(())
    }
    
    /// 停止健康监控
    pub async fn stop_monitoring(&self) {
        *self.running.write().await = false;
        log::info!("停止Router健康监控");
    }
    
    /// 获取当前健康状态
    pub async fn get_current_status(&self) -> HealthStatus {
        self.current_status.read().await.clone()
    }
    
    /// 获取历史记录
    pub async fn get_history(&self, limit: Option<usize>) -> Vec<HealthRecord> {
        let history = self.history.read().await;
        let limit = limit.unwrap_or(history.len());
        
        if history.len() <= limit {
            history.clone()
        } else {
            history[history.len() - limit..].to_vec()
        }
    }
    
    /// 获取统计信息
    pub async fn get_stats(&self) -> HealthStats {
        self.stats.read().await.clone()
    }
    
    /// 手动执行健康检查
    pub async fn manual_check(&self) -> RouterResult<HealthRecord> {
        let check_result = Self::perform_health_check(&self.client).await;
        let record = HealthRecord {
            timestamp: Utc::now(),
            status: check_result.status.clone(),
            response_time_ms: check_result.response_time_ms,
            error_message: check_result.error_message.clone(),
        };
        
        // 更新当前状态
        *self.current_status.write().await = check_result.status.clone();
        
        // 添加到历史记录
        {
            let mut history_lock = self.history.write().await;
            history_lock.push(record.clone());
            
            let history_len = history_lock.len();
            if history_len > self.config.history_limit {
                let drain_count = history_len - self.config.history_limit;
                history_lock.drain(..drain_count);
            }
        }
        
        // 更新统计信息
        Self::update_stats(&mut *self.stats.write().await, &record).await;
        
        Ok(record)
    }
    
    /// 清除历史记录
    pub async fn clear_history(&self) {
        self.history.write().await.clear();
        log::info!("已清除健康检查历史记录");
    }
    
    /// 重置统计信息
    pub async fn reset_stats(&self) {
        *self.stats.write().await = HealthStats::default();
        log::info!("已重置健康监控统计信息");
    }
    
    /// 执行健康检查的内部方法
    async fn perform_health_check(client: &RouterProxyClient) -> HealthCheckResult {
        let start_time = Instant::now();
        
        match client.health_check().await {
            Ok(true) => HealthCheckResult {
                status: HealthStatus::Healthy,
                response_time_ms: Some(start_time.elapsed().as_millis() as u64),
                error_message: None,
            },
            Ok(false) => HealthCheckResult {
                status: HealthStatus::Unhealthy("服务响应不健康".to_string()),
                response_time_ms: Some(start_time.elapsed().as_millis() as u64),
                error_message: Some("健康检查返回false".to_string()),
            },
            Err(e) => HealthCheckResult {
                status: HealthStatus::Unhealthy(format!("健康检查失败: {}", e)),
                response_time_ms: None,
                error_message: Some(e.to_string()),
            },
        }
    }
    
    /// 更新统计信息
    async fn update_stats(stats: &mut HealthStats, record: &HealthRecord) {
        stats.total_checks += 1;
        stats.last_check_time = Some(record.timestamp);
        
        match &record.status {
            HealthStatus::Healthy => {
                stats.healthy_checks += 1;
                stats.consecutive_failures = 0;
                
                // 更新平均响应时间
                if let Some(response_time) = record.response_time_ms {
                    let total_response_time = stats.average_response_time * (stats.healthy_checks - 1) as f64;
                    stats.average_response_time = (total_response_time + response_time as f64) / stats.healthy_checks as f64;
                }
            },
            HealthStatus::Unhealthy(_) => {
                stats.unhealthy_checks += 1;
                stats.consecutive_failures += 1;
            },
            _ => {}
        }
        
        // 计算可用性百分比
        if stats.total_checks > 0 {
            stats.availability_percentage = (stats.healthy_checks as f64 / stats.total_checks as f64) * 100.0;
        }
    }
    
    /// 检查自动操作
    async fn check_auto_actions(stats: &HealthStats, config: &HealthMonitorConfig) {
        if stats.consecutive_failures >= config.failure_threshold {
            log::warn!(
                "连续健康检查失败 {} 次，已达到失败阈值 {}",
                stats.consecutive_failures,
                config.failure_threshold
            );
        }
        
        if stats.consecutive_failures >= config.auto_restart_threshold {
            log::error!(
                "连续健康检查失败 {} 次，已达到自动重启阈值 {}，建议重启Router服务",
                stats.consecutive_failures,
                config.auto_restart_threshold
            );
        }
    }
}

/// 健康检查结果
#[allow(dead_code)]
struct HealthCheckResult {
    status: HealthStatus,
    response_time_ms: Option<u64>,
    error_message: Option<String>,
}

impl Drop for HealthMonitor {
    fn drop(&mut self) {
        // 确保监控停止
        if let Ok(running) = self.running.try_read() {
            if *running {
                log::warn!("HealthMonitor被销毁但监控仍在运行，建议显式调用stop_monitoring");
            }
        }
    }
}