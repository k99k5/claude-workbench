import React, { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClaudeStreamMessage } from "../AgentExecution";

interface ToolCallsGroupProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 所有消息（用于查找对应的结果） */
  streamMessages: ClaudeStreamMessage[];
  /** 自定义类名 */
  className?: string;
}

/**
 * 工具调用分组组件
 * 默认折叠显示摘要，点击展开查看详情
 */
export const ToolCallsGroup: React.FC<ToolCallsGroupProps> = ({
  message,
  streamMessages,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 提取工具调用
  const toolCalls = React.useMemo(() => {
    if (!message.message?.content || !Array.isArray(message.message.content)) {
      return [];
    }
    return message.message.content.filter((item: any) => item.type === 'tool_use');
  }, [message]);

  // 提取工具结果
  const toolResults = React.useMemo(() => {
    const results = new Map<string, any>();
    
    // 在当前消息中查找结果
    if (message.message?.content && Array.isArray(message.message.content)) {
      message.message.content
        .filter((item: any) => item.type === 'tool_result')
        .forEach((result: any) => {
          if (result.tool_use_id) {
            results.set(result.tool_use_id, result);
          }
        });
    }
    
    // 在后续消息中查找结果
    const messageIndex = streamMessages.findIndex(m => m === message);
    if (messageIndex !== -1) {
      for (let i = messageIndex + 1; i < streamMessages.length; i++) {
        const nextMsg = streamMessages[i];
        if (nextMsg.type === 'user' && nextMsg.message?.content) {
          const content = Array.isArray(nextMsg.message.content) 
            ? nextMsg.message.content 
            : [];
          
          content
            .filter((item: any) => item.type === 'tool_result')
            .forEach((result: any) => {
              if (result.tool_use_id) {
                results.set(result.tool_use_id, result);
              }
            });
        }
      }
    }
    
    return results;
  }, [message, streamMessages]);

  // 获取工具状态
  const getToolStatus = (toolId: string | undefined) => {
    if (!toolId) return 'pending';
    const result = toolResults.get(toolId);
    if (!result) return 'pending';
    return result.is_error ? 'error' : 'success';
  };

  // 统计状态
  const stats = React.useMemo(() => {
    const total = toolCalls.length;
    let success = 0;
    let error = 0;
    let pending = 0;

    toolCalls.forEach((tool: any) => {
      const status = getToolStatus(tool.id);
      if (status === 'success') success++;
      else if (status === 'error') error++;
      else pending++;
    });

    return { total, success, error, pending };
  }, [toolCalls, toolResults]);

  if (toolCalls.length === 0) return null;

  return (
    <div className={cn("border-t border-border bg-muted/30", className)}>
      {/* 摘要头部（始终显示） */}
      <div className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-start hover:bg-muted/50 -ml-2"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 mr-2" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-2" />
          )}
          
          <Settings className="h-4 w-4 mr-2 text-blue-500" />
          
          <span className="font-medium text-sm">
            工具调用 ({stats.total})
          </span>

          {/* 状态徽章 */}
          <div className="flex items-center gap-2 ml-auto">
            {stats.success > 0 && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {stats.success}
              </Badge>
            )}
            {stats.error > 0 && (
              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.error}
              </Badge>
            )}
            {stats.pending > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {stats.pending}
              </Badge>
            )}
          </div>
        </Button>

        {/* 简要列表（折叠时显示） */}
        {!isExpanded && (
          <div className="mt-2 ml-8 space-y-1">
            {toolCalls.slice(0, 3).map((tool: any, idx: number) => {
              const status = getToolStatus(tool.id);
              const StatusIcon = status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : Loader2;
              const statusColor = status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-blue-600';
              
              return (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusIcon className={cn("h-3 w-3", statusColor, status === 'pending' && 'animate-spin')} />
                  <span className="font-mono">{tool.name || 'unknown'}</span>
                  {tool.input?.path && (
                    <span className="text-muted-foreground/60">: {tool.input.path}</span>
                  )}
                </div>
              );
            })}
            {toolCalls.length > 3 && (
              <div className="text-xs text-muted-foreground ml-5">
                还有 {toolCalls.length - 3} 个工具...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 详细内容（展开时显示） */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {toolCalls.map((tool: any, idx: number) => {
            const status = getToolStatus(tool.id);
            const result = tool.id ? toolResults.get(tool.id) : null;
            const StatusIcon = status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : Loader2;
            const statusColor = status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-blue-600';

            return (
              <div
                key={idx}
                className={cn(
                  "rounded-lg border p-3 bg-background/50",
                  status === 'success' && 'border-green-500/20',
                  status === 'error' && 'border-red-500/20',
                  status === 'pending' && 'border-blue-500/20'
                )}
              >
                {/* 工具头部 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={cn("h-4 w-4", statusColor, status === 'pending' && 'animate-spin')} />
                    <span className="font-mono text-sm font-medium">{tool.name || 'unknown'}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {status === 'success' ? '成功' : status === 'error' ? '失败' : '运行中'}
                  </Badge>
                </div>

                {/* 工具输入 */}
                {tool.input && (
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">输入参数：</div>
                    <div className="rounded bg-muted/50 p-2 text-xs font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 工具输出 */}
                {result && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {result.is_error ? '错误信息：' : '输出结果：'}
                    </div>
                    <div className={cn(
                      "rounded p-2 text-xs font-mono overflow-x-auto",
                      result.is_error ? 'bg-red-500/10' : 'bg-muted/50'
                    )}>
                      <pre className="whitespace-pre-wrap">
                        {typeof result.content === 'string' 
                          ? result.content 
                          : JSON.stringify(result.content, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
