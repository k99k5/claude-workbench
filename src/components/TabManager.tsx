import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MoreHorizontal, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TabSessionWrapper } from './TabSessionWrapper';
import { useTabs } from '@/hooks/useTabs';
import type { Session } from '@/lib/api';

interface TabManagerProps {
  onBack: () => void;
  onProjectSettings?: (projectPath: string) => void;
  className?: string;
  /**
   * 初始会话信息 - 从 SessionList 跳转时使用
   */
  initialSession?: Session;
  /**
   * 初始项目路径 - 创建新会话时使用
   */
  initialProjectPath?: string;
}

/**
 * TabManager - 多标签页会话管理器
 * 支持多个 Claude Code 会话同时运行，后台保持状态
 */
export const TabManager: React.FC<TabManagerProps> = ({
  onBack,
  onProjectSettings,
  className,
  initialSession,
  initialProjectPath,
}) => {
  const {
    tabs,
    createNewTab,
    switchToTab,
    closeTab,
    updateTabStreamingStatus,
  } = useTabs();

  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 拖拽处理
  const handleTabDragStart = useCallback((tabId: string) => {
    setDraggedTab(tabId);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTab(null);
  }, []);

  // 初始化时创建标签页
  useEffect(() => {
    if (tabs.length === 0) {
      // 如果有初始会话，使用它创建标签页
      if (initialSession) {
        createNewTab(initialSession);
      }
      // 如果有初始项目路径，使用它创建标签页
      else if (initialProjectPath) {
        createNewTab(undefined, initialProjectPath);
      }
      // 否则创建默认标签页
      else {
        createNewTab();
      }
    }
  }, [createNewTab, tabs.length, initialSession, initialProjectPath]);

  return (
    <TooltipProvider>
      <div className={cn("h-full flex flex-col bg-background", className)}>
        {/* 标签页栏 */}
        <div className="flex-shrink-0 border-b bg-muted/20">
          <div className="flex items-center h-12 px-4">
            {/* 返回按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-3 px-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>

            {/* 标签页容器 */}
            <div
              ref={tabsContainerRef}
              className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none"
            >
              <AnimatePresence mode="popLayout">
                {tabs.map((tab) => (
                  <motion.div
                    key={tab.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b-2 min-w-0 max-w-[200px] cursor-pointer",
                      "transition-colors duration-200",
                      tab.isActive
                        ? "bg-background border-primary text-foreground"
                        : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      draggedTab === tab.id && "opacity-50"
                    )}
                    onClick={() => switchToTab(tab.id)}
                    draggable
                    onDragStart={() => handleTabDragStart(tab.id)}
                    onDragEnd={handleTabDragEnd}
                  >
                    {/* 会话状态指示器 */}
                    <div className="flex-shrink-0">
                      {tab.streamingStatus?.isStreaming ? (
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      ) : tab.hasChanges ? (
                        <div className="h-2 w-2 bg-orange-500 rounded-full" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* 标签页标题 */}
                    <span className="flex-1 truncate text-sm font-medium">
                      {tab.title}
                    </span>

                    {/* 关闭按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* 新建标签页按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 h-8 w-8 p-0 ml-1"
                    onClick={() => createNewTab()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>新建会话</TooltipContent>
              </Tooltip>
            </div>

            {/* 标签页菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => createNewTab()}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建会话
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => tabs.forEach(tab => closeTab(tab.id, true))}
                  disabled={tabs.length === 0}
                >
                  关闭所有标签页
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => tabs.filter(tab => !tab.isActive).forEach(tab => closeTab(tab.id, true))}
                  disabled={tabs.length <= 1}
                >
                  关闭其他标签页
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 标签页内容区域 */}
        <div className="flex-1 relative overflow-hidden">
          {/* 渲染所有标签页，通过显示/隐藏控制状态保持 */}
          {tabs.map((tab) => (
            <TabSessionWrapper
              key={tab.id}
              tabId={tab.id}
              session={tab.session}
              initialProjectPath={tab.projectPath}
              isActive={tab.isActive}
              onBack={() => {
                // 如果只有一个标签页，直接返回
                if (tabs.length === 1) {
                  onBack();
                } else {
                  // 否则关闭当前标签页
                  closeTab(tab.id);
                }
              }}
              onProjectSettings={onProjectSettings}
              onStreamingChange={(isStreaming, sessionId) =>
                updateTabStreamingStatus(tab.id, isStreaming, sessionId)
              }
            />
          ))}

          {/* 无标签页时的占位符 */}
          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">暂无会话</p>
                <p className="text-sm">点击"+"按钮创建新的 Claude 会话</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};