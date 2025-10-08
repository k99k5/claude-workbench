import React from "react";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { StreamMessage as LegacyStreamMessage } from "../StreamMessage";
import type { ClaudeStreamMessage } from "../AgentExecution";

interface StreamMessageV2Props {
  message: ClaudeStreamMessage;
  className?: string;
  streamMessages: ClaudeStreamMessage[];
  onLinkDetected?: (url: string) => void;
  claudeSettings?: { showSystemInitialization?: boolean };
  isStreaming?: boolean;
  // Message operations
  messageIndex?: number;
  sessionId?: string | null;
  projectId?: string | null;
  projectPath?: string | null;
  onMessageUndo?: (messageIndex: number) => Promise<void>;
  onMessageEdit?: (messageIndex: number, newContent: string) => Promise<void>;
  onMessageDelete?: (messageIndex: number) => Promise<void>;
  onMessageTruncate?: (messageIndex: number) => Promise<void>;
}

/**
 * StreamMessage V2 - 重构版消息渲染组件
 * 
 * 使用新的气泡式布局和组件架构
 * Phase 1: 基础消息显示
 * Phase 2: 工具调用折叠（待实现）
 */
export const StreamMessageV2: React.FC<StreamMessageV2Props> = ({
  message,
  className,
  streamMessages,
  onLinkDetected,
  claudeSettings,
  isStreaming = false,
  messageIndex,
  sessionId,
  projectId,
  projectPath,
  onMessageUndo,
  onMessageEdit,
  onMessageDelete,
  onMessageTruncate
}) => {
  // 根据消息类型渲染不同组件
  const messageType = message.type;

  // 对于非用户/assistant消息，使用原有渲染逻辑
  if (messageType !== 'user' && messageType !== 'assistant') {
    return (
      <LegacyStreamMessage
        message={message}
        streamMessages={streamMessages}
        onLinkDetected={onLinkDetected}
        claudeSettings={claudeSettings}
        className={className}
      />
    );
  }

  // 用户消息
  if (messageType === 'user') {
    return (
      <UserMessage
        message={message}
        messageIndex={messageIndex}
        sessionId={sessionId}
        projectId={projectId}
        projectPath={projectPath}
        onMessageUndo={onMessageUndo}
        onMessageEdit={onMessageEdit}
        onMessageDelete={onMessageDelete}
        onMessageTruncate={onMessageTruncate}
        className={className}
      />
    );
  }

  // AI消息
  if (messageType === 'assistant') {
    return (
      <AIMessage
        message={message}
        isStreaming={isStreaming}
        onLinkDetected={onLinkDetected}
        className={className}
      />
    );
  }

  // 其他类型消息使用原有渲染逻辑
  return (
    <LegacyStreamMessage
      message={message}
      streamMessages={streamMessages}
      onLinkDetected={onLinkDetected}
      claudeSettings={claudeSettings}
      className={className}
    />
  );
};
