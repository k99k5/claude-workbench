import React, { useRef, useEffect } from 'react';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useTabSession } from '@/hooks/useTabs';
import type { Session } from '@/lib/api';

interface TabSessionWrapperProps {
  tabId: string;
  session?: Session;
  initialProjectPath?: string;
  onBack: () => void;
  onProjectSettings?: (projectPath: string) => void;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  isActive: boolean;
}

/**
 * TabSessionWrapper - 标签页会话包装器
 * 为每个标签页提供独立的会话状态管理和生命周期控制
 */
export const TabSessionWrapper: React.FC<TabSessionWrapperProps> = ({
  tabId,
  session,
  initialProjectPath,
  onBack,
  onProjectSettings,
  onStreamingChange,
  isActive,
}) => {
  const { tab, updateTitle, updateStreaming } = useTabSession(tabId);
  const sessionRef = useRef<{ hasChanges: boolean; sessionId: string | null }>({
    hasChanges: false,
    sessionId: null,
  });

  // 包装 onStreamingChange 以更新标签页状态
  const handleStreamingChange = (isStreaming: boolean, sessionId: string | null) => {
    sessionRef.current.sessionId = sessionId;
    updateStreaming(isStreaming, sessionId);
    onStreamingChange?.(isStreaming, sessionId);

    // 根据流状态自动更新标题
    if (isStreaming && sessionId && tab) {
      const shortSessionId = sessionId.slice(-8);
      if (!tab.title.includes(shortSessionId)) {
        updateTitle(`${tab.title} (${shortSessionId})`);
      }
    }
  };

  // 监听会话变化并标记为已更改
  useEffect(() => {
    // 这里可以监听会话内容变化
    // 暂时注释掉，等待 ClaudeCodeSession 组件支持变更回调
  }, []);

  // 当标签页变为非活跃时，保持会话状态在后台
  useEffect(() => {
    if (!isActive && tab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now in background, preserving state`);
    } else if (isActive && tab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now active`);
    }
  }, [isActive, tabId]); // 移除tab依赖，避免对象引用变化导致的无限循环

  return (
    <div
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%',
      }}
    >
      <ClaudeCodeSession
        session={session}
        initialProjectPath={initialProjectPath}
        onBack={onBack}
        onProjectSettings={onProjectSettings}
        onStreamingChange={handleStreamingChange}
      />
    </div>
  );
};