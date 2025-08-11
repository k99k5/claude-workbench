use reqwest::{Client, Response};
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use crate::router::{
    AIModel, ClaudeRequest, ClaudeResponse, RouterStats,
    RouterError, RouterResult, RouterErrorExt
};

/// HTTP代理客户端，用于与claude-code-router进程通信
#[derive(Debug, Clone)]
pub struct RouterProxyClient {
    /// HTTP客户端
    client: Client,
    /// Router服务基础URL
    base_url: String,
    /// 请求超时时间
    #[allow(dead_code)]
    timeout_duration: Duration,
    /// 最大重试次数
    max_retries: u8,
}

impl RouterProxyClient {
    /// 创建新的代理客户端
    pub fn new(port: u16, timeout_ms: u64, max_retries: u8) -> RouterResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_millis(timeout_ms))
            .build()
            .network_context("创建HTTP客户端失败")?;
        
        // Use 127.0.0.1 explicitly for better compatibility
        Ok(Self {
            client,
            base_url: format!("http://127.0.0.1:{}", port),
            timeout_duration: Duration::from_millis(timeout_ms),
            max_retries,
        })
    }
    
    /// 检查Router服务是否健康
    pub async fn health_check(&self) -> RouterResult<bool> {
        let url = format!("{}/health", self.base_url);
        
        match timeout(Duration::from_secs(5), self.client.get(&url).send()).await {
            Ok(Ok(response)) => Ok(response.status().is_success()),
            Ok(Err(_)) => Ok(false),
            Err(_) => Ok(false), // 超时
        }
    }
    
    /// 路由Claude请求到最优提供商
    pub async fn route_claude_request(
        &self,
        request: ClaudeRequest,
    ) -> RouterResult<ClaudeResponse> {
        let start_time = Instant::now();
        
        // 构建请求URL
        let url = format!("{}/claude", self.base_url);
        
        // 准备请求负载
        let payload = json!({
            "prompt": request.prompt,
            "sessionId": request.session_id,
            "projectPath": request.project_path,
            "modelPreference": request.model_preference,
            "maxTokens": request.max_tokens,
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        
        log::debug!("发送Router请求到: {}", url);
        log::debug!("请求负载: {}", serde_json::to_string_pretty(&payload).unwrap_or_default());
        
        // 发送请求并重试
        let response = self.send_with_retry(&url, payload).await?;
        
        // 解析响应
        let claude_response: ClaudeResponse = response
            .json()
            .await
            .network_context("解析Router响应失败")?;
        
        let elapsed = start_time.elapsed();
        log::info!(
            "Router请求完成，耗时: {}ms, 使用模型: {} ({})", 
            elapsed.as_millis(),
            claude_response.model_used,
            claude_response.provider
        );
        
        Ok(claude_response)
    }
    
    /// 获取可用的AI模型列表
    #[allow(dead_code)]
    pub async fn get_available_models(&self) -> RouterResult<Vec<AIModel>> {
        let url = format!("{}/models", self.base_url);
        
        log::debug!("获取可用模型: {}", url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .network_context("获取模型列表请求失败")?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(
                format!("获取模型列表失败, 状态码: {}", response.status())
            ));
        }
        
        let models: Vec<AIModel> = response
            .json()
            .await
            .network_context("解析模型列表响应失败")?;
            
        log::info!("获取到 {} 个可用模型", models.len());
        Ok(models)
    }
    
    /// 手动切换到指定的模型
    pub async fn switch_model(&self, provider: &str, model: &str) -> RouterResult<()> {
        let url = format!("{}/switch-model", self.base_url);
        let payload = json!({
            "provider": provider,
            "model": model,
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        
        log::info!("切换模型: {} -> {}", provider, model);
        
        let response = self.client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .network_context("模型切换请求失败")?;
            
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(RouterError::NetworkError(
                format!("模型切换失败: {}", error_text)
            ));
        }
        
        log::info!("模型切换成功: {} -> {}", provider, model);
        Ok(())
    }
    
    /// 获取路由统计信息
    pub async fn get_router_stats(&self) -> RouterResult<RouterStats> {
        let url = format!("{}/stats", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .network_context("获取统计信息请求失败")?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(
                format!("获取统计信息失败, 状态码: {}", response.status())
            ));
        }
        
        let stats: RouterStats = response
            .json()
            .await
            .network_context("解析统计信息响应失败")?;
            
        Ok(stats)
    }
    
    /// 重置路由统计信息
    pub async fn reset_router_stats(&self) -> RouterResult<()> {
        let url = format!("{}/stats/reset", self.base_url);
        
        let response = self.client
            .post(&url)
            .send()
            .await
            .network_context("重置统计信息请求失败")?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(
                format!("重置统计信息失败, 状态码: {}", response.status())
            ));
        }
        
        log::info!("路由统计信息已重置");
        Ok(())
    }
    
    /// 获取当前活跃的提供商和模型
    #[allow(dead_code)]
    pub async fn get_active_model(&self) -> RouterResult<(String, String)> {
        let url = format!("{}/active-model", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .network_context("获取活跃模型请求失败")?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(
                format!("获取活跃模型失败, 状态码: {}", response.status())
            ));
        }
        
        let active_info: serde_json::Value = response
            .json()
            .await
            .network_context("解析活跃模型响应失败")?;
            
        let provider = active_info["provider"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
        let model = active_info["model"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
            
        Ok((provider, model))
    }
    
    /// 更新路由配置
    #[allow(dead_code)]
    pub async fn update_routing_config(&self, config_data: serde_json::Value) -> RouterResult<()> {
        let url = format!("{}/config/update", self.base_url);
        
        log::debug!("更新Router配置");
        
        let response = self.client
            .post(&url)
            .json(&config_data)
            .send()
            .await
            .network_context("更新配置请求失败")?;
            
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(RouterError::NetworkError(
                format!("更新配置失败: {}", error_text)
            ));
        }
        
        log::info!("Router配置更新成功");
        Ok(())
    }
    
    /// 发送带重试机制的HTTP请求
    async fn send_with_retry(
        &self,
        url: &str,
        payload: serde_json::Value,
    ) -> RouterResult<Response> {
        let mut last_error = None;
        
        for attempt in 1..=self.max_retries {
            match self.client.post(url).json(&payload).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return Ok(response);
                    } else {
                        let status = response.status();
                        let error_text = response.text().await.unwrap_or_default();
                        last_error = Some(RouterError::NetworkError(
                            format!("HTTP {}: {}", status, error_text)
                        ));
                    }
                }
                Err(e) => {
                    last_error = Some(e.into());
                }
            }
            
            if attempt < self.max_retries {
                let delay = Duration::from_millis(1000 * attempt as u64);
                log::warn!("请求失败，{}ms后重试 (第{}/{}次)", delay.as_millis(), attempt, self.max_retries);
                tokio::time::sleep(delay).await;
            }
        }
        
        Err(last_error.unwrap_or_else(|| {
            RouterError::NetworkError("请求失败，未知错误".to_string())
        }))
    }
    
    /// 测试与Router的连接
    pub async fn test_connection(&self) -> RouterResult<String> {
        let start_time = Instant::now();
        
        // 发送ping请求
        let url = format!("{}/ping", self.base_url);
        let response = self.client
            .get(&url)
            .send()
            .await
            .network_context("连接测试失败")?;
            
        let elapsed = start_time.elapsed();
        
        if response.status().is_success() {
            Ok(format!("连接正常，响应时间: {}ms", elapsed.as_millis()))
        } else {
            Err(RouterError::NetworkError(
                format!("连接测试失败，状态码: {}", response.status())
            ))
        }
    }
}