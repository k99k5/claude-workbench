import React from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { MessageActions } from "../MessageActions";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "../AgentExecution";

interface UserMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 消息索引 */
  messageIndex?: number;
  /** 会话信息 */
  sessionId?: string | null;
  projectId?: string | null;
  projectPath?: string | null;
  /** 操作回调 */
  onMessageUndo?: (messageIndex: number) => Promise<void>;
  onMessageEdit?: (messageIndex: number, newContent: string) => Promise<void>;
  onMessageDelete?: (messageIndex: number) => Promise<void>;
  onMessageTruncate?: (messageIndex: number) => Promise<void>;
  /** 自定义类名 */
  className?: string;
}

/**
 * 提取用户消息的纯文本内容
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // 如果是字符串，直接返回
  if (typeof content === 'string') return content;
  
  // 如果是数组，提取所有text类型的内容
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');
  }
  
  return '';
};

/**
 * 用户消息组件
 * 右对齐气泡样式，简洁展示
 */
export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  messageIndex,
  sessionId,
  projectId,
  projectPath,
  onMessageUndo,
  onMessageEdit,
  onMessageDelete,
  onMessageTruncate,
  className
}) => {
  const text = extractUserText(message);
  
  // 如果没有文本内容，不渲染
  if (!text) return null;

  return (
    <div className={cn("group relative", className)}>
      <MessageBubble variant="user">
        {/* 消息头部 */}
        <MessageHeader 
          variant="user" 
          timestamp={message.timestamp}
          showAvatar={false}
        />
        
        {/* 消息内容 */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      </MessageBubble>

      {/* 操作按钮（悬停显示） */}
      {messageIndex !== undefined && 
       sessionId && 
       projectId && 
       projectPath && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageActions
            messageIndex={messageIndex}
            messageType="user"
            messageContent={text}
            sessionId={sessionId}
            projectId={projectId}
            projectPath={projectPath}
            onUndo={onMessageUndo}
            onEdit={onMessageEdit}
            onDelete={onMessageDelete}
            onTruncate={onMessageTruncate}
          />
        </div>
      )}
    </div>
  );
};
