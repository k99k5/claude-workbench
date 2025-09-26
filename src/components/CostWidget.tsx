import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Hash, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { cn } from '@/lib/utils';

interface CostData {
  sessionCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  timestamp: string;
}

interface CostWidgetProps {
  /**
   * Session ID for tracking session-specific costs
   */
  sessionId?: string;
  /**
   * Whether to show real-time updates
   */
  realTime?: boolean;
  /**
   * Compact display mode
   */
  compact?: boolean;
  /**
   * Position in the UI ('header' | 'sidebar' | 'floating')
   */
  position?: 'header' | 'sidebar' | 'floating';
  /**
   * Custom className for styling
   */
  className?: string;
  /**
   * Initial cost data
   */
  initialData?: CostData;
}

/**
 * CostWidget component - Compact cost display for integration into session views
 *
 * Features:
 * - Real-time cost updates via Tauri events
 * - Compact display for header/sidebar integration
 * - Session-specific cost tracking
 * - Hover tooltips with detailed breakdown
 * - Responsive design for different positions
 */
export const CostWidget: React.FC<CostWidgetProps> = ({
  sessionId,
  realTime = false,
  compact = false,
  position = 'header',
  className,
  initialData
}) => {
  const [costData, setCostData] = useState<CostData>(initialData || {
    sessionCost: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    model: '',
    timestamp: new Date().toISOString()
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Format currency with smart precision
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

  // Format tokens with K/M suffixes
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  // Set up real-time cost event listeners
  useEffect(() => {
    if (!realTime || !sessionId) return;

    const unlistenRefs: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        // Listen for session-specific cost events
        const sessionCostUnlisten = await listen<{
          cost: number;
          tokens: number;
          inputTokens: number;
          outputTokens: number;
          model: string;
        }>(`claude-cost-response:${sessionId}`, (event) => {
          const { cost, tokens, inputTokens, outputTokens, model } = event.payload;

          setIsUpdating(true);
          setCostData(prev => ({
            sessionCost: prev.sessionCost + cost,
            totalTokens: prev.totalTokens + tokens,
            inputTokens: prev.inputTokens + (inputTokens || Math.floor(tokens * 0.7)),
            outputTokens: prev.outputTokens + (outputTokens || Math.floor(tokens * 0.3)),
            model: model || prev.model,
            timestamp: new Date().toISOString()
          }));
          setLastUpdate(new Date());

          // Reset updating indicator after animation
          setTimeout(() => setIsUpdating(false), 1000);
        });

        // Listen for generic cost events
        const genericCostUnlisten = await listen<{
          cost: number;
          tokens: number;
          model: string;
          sessionId?: string;
        }>('claude-cost-update', (event) => {
          // Only update if it's for our session or no session specified
          if (event.payload.sessionId && event.payload.sessionId !== sessionId) return;

          const { cost, tokens, model } = event.payload;

          setIsUpdating(true);
          setCostData(prev => ({
            sessionCost: prev.sessionCost + cost,
            totalTokens: prev.totalTokens + tokens,
            inputTokens: prev.inputTokens + Math.floor(tokens * 0.7), // Estimate split
            outputTokens: prev.outputTokens + Math.floor(tokens * 0.3),
            model: model || prev.model,
            timestamp: new Date().toISOString()
          }));
          setLastUpdate(new Date());

          setTimeout(() => setIsUpdating(false), 1000);
        });

        unlistenRefs.push(sessionCostUnlisten, genericCostUnlisten);
      } catch (err) {
        console.error('Failed to set up cost widget listeners:', err);
      }
    };

    setupListeners();

    return () => {
      unlistenRefs.forEach(unlisten => unlisten());
    };
  }, [realTime, sessionId]);

  // Get display variant based on position and compact mode
  const getDisplayVariant = () => {
    if (compact || position === 'header') {
      return 'minimal';
    } else if (position === 'sidebar') {
      return 'sidebar';
    } else if (position === 'floating') {
      return 'floating';
    }
    return 'default';
  };

  const variant = getDisplayVariant();

  // Minimal variant for header integration
  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: isUpdating ? 1.05 : 1,
                backgroundColor: isUpdating ? 'rgb(34, 197, 94, 0.1)' : 'transparent'
              }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card text-card-foreground",
                isUpdating && "ring-2 ring-green-500/20",
                className
              )}
            >
              <DollarSign className={cn(
                "h-3 w-3",
                isUpdating ? "text-green-600" : "text-muted-foreground"
              )} />
              <span className="text-sm font-mono font-medium">
                {formatCurrency(costData.sessionCost)}
              </span>
              {realTime && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isUpdating ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
              )}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="font-semibold">会话成本详情</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>总成本: {formatCurrency(costData.sessionCost)}</div>
                <div>总令牌: {formatTokens(costData.totalTokens)}</div>
                <div>输入: {formatTokens(costData.inputTokens)}</div>
                <div>输出: {formatTokens(costData.outputTokens)}</div>
              </div>
              {costData.model && (
                <div className="text-xs text-muted-foreground">模型: {costData.model}</div>
              )}
              {lastUpdate && (
                <div className="text-xs text-muted-foreground">
                  最后更新: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Sidebar variant for detailed side panel
  if (variant === 'sidebar') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn("space-y-3", className)}
      >
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              会话成本
            </h3>
            {realTime && (
              <Badge variant="outline" className="text-xs">
                <div className={cn(
                  "w-2 h-2 rounded-full mr-1",
                  isUpdating ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
                实时
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(costData.sessionCost)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">输入令牌</div>
                <div className="font-mono">{formatTokens(costData.inputTokens)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">输出令牌</div>
                <div className="font-mono">{formatTokens(costData.outputTokens)}</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              总令牌: {formatTokens(costData.totalTokens)}
            </div>

            {costData.model && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {costData.model}
                </Badge>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  // Floating variant for overlay display
  if (variant === 'floating') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{
          opacity: 1,
          scale: isUpdating ? 1.05 : 1,
          y: 0,
          boxShadow: isUpdating ? '0 0 20px rgba(34, 197, 94, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-lg font-bold">{formatCurrency(costData.sessionCost)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span>{formatTokens(costData.totalTokens)}</span>
          </div>

          {realTime && (
            <div className="flex items-center gap-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isUpdating ? "bg-green-500 animate-pulse" : "bg-gray-400"
              )} />
              <span className="text-xs">实时</span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Default variant for standalone use
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            成本监控
          </h3>
          {realTime && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <div className={cn(
                "w-2 h-2 rounded-full mr-2",
                isUpdating ? "bg-green-500 animate-pulse" : "bg-green-400"
              )} />
              实时监控
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatCurrency(costData.sessionCost)}
            </div>
            <div className="text-sm text-muted-foreground">会话总成本</div>
          </div>

          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {formatTokens(costData.totalTokens)}
            </div>
            <div className="text-sm text-muted-foreground">总令牌数</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold">{formatTokens(costData.inputTokens)}</div>
            <div className="text-xs text-muted-foreground">输入令牌</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{formatTokens(costData.outputTokens)}</div>
            <div className="text-xs text-muted-foreground">输出令牌</div>
          </div>
        </div>

        {costData.model && (
          <div className="flex items-center justify-center mt-4 pt-4 border-t">
            <Badge variant="outline">{costData.model}</Badge>
          </div>
        )}

        {lastUpdate && (
          <div className="text-center text-xs text-muted-foreground mt-2">
            最后更新: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </Card>
    </motion.div>
  );
};