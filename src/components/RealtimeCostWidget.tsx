import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, Hash, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { tokenExtractor } from '@/lib/tokenExtractor';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from './AgentExecution';

interface RealtimeCostWidgetProps {
  /**
   * Messages array to calculate cost from
   */
  messages: ClaudeStreamMessage[];
  /**
   * Session ID for tracking
   */
  sessionId?: string;
  /**
   * Whether to show in expanded mode by default
   */
  defaultExpanded?: boolean;
  /**
   * Position on screen
   */
  position?: 'top-right' | 'bottom-right' | 'inline';
  /**
   * Custom className
   */
  className?: string;
  /**
   * Whether to show detailed breakdown
   */
  showDetails?: boolean;
}

/**
 * Model pricing based on Claude's pricing (per 1M tokens)
 */
const MODEL_PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.00,  // $3 per 1M input tokens
    output: 15.00, // $15 per 1M output tokens
    cache_write: 3.75, // $3.75 per 1M cache write tokens
    cache_read: 0.30   // $0.30 per 1M cache read tokens
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
    cache_write: 1.00,
    cache_read: 0.08
  },
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00,
    cache_write: 18.75,
    cache_read: 1.50
  },
  'claude-3-sonnet-20240229': {
    input: 3.00,
    output: 15.00,
    cache_write: 3.75,
    cache_read: 0.30
  },
  // Default pricing for unknown models
  'default': {
    input: 3.00,
    output: 15.00,
    cache_write: 3.75,
    cache_read: 0.30
  }
};

/**
 * RealtimeCostWidget - Real-time cost tracking widget
 *
 * Displays live cost calculations based on token usage in the current session
 */
export const RealtimeCostWidget: React.FC<RealtimeCostWidgetProps> = ({
  messages,
  sessionId: _sessionId,
  defaultExpanded = false,
  position = 'bottom-right',
  className,
  showDetails = true
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [totalCost, setTotalCost] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    messageCount: 0,
    efficiency: 0
  });
  const [todayTotal, setTodayTotal] = useState<number | null>(null);

  // Calculate cost from tokens and model
  const calculateCost = (tokens: any, model?: string) => {
    const modelKey = model?.toLowerCase().includes('opus') ? 'claude-3-opus-20240229' :
                     model?.toLowerCase().includes('haiku') ? 'claude-3-5-haiku-20241022' :
                     model?.toLowerCase().includes('sonnet') ? 'claude-3-5-sonnet-20241022' :
                     'default';

    const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING.default;

    const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
    const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
    const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cache_write;
    const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cache_read;

    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  };

  // Calculate stats from messages
  useEffect(() => {
    if (messages.length === 0) return;

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheWriteTokens = 0;
    let cacheReadTokens = 0;
    let totalCost = 0;
    let messageCount = 0;

    messages.forEach(message => {
      if (message.type === 'assistant' || message.type === 'user') {
        messageCount++;

        const tokens = tokenExtractor.extract(message);
        inputTokens += tokens.input_tokens;
        outputTokens += tokens.output_tokens;
        cacheWriteTokens += tokens.cache_creation_tokens;
        cacheReadTokens += tokens.cache_read_tokens;

        // Get model from message
        const model = (message as any).model || 'claude-3-5-sonnet-20241022';
        const cost = calculateCost(tokens, model);
        totalCost += cost;
      }
    });

    const totalTokens = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens;
    const efficiency = totalTokens > 0 ? ((cacheReadTokens / totalTokens) * 100) : 0;

    setSessionStats({
      inputTokens,
      outputTokens,
      cacheWriteTokens,
      cacheReadTokens,
      totalTokens,
      messageCount,
      efficiency
    });
    setTotalCost(totalCost);
  }, [messages]);

  // Load today's total on mount
  useEffect(() => {
    const loadTodayTotal = async () => {
      try {
        const stats = await api.getTodayUsageStats();
        setTodayTotal(stats.total_cost);
      } catch (err) {
        console.error('Failed to load today total:', err);
      }
    };
    loadTodayTotal();
  }, []);

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount < 0.01) {
      return `$${(amount * 100).toFixed(3)}¢`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Inline mode
  if (position === 'inline') {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm">Session Cost</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 px-2"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <Badge variant="secondary" className="text-xs">
              {formatNumber(sessionStats.totalTokens)} tokens
            </Badge>
          </div>

          <AnimatePresence>
            {expanded && showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 space-y-3 border-t pt-3"
              >
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Input</span>
                    <div className="font-medium">{formatNumber(sessionStats.inputTokens)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Output</span>
                    <div className="font-medium">{formatNumber(sessionStats.outputTokens)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cache Write</span>
                    <div className="font-medium">{formatNumber(sessionStats.cacheWriteTokens)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cache Read</span>
                    <div className="font-medium">{formatNumber(sessionStats.cacheReadTokens)}</div>
                  </div>
                </div>

                {sessionStats.efficiency > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Cache Efficiency</span>
                      <span className="font-medium">{sessionStats.efficiency.toFixed(1)}%</span>
                    </div>
                    <Progress value={sessionStats.efficiency} className="h-1" />
                  </div>
                )}

                {todayTotal !== null && (
                  <div className="flex items-center justify-between text-xs border-t pt-2">
                    <span className="text-muted-foreground">Today's Total</span>
                    <span className="font-medium">{formatCurrency(todayTotal + totalCost)}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  }

  // Floating mode
  const positionClasses = {
    'top-right': 'fixed top-20 right-4 z-40',
    'bottom-right': 'fixed bottom-20 right-4 z-40'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(positionClasses[position as keyof typeof positionClasses], className)}
    >
      <Card className="shadow-lg border-border/50 backdrop-blur bg-background/95 w-64">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium">Live Cost</span>
              {totalCost > 0.10 && (
                <TrendingUp className="h-3 w-3 text-yellow-500" />
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-5 w-5 p-0"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">{formatCurrency(totalCost)}</div>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              <Hash className="h-2.5 w-2.5 mr-0.5" />
              {formatNumber(sessionStats.totalTokens)}
            </Badge>
          </div>

          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              className="mt-2 pt-2 border-t space-y-1.5"
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In</span>
                  <span className="font-medium">{formatNumber(sessionStats.inputTokens)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Out</span>
                  <span className="font-medium">{formatNumber(sessionStats.outputTokens)}</span>
                </div>
              </div>

              {(sessionStats.cacheReadTokens > 0 || sessionStats.cacheWriteTokens > 0) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cache</span>
                  <span className="font-medium text-green-600">
                    {sessionStats.efficiency.toFixed(0)}% hit
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium">{sessionStats.messageCount}</span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RealtimeCostWidget;