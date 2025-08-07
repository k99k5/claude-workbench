use std::fmt;
use serde::{Deserialize, Serialize};

/// Router模块统一错误类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RouterError {
    /// 配置错误
    ConfigError(String),
    /// 网络请求错误
    NetworkError(String),
    /// 进程管理错误
    ProcessError(String),
    /// JSON解析错误
    ParseError(String),
    /// IO错误
    IoError(String),
    /// 超时错误
    TimeoutError(String),
    /// 健康检查错误
    HealthError(String),
    /// 路由决策错误
    RoutingError(String),
    /// 未知错误
    Unknown(String),
}

impl fmt::Display for RouterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RouterError::ConfigError(msg) => write!(f, "配置错误: {}", msg),
            RouterError::NetworkError(msg) => write!(f, "网络错误: {}", msg),
            RouterError::ProcessError(msg) => write!(f, "进程错误: {}", msg),
            RouterError::ParseError(msg) => write!(f, "解析错误: {}", msg),
            RouterError::IoError(msg) => write!(f, "IO错误: {}", msg),
            RouterError::TimeoutError(msg) => write!(f, "超时错误: {}", msg),
            RouterError::HealthError(msg) => write!(f, "健康检查错误: {}", msg),
            RouterError::RoutingError(msg) => write!(f, "路由错误: {}", msg),
            RouterError::Unknown(msg) => write!(f, "未知错误: {}", msg),
        }
    }
}

impl std::error::Error for RouterError {}

// 标准错误类型转换
impl From<std::io::Error> for RouterError {
    fn from(error: std::io::Error) -> Self {
        RouterError::IoError(error.to_string())
    }
}

impl From<serde_json::Error> for RouterError {
    fn from(error: serde_json::Error) -> Self {
        RouterError::ParseError(error.to_string())
    }
}

impl From<reqwest::Error> for RouterError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            RouterError::TimeoutError(error.to_string())
        } else {
            RouterError::NetworkError(error.to_string())
        }
    }
}

/// Router模块统一结果类型
pub type RouterResult<T> = Result<T, RouterError>;

/// 错误上下文扩展trait
pub trait RouterErrorExt<T> {
    /// 添加配置错误上下文
    fn config_context(self, msg: &str) -> RouterResult<T>;
    
    /// 添加网络错误上下文  
    fn network_context(self, msg: &str) -> RouterResult<T>;
    
    /// 添加进程错误上下文
    fn process_context(self, msg: &str) -> RouterResult<T>;
}

impl<T, E> RouterErrorExt<T> for Result<T, E> 
where 
    E: std::error::Error + Send + Sync + 'static
{
    fn config_context(self, msg: &str) -> RouterResult<T> {
        self.map_err(|e| RouterError::ConfigError(format!("{}: {}", msg, e)))
    }
    
    fn network_context(self, msg: &str) -> RouterResult<T> {
        self.map_err(|e| RouterError::NetworkError(format!("{}: {}", msg, e)))
    }
    
    fn process_context(self, msg: &str) -> RouterResult<T> {
        self.map_err(|e| RouterError::ProcessError(format!("{}: {}", msg, e)))
    }
}