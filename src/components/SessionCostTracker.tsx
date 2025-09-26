import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { cn } from '@/lib/utils';

interface SessionMetrics {
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
  duration: number; // in seconds
  averageCostPerMessage: number;
  tokensPerSecond: number;
  model: string;
}

interface CostEvent {
  cost: number;
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  timestamp: string;
}

interface SessionCostTrackerProps {
  /**
   * Session ID for tracking
   */
  sessionId: string;
  /**
   * Whether to show detailed breakdown
   */
  detailed?: boolean;
  /**
   * Auto-hide after inactivity (seconds)
   */
  autoHide?: number;
  /**
   * Position on screen
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Custom className
   */
  className?: string;
}

/**
 * SessionCostTracker component - Advanced session-specific cost tracking
 *
 * Features:
 * - Real-time session cost accumulation
 * - Detailed token usage breakdown
 * - Performance metrics (tokens/second, cost/message)
 * - Interactive cost history timeline
 * - Auto-hide functionality
 * - Draggable positioning
 */
export const SessionCostTracker: React.FC<SessionCostTrackerProps> = ({
  sessionId,
  detailed = true,
  autoHide,
  position = 'bottom-right',
  className
}) => {
  const [metrics, setMetrics] = useState<SessionMetrics>({
    totalCost: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    messageCount: 0,
    duration: 0,
    averageCostPerMessage: 0,
    tokensPerSecond: 0,
    model: ''
  });

  const [costHistory, setCostHistory] = useState<CostEvent[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(detailed);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  const sessionStartTime = useRef<Date>(new Date());
  const hideTimer = useRef<NodeJS.Timeout>();
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Format currency with appropriate precision
  const formatCurrency = (amount: number): string => {
    if (amount < 0.001) {
      return '$0.000';
    } else if (amount < 0.01) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  // Format tokens
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Update session duration
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const duration = (now.getTime() - sessionStartTime.current.getTime()) / 1000;

      setMetrics(prev => ({
        ...prev,
        duration,
        tokensPerSecond: duration > 0 ? prev.totalTokens / duration : 0,
        averageCostPerMessage: prev.messageCount > 0 ? prev.totalCost / prev.messageCount : 0
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set up event listeners for cost tracking
  useEffect(() => {
    const setupListeners = async () => {
      try {
        // Session-specific cost events
        const sessionCostUnlisten = await listen<CostEvent>(`claude-cost-response:${sessionId}`, (event) => {
          const costEvent = event.payload;
          handleCostUpdate(costEvent);
        });

        // Generic cost events for this session
        const genericCostUnlisten = await listen<CostEvent & { sessionId?: string }>('claude-cost-update', (event) => {
          if (event.payload.sessionId === sessionId || !event.payload.sessionId) {
            handleCostUpdate(event.payload);
          }
        });

        // Message events to track message count
        const messageUnlisten = await listen<any>(`claude-output:${sessionId}`, (event) => {
          try {
            const message = JSON.parse(event.payload);
            if (message.type === 'assistant' || message.type === 'user') {
              setMetrics(prev => ({
                ...prev,
                messageCount: prev.messageCount + 1
              }));
            }
          } catch (err) {
            // Ignore parse errors
          }
        });

        unlistenRefs.current = [sessionCostUnlisten, genericCostUnlisten, messageUnlisten];
      } catch (err) {
        console.error('Failed to set up session cost tracker listeners:', err);
      }
    };

    setupListeners();

    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
    };
  }, [sessionId]);

  // Handle cost updates
  const handleCostUpdate = (costEvent: CostEvent) => {
    const now = new Date();
    setLastActivity(now);

    // Add to cost history
    setCostHistory(prev => [...prev.slice(-49), { ...costEvent, timestamp: now.toISOString() }]);

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      totalCost: prev.totalCost + costEvent.cost,
      totalTokens: prev.totalTokens + costEvent.tokens,
      inputTokens: prev.inputTokens + (costEvent.inputTokens || Math.floor(costEvent.tokens * 0.7)),
      outputTokens: prev.outputTokens + (costEvent.outputTokens || Math.floor(costEvent.tokens * 0.3)),
      model: costEvent.model || prev.model
    }));

    // Reset auto-hide timer
    if (autoHide) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setIsVisible(true);
      hideTimer.current = setTimeout(() => setIsVisible(false), autoHide * 1000);
    }
  };

  // Auto-hide logic
  useEffect(() => {
    if (!autoHide) return;

    hideTimer.current = setTimeout(() => setIsVisible(false), autoHide * 1000);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [autoHide]);

  // Position classes
  const getPositionClasses = () => {
    const base = 'fixed z-50';
    switch (position) {
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'bottom-right':
      default:
        return `${base} bottom-4 right-4`;
    }
  };

  if (!isVisible) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsVisible(true)}
        className={cn(
          getPositionClasses(),
          "w-12 h-12 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:shadow-xl transition-shadow",
          className
        )}
      >
        <DollarSign className="h-5 w-5 text-primary-foreground" />
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn(getPositionClasses(), "max-w-sm", className)}
      >
        <Card className="shadow-xl border-2">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                会话成本追踪
              </div>
              <Badge variant="outline" className="text-xs">
                {formatDuration(metrics.duration)}
              </Badge>
            </CardTitle>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.totalCost)}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{formatTokens(metrics.totalTokens)} 令牌</div>
                <div>{metrics.messageCount} 消息</div>
              </div>
            </div>
          </CardHeader>

          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="space-y-4">
                {/* Token Breakdown */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">令牌分布</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>输入</span>
                      <span>{formatTokens(metrics.inputTokens)}</span>
                    </div>
                    <Progress
                      value={(metrics.inputTokens / metrics.totalTokens) * 100}
                      className="h-1"
                    />
                    <div className="flex justify-between text-xs">
                      <span>输出</span>
                      <span>{formatTokens(metrics.outputTokens)}</span>
                    </div>
                    <Progress
                      value={(metrics.outputTokens / metrics.totalTokens) * 100}
                      className="h-1"
                    />
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="font-medium">{metrics.tokensPerSecond.toFixed(1)}</div>
                    <div className="text-muted-foreground">令牌/秒</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="font-medium">{formatCurrency(metrics.averageCostPerMessage)}</div>
                    <div className="text-muted-foreground">成本/消息</div>
                  </div>
                </div>

                {/* Recent Cost History */}
                {costHistory.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">最近活动</div>
                    <div className="h-16 flex items-end gap-1">
                      {costHistory.slice(-10).map((event, index) => {
                        const maxCost = Math.max(...costHistory.map(e => e.cost));
                        const height = maxCost > 0 ? (event.cost / maxCost) * 100 : 0;
                        return (
                          <div
                            key={index}
                            className="flex-1 bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${formatCurrency(event.cost)} - ${new Date(event.timestamp).toLocaleTimeString()}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Model Info */}
                {metrics.model && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">模型</span>
                    <Badge variant="outline" className="text-xs">
                      {metrics.model}
                    </Badge>
                  </div>
                )}

                {/* Last Activity */}
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  最后活动: {lastActivity.toLocaleTimeString()}
                </div>
              </CardContent>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};