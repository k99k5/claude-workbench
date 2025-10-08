import React from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { MessageContent } from "./MessageContent";
import { ToolCallsGroup } from "./ToolCallsGroup";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "../AgentExecution";

interface AIMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 所有消息（用于工具结果查找） */
  streamMessages?: ClaudeStreamMessage[];
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
  streamMessages = [],
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
          <ToolCallsGroup 
            message={message} 
            streamMessages={streamMessages}
          />
        )}
      </MessageBubble>
    </div>
  );
};
