import { useState, useCallback, useRef, useContext, createContext, ReactNode } from 'react';
import type { Session } from '@/lib/api';

export interface TabSession {
  id: string;
  title: string;
  projectPath?: string;
  session?: Session;
  isActive: boolean;
  isLoading: boolean;
  hasChanges: boolean;
  streamingStatus?: {
    isStreaming: boolean;
    sessionId: string | null;
  };
  createdAt: number;
  lastActivityAt: number;
}

interface TabContextValue {
  tabs: TabSession[];
  activeTabId: string | null;
  createNewTab: (session?: Session, projectPath?: string, activate?: boolean) => string;
  switchToTab: (tabId: string) => void;
  closeTab: (tabId: string, force?: boolean) => void;
  updateTabStreamingStatus: (tabId: string, isStreaming: boolean, sessionId: string | null) => void;
  updateTabChanges: (tabId: string, hasChanges: boolean) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  getTabById: (tabId: string) => TabSession | undefined;
  getActiveTab: () => TabSession | undefined;
  openSessionInBackground: (session: Session) => { tabId: string; isNew: boolean };
  getTabStats: () => { total: number; active: number; hasChanges: number };
}

const TabContext = createContext<TabContextValue | null>(null);

interface TabProviderProps {
  children: ReactNode;
}

/**
 * TabProvider - 提供全局标签页状态管理
 */
export const TabProvider: React.FC<TabProviderProps> = ({ children }) => {
  const [tabs, setTabs] = useState<TabSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const nextTabId = useRef(1);

  // 生成唯一的标签页ID
  const generateTabId = useCallback(() => {
    return `tab-${Date.now()}-${nextTabId.current++}`;
  }, []);

  // 生成标签页标题
  const generateTabTitle = useCallback((session?: Session, projectPath?: string) => {
    if (session) {
      // 从会话信息中提取更有意义的标题
      const sessionName = session.id.slice(-8);
      const projectName = session.project_path
        ? (session.project_path.split('/').pop() || session.project_path.split('\\').pop())
        : '';
      return projectName ? `${projectName} - ${sessionName}` : `会话 ${sessionName}`;
    }
    if (projectPath) {
      const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop();
      return `新会话 - ${projectName}`;
    }
    return `新会话 ${nextTabId.current}`;
  }, []);

  // 创建新标签页
  const createNewTab = useCallback((session?: Session, projectPath?: string, activate: boolean = true): string => {
    const newTabId = generateTabId();
    const newTab: TabSession = {
      id: newTabId,
      title: generateTabTitle(session, projectPath),
      projectPath: projectPath || session?.project_path,
      session,
      isActive: false, // 先设为不活跃，稍后根据 activate 参数决定
      isLoading: false,
      hasChanges: false,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    setTabs(prevTabs => {
      if (activate) {
        // 如果要激活新标签页，将所有现有标签页设为非活跃状态
        const updatedTabs = prevTabs.map(tab => ({ ...tab, isActive: false }));
        return [...updatedTabs, { ...newTab, isActive: true }];
      } else {
        // 后台打开，保持当前活跃标签页不变
        return [...prevTabs, newTab];
      }
    });

    if (activate) {
      setActiveTabId(newTabId);
    }

    return newTabId;
  }, [generateTabId, generateTabTitle]);

  // 切换到指定标签页
  const switchToTab = useCallback((tabId: string) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId,
        lastActivityAt: tab.id === tabId ? Date.now() : tab.lastActivityAt,
      }))
    );
    setActiveTabId(tabId);
  }, []);

  // 关闭标签页
  const closeTab = useCallback((tabId: string, force = false) => {
    setTabs(prevTabs => {
      const tab = prevTabs.find(t => t.id === tabId);

      // 如果标签页有未保存的更改且不是强制关闭，显示确认对话框
      if (!force && tab?.hasChanges) {
        const shouldClose = confirm('此会话有未保存的更改，确定要关闭吗？');
        if (!shouldClose) {
          return prevTabs; // 不关闭，返回原始状态
        }
      }

      const remainingTabs = prevTabs.filter(t => t.id !== tabId);

      // 如果关闭的是当前活跃标签页，需要激活另一个标签页
      if (activeTabId === tabId && remainingTabs.length > 0) {
        const lastActiveTab = remainingTabs.reduce((latest, current) =>
          current.lastActivityAt > latest.lastActivityAt ? current : latest
        );

        // 激活最近使用的标签页
        const updatedTabs = remainingTabs.map(tab => ({
          ...tab,
          isActive: tab.id === lastActiveTab.id,
        }));

        setActiveTabId(lastActiveTab.id);
        return updatedTabs;
      }

      if (remainingTabs.length === 0) {
        setActiveTabId(null);
      }

      return remainingTabs;
    });
  }, [activeTabId]);

  // 更新标签页流状态
  const updateTabStreamingStatus = useCallback((tabId: string, isStreaming: boolean, sessionId: string | null) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              streamingStatus: { isStreaming, sessionId },
              lastActivityAt: Date.now(),
            }
          : tab
      )
    );
  }, []);

  // 更新标签页变更状态
  const updateTabChanges = useCallback((tabId: string, hasChanges: boolean) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, hasChanges } : tab
      )
    );
  }, []);

  // 更新标签页标题
  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, title } : tab
      )
    );
  }, []);

  // 根据ID获取标签页（使用useMemo优化，避免不必要的重新创建）
  const getTabById = useCallback((tabId: string): TabSession | undefined => {
    return tabs.find(tab => tab.id === tabId);
  }, [tabs]);

  // 获取当前活跃标签页
  const getActiveTab = useCallback((): TabSession | undefined => {
    return tabs.find(tab => tab.isActive);
  }, [tabs]);

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
  const { getTabById, updateTabChanges, updateTabStreamingStatus, updateTabTitle } = useTabs();

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

  return {
    tab,
    markAsChanged,
    markAsUnchanged,
    updateTitle,
    updateStreaming,
  };
};