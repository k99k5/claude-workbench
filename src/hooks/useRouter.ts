import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RouterConfig,
  RouterState,
  RouterActions,
  RouterManager,
  RoutingMode,
  HealthStatus,
  ClaudeRequest,
  ClaudeResponse,
  RouterEvent,
  RouterEventListener,
  createRouterManager,
} from '@/lib/router-types';

/**
 * Router Hook 配置选项
 */
export interface UseRouterOptions {
  /** 自动初始化 */
  autoInit?: boolean;
  /** 轮询间隔(毫秒) - 用于状态更新 */
  pollingInterval?: number;
  /** 是否启用轮询 */
  enablePolling?: boolean;
  /** 错误重试次数 */
  maxRetries?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * Router Hook 返回类型
 */
export interface UseRouterReturn extends RouterState, RouterActions {
  /** Router管理器实例 */
  manager: RouterManager;
  /** 发送路由请求 */
  sendRequest: (request: ClaudeRequest) => Promise<ClaudeResponse>;
  /** 添加事件监听器 */
  addEventListener: (listener: RouterEventListener) => () => void;
  /** 获取详细进程信息 */
  getProcessInfo: () => Promise<{
    isRunning: boolean;
    processId: number | null;
    healthStatus: HealthStatus;
    config: RouterConfig;
  }>;
}

/**
 * Router状态管理Hook
 * 
 * @example
 * ```tsx
 * function RouterDashboard() {
 *   const router = useRouter({
 *     autoInit: true,
 *     enablePolling: true,
 *     pollingInterval: 30000, // 30秒轮询
 *   });
 * 
 *   useEffect(() => {
 *     const unsubscribe = router.addEventListener((event) => {
 *       if (event.type === 'status_changed') {
 *         console.log('Router状态变更:', event.status);
 *       }
 *     });
 *     return unsubscribe;
 *   }, []);
 * 
 *   if (router.loading) return <div>加载中...</div>;
 *   if (router.error) return <div>错误: {router.error}</div>;
 * 
 *   return (
 *     <div>
 *       <h2>Router状态: {RouterUtils.formatHealthStatus(router.healthStatus)}</h2>
 *       <button onClick={router.startRouter} disabled={router.isRunning}>
 *         启动Router
 *       </button>
 *       <button onClick={router.stopRouter} disabled={!router.isRunning}>
 *         停止Router
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRouter(options: UseRouterOptions = {}): UseRouterReturn {
  const {
    autoInit = false,
    pollingInterval = 30000,
    enablePolling = false,
    maxRetries = 3,
    debug = false,
  } = options;

  // 状态管理
  const [state, setState] = useState<RouterState>({
    isInitialized: false,
    isRunning: false,
    config: null,
    routingMode: RoutingMode.SmartRouting,
    healthStatus: { type: 'unknown' },
    stats: null,
    availableModels: [],
    activeModel: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  // 管理器实例和事件监听器
  const managerRef = useRef<RouterManager>(createRouterManager(invoke));
  const eventListenersRef = useRef<Set<RouterEventListener>>(new Set());
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  const debugLog = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useRouter] ${message}`, data);
    }
  }, [debug]);

  // 触发事件
  const dispatchEvent = useCallback((event: RouterEvent) => {
    debugLog('触发事件', event);
    eventListenersRef.current.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Router事件监听器错误:', error);
      }
    });
  }, [debugLog]);

  // 更新状态的通用方法
  const updateState = useCallback((updates: Partial<RouterState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
      lastUpdated: new Date(),
    }));
  }, []);

  // 错误处理
  const handleError = useCallback((error: string | Error, context?: string) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const fullError = context ? `${context}: ${errorMessage}` : errorMessage;
    
    debugLog('处理错误', { error: fullError, context });
    updateState({ error: fullError, loading: false });
    dispatchEvent({ type: 'error', error: fullError });
  }, [updateState, dispatchEvent, debugLog]);

  // 异步操作的包装器，包含错误处理和重试逻辑
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    showLoading = true
  ): Promise<T | null> => {
    try {
      if (showLoading) {
        updateState({ loading: true, error: null });
      }

      const result = await operation();
      
      if (showLoading) {
        updateState({ loading: false });
      }
      
      retryCountRef.current = 0;
      return result;
    } catch (error) {
      debugLog(`操作失败: ${context}`, error);
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        debugLog(`重试 ${retryCountRef.current}/${maxRetries}`);
        // 延迟重试
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return withErrorHandling(operation, context, false);
      } else {
        retryCountRef.current = 0;
        handleError(error instanceof Error ? error : new Error(String(error)), context);
        return null;
      }
    }
  }, [updateState, handleError, debugLog, maxRetries]);

  // 初始化Router
  const initialize = useCallback(async () => {
    debugLog('初始化Router');
    
    const result = await withErrorHandling(async () => {
      // 初始化Router模块
      await managerRef.current.init();
      
      // 初始化管理器
      await managerRef.current.initManager();
      
      // 获取初始配置
      const config = await managerRef.current.getConfig();
      const routingMode = await managerRef.current.getRoutingMode();
      const isRunning = await managerRef.current.isRunning();
      
      return { config, routingMode, isRunning };
    }, '初始化Router');

    if (result) {
      updateState({
        isInitialized: true,
        config: result.config,
        routingMode: result.routingMode,
        isRunning: result.isRunning,
      });
      debugLog('Router初始化完成', result);
    }
  }, [withErrorHandling, updateState, debugLog]);

  // 更新配置
  const updateConfig = useCallback(async (config: RouterConfig) => {
    debugLog('更新Router配置', config);
    
    await withErrorHandling(async () => {
      await managerRef.current.updateConfig(config);
      updateState({ config });
      dispatchEvent({ type: 'config_updated', config });
    }, '更新配置');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 设置路由模式
  const setRoutingMode = useCallback(async (mode: RoutingMode) => {
    debugLog('设置路由模式', mode);
    
    await withErrorHandling(async () => {
      await managerRef.current.setRoutingMode(mode);
      updateState({ routingMode: mode });
    }, '设置路由模式');
  }, [withErrorHandling, updateState, debugLog]);

  // 启动Router
  const startRouter = useCallback(async () => {
    debugLog('启动Router');
    
    await withErrorHandling(async () => {
      await managerRef.current.startProcess();
      const isRunning = await managerRef.current.isRunning();
      updateState({ isRunning, healthStatus: { type: 'starting' } });
      
      // 等待一段时间后检查健康状态
      setTimeout(async () => {
        const healthCheck = await managerRef.current.healthCheck();
        const healthStatus: HealthStatus = healthCheck ? { type: 'healthy' } : { type: 'unhealthy', message: '健康检查失败' };
        updateState({ healthStatus });
        dispatchEvent({ type: 'status_changed', status: healthStatus });
      }, 3000);
    }, '启动Router');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 停止Router
  const stopRouter = useCallback(async () => {
    debugLog('停止Router');
    
    await withErrorHandling(async () => {
      updateState({ healthStatus: { type: 'stopping' } });
      await managerRef.current.stopProcess();
      const isRunning = await managerRef.current.isRunning();
      const healthStatus: HealthStatus = { type: 'unknown' };
      updateState({ isRunning, healthStatus });
      dispatchEvent({ type: 'status_changed', status: healthStatus });
    }, '停止Router');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 重启Router
  const restartRouter = useCallback(async () => {
    debugLog('重启Router');
    
    await withErrorHandling(async () => {
      updateState({ healthStatus: { type: 'starting' } });
      await managerRef.current.restartProcess();
      
      setTimeout(async () => {
        const isRunning = await managerRef.current.isRunning();
        const healthCheck = await managerRef.current.healthCheck();
        const healthStatus: HealthStatus = healthCheck ? { type: 'healthy' } : { type: 'unhealthy', message: '重启后健康检查失败' };
        
        updateState({ isRunning, healthStatus });
        dispatchEvent({ type: 'status_changed', status: healthStatus });
      }, 3000);
    }, '重启Router');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 刷新可用模型
  const refreshModels = useCallback(async () => {
    debugLog('刷新可用模型');
    
    await withErrorHandling(async () => {
      const availableModels = await managerRef.current.getAvailableModels();
      const activeModel = await managerRef.current.getActiveModel();
      updateState({ availableModels, activeModel });
    }, '刷新可用模型');
  }, [withErrorHandling, updateState, debugLog]);

  // 切换模型
  const switchToModel = useCallback(async (provider: string, model: string) => {
    debugLog('切换模型', { provider, model });
    
    await withErrorHandling(async () => {
      await managerRef.current.switchModel(provider, model);
      const activeModel = await managerRef.current.getActiveModel();
      updateState({ activeModel });
      dispatchEvent({ type: 'model_switched', provider, model });
    }, '切换模型');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 刷新统计信息
  const refreshStats = useCallback(async () => {
    await withErrorHandling(async () => {
      const stats = await managerRef.current.getStats();
      updateState({ stats });
      dispatchEvent({ type: 'stats_updated', stats });
    }, '刷新统计信息', false); // 不显示loading，避免频繁闪烁
  }, [withErrorHandling, updateState, dispatchEvent]);

  // 执行健康检查
  const performHealthCheck = useCallback(async () => {
    await withErrorHandling(async () => {
      const healthCheck = await managerRef.current.healthCheck();
      const healthStatus: HealthStatus = healthCheck ? { type: 'healthy' } : { type: 'unhealthy', message: '健康检查失败' };
      updateState({ healthStatus });
      dispatchEvent({ type: 'status_changed', status: healthStatus });
    }, '健康检查', false);
  }, [withErrorHandling, updateState, dispatchEvent]);

  // 与Workbench同步配置
  const syncWithWorkbench = useCallback(async () => {
    debugLog('与Workbench同步配置');
    
    await withErrorHandling(async () => {
      await managerRef.current.syncFromWorkbench();
      // 重新获取配置
      const config = await managerRef.current.getConfig();
      updateState({ config });
      dispatchEvent({ type: 'config_updated', config });
    }, '与Workbench同步配置');
  }, [withErrorHandling, updateState, dispatchEvent, debugLog]);

  // 发送路由请求
  const sendRequest = useCallback(async (request: ClaudeRequest): Promise<ClaudeResponse> => {
    debugLog('发送路由请求', request);
    
    const response = await withErrorHandling(async () => {
      return await managerRef.current.routeClaudeRequest(request);
    }, '发送路由请求');

    if (!response) {
      throw new Error('路由请求失败');
    }

    return response;
  }, [withErrorHandling, debugLog]);

  // 获取详细进程信息
  const getProcessInfo = useCallback(async () => {
    const [isRunning, processId, config] = await Promise.all([
      managerRef.current.isRunning(),
      managerRef.current.getProcessId(),
      managerRef.current.getConfig(),
    ]);

    return {
      isRunning,
      processId,
      healthStatus: state.healthStatus,
      config,
    };
  }, [state.healthStatus]);

  // 添加事件监听器
  const addEventListener = useCallback((listener: RouterEventListener) => {
    eventListenersRef.current.add(listener);
    debugLog('添加事件监听器', { count: eventListenersRef.current.size });
    
    return () => {
      eventListenersRef.current.delete(listener);
      debugLog('移除事件监听器', { count: eventListenersRef.current.size });
    };
  }, [debugLog]);

  // 清理资源
  const cleanup = useCallback(() => {
    debugLog('清理Router资源');
    
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    
    eventListenersRef.current.clear();
  }, [debugLog]);

  // 轮询逻辑
  useEffect(() => {
    if (!enablePolling || !state.isInitialized) return;

    debugLog('开始轮询', { interval: pollingInterval });
    
    pollingTimerRef.current = setInterval(async () => {
      try {
        await Promise.all([
          performHealthCheck(),
          refreshStats(),
        ]);
      } catch (error) {
        debugLog('轮询过程中出错', error);
      }
    }, pollingInterval);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [enablePolling, state.isInitialized, pollingInterval, performHealthCheck, refreshStats, debugLog]);

  // 自动初始化
  useEffect(() => {
    if (autoInit) {
      initialize();
    }
  }, [autoInit, initialize]);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    manager: managerRef.current,
    
    // Actions
    initialize,
    updateConfig,
    setRoutingMode,
    startRouter,
    stopRouter,
    restartRouter,
    refreshModels,
    switchToModel,
    refreshStats,
    performHealthCheck,
    syncWithWorkbench,
    cleanup,
    
    // Additional methods
    sendRequest,
    addEventListener,
    getProcessInfo,
  };
}

/**
 * Router状态提供者组件 (可选，用于全局状态管理)
 */
export { useRouter as default };