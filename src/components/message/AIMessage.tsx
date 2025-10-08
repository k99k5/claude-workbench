import React from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { MessageContent } from "./MessageContent";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "../AgentExecution";

interface AIMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 链接检测回调 */
  onLinkDetected?: (url: string) => void;
}

/**
 * 提取AI消息的文本内容
 */
const extractAIText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // 如果是字符串，直接返回
  if (typeof content === 'string') return content;
  
  // 如果是数组，提取所有text类型的内容
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n\n');
  }
  
  return '';
};

/**
 * 检测消息中是否有工具调用
 */
const hasToolCalls = (message: ClaudeStreamMessage): boolean => {
  if (!message.message?.content) return false;
  
  const content = message.message.content;
  if (!Array.isArray(content)) return false;
  
  return content.some((item: any) => 
    item.type === 'tool_use' || item.type === 'tool_result'
  );
};

/**
 * AI消息组件
 * 左对齐卡片样式，支持工具调用展示
 */
export const AIMessage: React.FC<AIMessageProps> = ({
  message,
  isStreaming = false,
  className
}) => {
  const text = extractAIText(message);
  const hasTools = hasToolCalls(message);

  // 如果既没有文本又没有工具调用，不渲染
  if (!text && !hasTools) return null;

  return (
    <div className={cn("relative", className)}>
      <MessageBubble variant="assistant" isStreaming={isStreaming}>
        {/* 消息头部 */}
        <div className="px-4 pt-3 pb-2">
          <MessageHeader 
            variant="assistant" 
            timestamp={message.timestamp}
            showAvatar={true}
          />
        </div>

        {/* 消息内容 */}
        {text && (
          <div className="px-4 pb-3">
            <MessageContent 
              content={text} 
              isStreaming={isStreaming && !hasTools}
            />
          </div>
        )}

        {/* 工具调用区域 */}
        {hasTools && (
          <div className="border-t border-border bg-muted/30 px-4 py-3">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              工具调用
            </div>
            {/* 这里将在 Phase 2 替换为 ToolCallsGroup 组件 */}
            <div className="text-sm text-muted-foreground">
              [工具调用详情将在 Phase 2 重构]
            </div>
          </div>
        )}
      </MessageBubble>
    </div>
  );
};
