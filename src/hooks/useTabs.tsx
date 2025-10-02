import { useState, useCallback, useRef, useContext, createContext, ReactNode, useEffect } from 'react';
import type { Session } from '@/lib/api';

// 🔧 ARCHITECTURE FIX: Remove isActive from interface to eliminate dual state
export interface TabSessionData {
  id: string;
  title: string;
  projectPath?: string;
  session?: Session;
  isLoading: boolean;
  hasChanges: boolean;
  streamingStatus?: {
    isStreaming: boolean;
    sessionId: string | null;
  };
  createdAt: number;
  lastActivityAt: number;
  cleanup?: () => Promise<void> | void;
  // 🔧 NEW: 错误状态支持
  error?: {
    message: string;
    timestamp: number;
    canRetry: boolean;
    operation: string; // 'cleanup' | 'load' | 'save' 等
  };
}

// 🔧 NEW: Computed interface with isActive derived from activeTabId
export interface TabSession extends TabSessionData {
  isActive: boolean; // Computed from activeTabId, not stored
}

interface TabContextValue {
  tabs: TabSession[];
  activeTabId: string | null;
  createNewTab: (session?: Session, projectPath?: string, activate?: boolean) => string;
  switchToTab: (tabId: string) => void;
  // 🔧 IMPROVED: closeTab可以返回确认需求或void
  closeTab: (tabId: string, force?: boolean) => Promise<{ needsConfirmation?: boolean; tabId?: string } | void>;
  updateTabStreamingStatus: (tabId: string, isStreaming: boolean, sessionId: string | null) => void;
  updateTabChanges: (tabId: string, hasChanges: boolean) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  getTabById: (tabId: string) => TabSession | undefined;
  getActiveTab: () => TabSession | undefined;
  openSessionInBackground: (session: Session) => { tabId: string; isNew: boolean };
  getTabStats: () => { total: number; active: number; hasChanges: number };
  registerTabCleanup: (tabId: string, cleanup: () => Promise<void> | void) => void;
  // 🔧 NEW: Separate UI logic from state management
  canCloseTab: (tabId: string) => { canClose: boolean; hasUnsavedChanges: boolean };
  forceCloseTab: (tabId: string) => Promise<void>;
  // 🔧 NEW: 拖拽排序功能
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  // 🔧 NEW: 错误状态管理
  clearTabError: (tabId: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

interface TabProviderProps {
  children: ReactNode;
}

/**
 * TabProvider - 提供全局标签页状态管理
 * 🔧 ARCHITECTURE FIX: Use single source of truth for active state
 * 🔧 NEW: Add state persistence
 */
export const TabProvider: React.FC<TabProviderProps> = ({ children }) => {
  // 🔧 Store raw data without isActive field
  const [tabsData, setTabsData] = useState<TabSessionData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const nextTabId = useRef(1);

  // 🔧 PERFORMANCE: Use Map for O(1) tab lookup
  const tabsMapRef = useRef<Map<string, TabSessionData>>(new Map());

  // Update tabs map when tabsData changes
  useEffect(() => {
    tabsMapRef.current.clear();
    tabsData.forEach(tab => {
      tabsMapRef.current.set(tab.id, tab);
    });
  }, [tabsData]);

  // 🔧 NEW: State persistence
  const STORAGE_KEY = 'claude-workbench-tabs-state';

  // Load persisted state on mount
  useEffect(() => {
    try {
      const persistedState = localStorage.getItem(STORAGE_KEY);
      if (persistedState) {
        const { tabsData: savedTabsData, activeTabId: savedActiveTabId } = JSON.parse(persistedState);

        if (Array.isArray(savedTabsData)) {
          // 🔧 IMPROVED: 验证并过滤无效数据
          const validTabsData = savedTabsData
            .map((tab: any) => {
              // 验证必需字段
              if (!tab.id || typeof tab.id !== 'string') {
                console.warn('[useTabs] Invalid tab: missing or invalid id', tab);
                return null;
              }

              if (!tab.title || typeof tab.title !== 'string') {
                console.warn('[useTabs] Invalid tab: missing or invalid title', tab);
                return null;
              }

              // 验证session结构（如果存在）
              if (tab.session) {
                if (!tab.session.id || !tab.session.project_path) {
                  console.warn('[useTabs] Invalid session data, clearing session:', tab.session);
                  tab.session = undefined; // 清除无效session
                }
              }

              return {
                ...tab,
                cleanup: undefined, // Will be re-registered when components mount
              };
            })
            .filter((tab): tab is TabSessionData => tab !== null);

          // 验证activeTabId是否合法
          const validActiveTabId = validTabsData.find(t => t.id === savedActiveTabId)
            ? savedActiveTabId
            : (validTabsData[0]?.id || null);

          setTabsData(validTabsData);
          setActiveTabId(validActiveTabId);

          console.log(
            '[useTabs] Restored and validated tab state:',
            validTabsData.length,
            'valid tabs from',
            savedTabsData.length,
            'saved tabs'
          );
        }
      }
    } catch (error) {
      console.error('[useTabs] Failed to restore tab state:', error);
      // 🔧 NEW: 清除损坏的localStorage数据
      try {
        localStorage.removeItem(STORAGE_KEY);
        console.warn('[useTabs] Cleared corrupted localStorage data');
      } catch (clearError) {
        console.error('[useTabs] Failed to clear corrupted data:', clearError);
      }
    }
  }, []);

  // Persist state when it changes
  useEffect(() => {
    try {
      const stateToSave = {
        tabsData: tabsData.map(tab => ({ ...tab, cleanup: undefined })), // Don't serialize functions
        activeTabId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[useTabs] Failed to persist tab state:', error);
    }
  }, [tabsData, activeTabId]);

  // 🔧 Compute tabs with isActive derived from activeTabId
  const tabs: TabSession[] = tabsData.map(tabData => ({
    ...tabData,
    isActive: tabData.id === activeTabId,
  }));

  // 生成唯一的标签页ID
  const generateTabId = useCallback(() => {
    return `tab-${Date.now()}-${nextTabId.current++}`;
  }, []);

  // 🔧 IMPROVED: 生成更智能的标签页标题
  const generateTabTitle = useCallback((session?: Session, projectPath?: string) => {
    if (session) {
      // 从会话信息中提取更有意义的标题
      const projectName = session.project_path
        ? (session.project_path.split('/').pop() || session.project_path.split('\\').pop())
        : '';

      // 格式化项目名：移除常见前缀，首字母大写
      const formattedProjectName = projectName
        ? projectName.replace(/^(my-|test-|demo-)/, '').replace(/[-_]/g, ' ')
        : '';

      // 使用更友好的会话标识（时间 + 短ID）
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const shortId = session.id.slice(-4); // 只用最后4位

      if (formattedProjectName) {
        return `${formattedProjectName} (${timeStr})`;
      }
      return `会话 ${timeStr}-${shortId}`;
    }

    if (projectPath) {
      const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop();
      const formattedName = projectName
        ? projectName.replace(/^(my-|test-|demo-)/, '').replace(/[-_]/g, ' ')
        : '';
      return formattedName ? `新会话 · ${formattedName}` : `新会话 ${nextTabId.current}`;
    }

    return `新会话 ${nextTabId.current}`;
  }, []);

  // 创建新标签页
  const createNewTab = useCallback((session?: Session, projectPath?: string, activate: boolean = true): string => {
    const newTabId = generateTabId();
    const newTabData: TabSessionData = {
      id: newTabId,
      title: generateTabTitle(session, projectPath),
      projectPath: projectPath || session?.project_path,
      session,
      isLoading: false,
      hasChanges: false,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    setTabsData(prevTabsData => [...prevTabsData, newTabData]);

    if (activate) {
      setActiveTabId(newTabId);
    }

    return newTabId;
  }, [generateTabId, generateTabTitle]);

  // 切换到指定标签页
  const switchToTab = useCallback((tabId: string) => {
    setTabsData(prevTabsData =>
      prevTabsData.map(tabData =>
        tabData.id === tabId
          ? { ...tabData, lastActivityAt: Date.now() }
          : tabData
      )
    );
    setActiveTabId(tabId);
  }, []);

  // 🔧 NEW: Check if tab can be closed (separate from actual closing)
  const canCloseTab = useCallback((tabId: string) => {
    const tab = tabsData.find(t => t.id === tabId);
    return {
      canClose: !tab?.hasChanges,
      hasUnsavedChanges: Boolean(tab?.hasChanges),
    };
  }, [tabsData]);

  // 🔧 NEW: Force close tab without confirmation
  const forceCloseTab = useCallback(async (tabId: string) => {
    const tab = tabsData.find(t => t.id === tabId);

    // 🔧 IMPROVED: Execute cleanup callback if present（容错处理 + 错误状态记录）
    if (tab?.cleanup) {
      try {
        console.log(`[useTabs] Executing cleanup for tab ${tabId}`);
        await tab.cleanup();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[useTabs] Cleanup failed for tab ${tabId}:`, errorMessage);

        // 🔧 NEW: 记录错误状态（不阻止关闭，但记录错误供UI层显示）
        setTabsData(prev =>
          prev.map(t =>
            t.id === tabId
              ? {
                  ...t,
                  error: {
                    message: `清理资源失败: ${errorMessage}`,
                    timestamp: Date.now(),
                    canRetry: false, // cleanup失败后无法重试，标签页即将关闭
                    operation: 'cleanup',
                  },
                }
              : t
          )
        );
        // 继续关闭标签页，不阻塞流程（延迟1秒让UI有时间显示错误）
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      // 🔧 NEW: cleanup未注册时输出警告（localStorage恢复后可能未注册）
      console.warn(`[useTabs] No cleanup registered for tab ${tabId}, skipping cleanup (may be restored from localStorage)`);
    }

    setTabsData(prevTabsData => {
      const remainingTabsData = prevTabsData.filter(t => t.id !== tabId);

      // 如果关闭的是当前活跃标签页，需要激活另一个标签页
      if (activeTabId === tabId && remainingTabsData.length > 0) {
        const lastActiveTab = remainingTabsData.reduce((latest, current) =>
          current.lastActivityAt > latest.lastActivityAt ? current : latest
        );

        setActiveTabId(lastActiveTab.id);
      } else if (remainingTabsData.length === 0) {
        setActiveTabId(null);
      }

      return remainingTabsData;
    });
  }, [activeTabId, tabsData]);

  // 关闭标签页 (with UI confirmation)
  // 🔧 IMPROVED: 返回确认状态，让UI层处理Dialog
  const closeTab = useCallback(async (tabId: string, force = false): Promise<{ needsConfirmation?: boolean; tabId?: string } | void> => {
    if (force) {
      return forceCloseTab(tabId);
    }

    const { canClose, hasUnsavedChanges } = canCloseTab(tabId);

    if (!canClose && hasUnsavedChanges) {
      // 返回需要确认的标识，由UI层处理Dialog
      return { needsConfirmation: true, tabId };
    }

    return forceCloseTab(tabId);
  }, [canCloseTab, forceCloseTab]);

  // 更新标签页流状态
  const updateTabStreamingStatus = useCallback((tabId: string, isStreaming: boolean, sessionId: string | null) => {
    setTabsData(prevTabsData =>
      prevTabsData.map(tabData =>
        tabData.id === tabId
          ? {
              ...tabData,
              streamingStatus: { isStreaming, sessionId },
              lastActivityAt: Date.now(),
            }
          : tabData
      )
    );
  }, []);

  // 更新标签页变更状态
  const updateTabChanges = useCallback((tabId: string, hasChanges: boolean) => {
    setTabsData(prevTabsData =>
      prevTabsData.map(tabData =>
        tabData.id === tabId ? { ...tabData, hasChanges } : tabData
      )
    );
  }, []);

  // 更新标签页标题
  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabsData(prevTabsData =>
      prevTabsData.map(tabData =>
        tabData.id === tabId ? { ...tabData, title } : tabData
      )
    );
  }, []);

  // 根据ID获取标签页（🔧 PERFORMANCE: O(1) lookup using Map）
  const getTabById = useCallback((tabId: string): TabSession | undefined => {
    const tabData = tabsMapRef.current.get(tabId);
    if (!tabData) return undefined;

    return {
      ...tabData,
      isActive: tabData.id === activeTabId,
    };
  }, [activeTabId]);

  // 获取当前活跃标签页（🔧 PERFORMANCE: Direct lookup instead of array search）
  const getActiveTab = useCallback((): TabSession | undefined => {
    if (!activeTabId) return undefined;
    return getTabById(activeTabId);
  }, [activeTabId, getTabById]);

  // 后台打开会话（不激活）
  const openSessionInBackground = useCallback((session: Session): { tabId: string; isNew: boolean } => {
    // 检查是否已经存在相同会话ID的标签页
    const existingTab = tabs.find(tab => tab.session?.id === session.id);
    if (existingTab) {
      console.log(`[useTabs] Session ${session.id} already exists in tab ${existingTab.id}, skipping creation`);
      return { tabId: existingTab.id, isNew: false };
    }

    const newTabId = createNewTab(session, undefined, false);
    return { tabId: newTabId, isNew: true };
  }, [tabs, createNewTab]);

  // 获取标签页统计信息
  const getTabStats = useCallback(() => {
    return {
      total: tabs.length,
      active: tabs.filter(tab => tab.streamingStatus?.isStreaming).length,
      hasChanges: tabs.filter(tab => tab.hasChanges).length,
    };
  }, [tabs]);

  // 🔧 NEW: Register cleanup callback for a tab
  const registerTabCleanup = useCallback((tabId: string, cleanup: () => Promise<void> | void) => {
    setTabsData(prevTabsData =>
      prevTabsData.map(tabData =>
        tabData.id === tabId ? { ...tabData, cleanup } : tabData
      )
    );
  }, []);

  // 🔧 NEW: 重排序标签页（拖拽功能）
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setTabsData(prevData => {
      const newData = [...prevData];
      const [removed] = newData.splice(fromIndex, 1);
      newData.splice(toIndex, 0, removed);

      console.log(`[useTabs] Reordered tab from index ${fromIndex} to ${toIndex}`);
      return newData;
    });
  }, []);

  // 🔧 NEW: 清除标签页错误状态
  const clearTabError = useCallback((tabId: string) => {
    setTabsData(prev =>
      prev.map(t =>
        t.id === tabId ? { ...t, error: undefined } : t
      )
    );
  }, []);

  const contextValue: TabContextValue = {
    tabs,
    activeTabId,
    createNewTab,
    switchToTab,
    closeTab,
    updateTabStreamingStatus,
    updateTabChanges,
    updateTabTitle,
    getTabById,
    getActiveTab,
    openSessionInBackground,
    getTabStats,
    registerTabCleanup,
    canCloseTab,
    forceCloseTab,
    reorderTabs, // 🔧 NEW: 拖拽排序
    clearTabError, // 🔧 NEW: 错误状态管理
  };

  return (
    <TabContext.Provider value={contextValue}>
      {children}
    </TabContext.Provider>
  );
};

/**
 * useTabs - 使用标签页状态管理
 */
export const useTabs = (): TabContextValue => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
};

/**
 * useActiveTab - 获取当前活跃标签页
 */
export const useActiveTab = (): TabSession | undefined => {
  const { getActiveTab } = useTabs();
  return getActiveTab();
};

/**
 * useTabSession - 获取特定标签页的会话管理钩子
 */
export const useTabSession = (tabId: string) => {
  const { getTabById, updateTabChanges, updateTabStreamingStatus, updateTabTitle, registerTabCleanup } = useTabs();

  const tab = getTabById(tabId);

  const markAsChanged = useCallback(() => {
    updateTabChanges(tabId, true);
  }, [tabId, updateTabChanges]);

  const markAsUnchanged = useCallback(() => {
    updateTabChanges(tabId, false);
  }, [tabId, updateTabChanges]);

  const updateTitle = useCallback((title: string) => {
    updateTabTitle(tabId, title);
  }, [tabId, updateTabTitle]);

  const updateStreaming = useCallback((isStreaming: boolean, sessionId: string | null) => {
    updateTabStreamingStatus(tabId, isStreaming, sessionId);
  }, [tabId, updateTabStreamingStatus]);

  // 🔧 NEW: Register cleanup callback
  const setCleanup = useCallback((cleanup: () => Promise<void> | void) => {
    registerTabCleanup(tabId, cleanup);
  }, [tabId, registerTabCleanup]);

  return {
    tab,
    markAsChanged,
    markAsUnchanged,
    updateTitle,
    updateStreaming,
    setCleanup,
  };
};