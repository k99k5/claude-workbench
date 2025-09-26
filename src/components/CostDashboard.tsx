import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Hash,
  Activity,
  ArrowUp,
  ArrowDown,
  Clock,
  BarChart3,
  PieChart,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api, type UsageStats, type UsageEntry } from '@/lib/api';
import { cn } from '@/lib/utils';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface CostMetrics {
  totalCost: number;
  sessionCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  averageCostPerToken: number;
  hourlyRate: number;
  dailySpend: number;
  weeklySpend: number;
  monthlySpend: number;
}

interface CostDashboardProps {
  /**
   * Current session ID for real-time cost tracking
   */
  sessionId?: string;
  /**
   * Project path for scoped cost tracking
   */
  projectPath?: string;
  /**
   * Whether to show real-time updates
   */
  realTime?: boolean;
  /**
   * Compact mode for integration into other components
   */
  compact?: boolean;
  /**
   * Custom className for styling
   */
  className?: string;
}

/**
 * CostDashboard component - Real-time cost monitoring and analytics
 *
 * Features:
 * - Real-time cost tracking via Tauri events
 * - Session-specific cost breakdown
 * - Token usage visualization
 * - Cost trends and projections
 * - Historical usage charts
 */
export const CostDashboard: React.FC<CostDashboardProps> = ({
  sessionId,
  projectPath,
  realTime = false,
  compact = false,
  className
}) => {
  const [metrics, setMetrics] = useState<CostMetrics>({
    totalCost: 0,
    sessionCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    averageCostPerToken: 0,
    hourlyRate: 0,
    dailySpend: 0,
    weeklySpend: 0,
    monthlySpend: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<UsageEntry[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  // Real-time cost tracking state
  const [realtimeCost, setRealtimeCost] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Format currency with proper precision for small amounts
  const formatCurrency = (amount: number): string => {
    if (amount < 0.01) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 6
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
      return `${(tokens / 1_000_000).toFixed(2)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toLocaleString();
  };

  // Calculate cost trends
  const costTrend = useMemo(() => {
    if (!usageStats?.by_date || usageStats.by_date.length < 2) {
      return { direction: 'neutral', percentage: 0 };
    }

    const sortedDates = usageStats.by_date.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recent = sortedDates.slice(-7); // Last 7 days
    const previous = sortedDates.slice(-14, -7); // Previous 7 days

    const recentAvg = recent.reduce((sum, day) => sum + day.total_cost, 0) / recent.length;
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, day) => sum + day.total_cost, 0) / previous.length
      : 0;

    if (previousAvg === 0) return { direction: 'neutral', percentage: 0 };

    const percentage = ((recentAvg - previousAvg) / previousAvg) * 100;
    return {
      direction: percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'neutral',
      percentage: Math.abs(percentage)
    };
  }, [usageStats]);

  // Load usage statistics
  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load overall usage stats
      const stats = await api.getUsageStats();
      setUsageStats(stats);

      // Load recent usage entries for detailed analysis
      const entries = await api.getUsageDetails(50);
      setRecentEntries(entries);

      // Calculate session-specific cost if sessionId provided
      let sessionCost = 0;
      if (sessionId && entries.length > 0) {
        // Estimate session cost based on recent entries
        // This is a rough estimation - in a real implementation, you'd track per session
        sessionCost = entries
          .filter(entry => new Date(entry.timestamp) > (sessionStartTime || new Date(Date.now() - 3600000)))
          .reduce((sum, entry) => sum + entry.cost, 0);
      }

      // Calculate time-based spending rates
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyEntries = entries.filter(e => new Date(e.timestamp) > dayAgo);
      const weeklyEntries = entries.filter(e => new Date(e.timestamp) > weekAgo);
      const monthlyEntries = entries.filter(e => new Date(e.timestamp) > monthAgo);

      const dailySpend = dailyEntries.reduce((sum, e) => sum + e.cost, 0);
      const weeklySpend = weeklyEntries.reduce((sum, e) => sum + e.cost, 0);
      const monthlySpend = monthlyEntries.reduce((sum, e) => sum + e.cost, 0);

      // Calculate hourly rate based on recent activity
      const hourlyRate = dailySpend / 24;

      // Calculate average cost per token
      const totalTokensUsed = stats.total_input_tokens + stats.total_output_tokens;
      const averageCostPerToken = totalTokensUsed > 0 ? stats.total_cost / totalTokensUsed : 0;

      setMetrics({
        totalCost: stats.total_cost,
        sessionCost,
        inputTokens: stats.total_input_tokens,
        outputTokens: stats.total_output_tokens,
        cacheReadTokens: stats.total_cache_read_tokens,
        cacheWriteTokens: stats.total_cache_creation_tokens,
        averageCostPerToken,
        hourlyRate,
        dailySpend,
        weeklySpend,
        monthlySpend
      });

    } catch (err) {
      console.error('Failed to load cost metrics:', err);
      setError('加载成本指标失败');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time cost event listeners
  useEffect(() => {
    const unlistenRefs: UnlistenFn[] = [];

    if (realTime && sessionId) {
      setSessionStartTime(new Date());

      const setupRealtimeListeners = async () => {
        try {
          // Listen for cost response events
          const costUnlisten = await listen<{ cost: number; tokens: number }>(`claude-cost-response:${sessionId}`, (event) => {
            const { cost, tokens } = event.payload;
            setRealtimeCost(prev => prev + cost);
            setMetrics(prev => ({
              ...prev,
              sessionCost: prev.sessionCost + cost,
              totalCost: prev.totalCost + cost,
              inputTokens: prev.inputTokens + Math.floor(tokens * 0.7), // Estimate input/output split
              outputTokens: prev.outputTokens + Math.floor(tokens * 0.3)
            }));
          });

          // Listen for generic cost events
          const genericCostUnlisten = await listen<{ cost: number; tokens: number; model: string }>('claude-cost-update', (event) => {
            const { cost } = event.payload;
            setRealtimeCost(prev => prev + cost);
            setMetrics(prev => ({
              ...prev,
              sessionCost: prev.sessionCost + cost,
              totalCost: prev.totalCost + cost
            }));
          });

          unlistenRefs.push(costUnlisten, genericCostUnlisten);
        } catch (err) {
          console.error('Failed to set up real-time cost listeners:', err);
        }
      };

      setupRealtimeListeners();
    }

    return () => {
      unlistenRefs.forEach(unlisten => unlisten());
    };
  }, [realTime, sessionId]);

  // Load initial metrics
  useEffect(() => {
    loadMetrics();
  }, [projectPath]);

  // Refresh metrics periodically when real-time is enabled
  useEffect(() => {
    if (!realTime) return;

    const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [realTime]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-6", className)}>
        <div className="rotating-symbol text-primary mr-2" />
        <span className="text-sm text-muted-foreground">加载成本数据...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="text-center text-destructive text-sm">{error}</div>
      </Card>
    );
  }

  if (compact) {
    // Compact mode for integration into other components
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex items-center gap-4 p-3 rounded-lg border bg-card", className)}
      >
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-green-600" />
          <span className="font-medium">成本:</span>
          <span className="font-mono">{formatCurrency(metrics.sessionCost || metrics.totalCost)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Hash className="h-4 w-4 text-blue-600" />
          <span className="font-medium">令牌:</span>
          <span className="font-mono">{formatTokens(metrics.inputTokens + metrics.outputTokens)}</span>
        </div>
        {realTime && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">实时</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">成本仪表盘</h2>
          <p className="text-muted-foreground">实时成本监控和使用分析</p>
        </div>
        {realTime && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
            实时监控
          </Badge>
        )}
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Session Cost */}
        {sessionId && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="shimmer-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  当前会话成本
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(metrics.sessionCost + realtimeCost)}
                </div>
                {sessionStartTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    开始时间: {sessionStartTime.toLocaleTimeString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Total Cost */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Card className="shimmer-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                总成本
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.totalCost)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {costTrend.direction === 'up' && <ArrowUp className="h-3 w-3 text-red-500" />}
                {costTrend.direction === 'down' && <ArrowDown className="h-3 w-3 text-green-500" />}
                <span className={cn(
                  "text-xs font-medium",
                  costTrend.direction === 'up' ? "text-red-500" :
                  costTrend.direction === 'down' ? "text-green-500" : "text-muted-foreground"
                )}>
                  {costTrend.percentage > 0 ? `${costTrend.percentage.toFixed(1)}%` : '持平'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Token Usage */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <Card className="shimmer-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-purple-600" />
                令牌使用
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatTokens(metrics.inputTokens + metrics.outputTokens)}
              </div>
              <div className="flex text-xs text-muted-foreground mt-1 gap-2">
                <span>输入: {formatTokens(metrics.inputTokens)}</span>
                <span>输出: {formatTokens(metrics.outputTokens)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Hourly Rate */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
          <Card className="shimmer-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                小时费率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(metrics.hourlyRate)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">基于24小时平均</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Breakdown */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                令牌详细分析
              </CardTitle>
              <CardDescription>输入、输出和缓存令牌分布</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">输入令牌</span>
                    <span className="text-sm text-muted-foreground">{formatTokens(metrics.inputTokens)}</span>
                  </div>
                  <Progress
                    value={(metrics.inputTokens / (metrics.inputTokens + metrics.outputTokens)) * 100}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">输出令牌</span>
                    <span className="text-sm text-muted-foreground">{formatTokens(metrics.outputTokens)}</span>
                  </div>
                  <Progress
                    value={(metrics.outputTokens / (metrics.inputTokens + metrics.outputTokens)) * 100}
                    className="h-2"
                  />
                </div>

                {(metrics.cacheReadTokens > 0 || metrics.cacheWriteTokens > 0) && (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">缓存读取</span>
                        <span className="text-sm text-muted-foreground">{formatTokens(metrics.cacheReadTokens)}</span>
                      </div>
                      <Progress
                        value={(metrics.cacheReadTokens / (metrics.inputTokens + metrics.outputTokens)) * 100}
                        className="h-2"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">缓存写入</span>
                        <span className="text-sm text-muted-foreground">{formatTokens(metrics.cacheWriteTokens)}</span>
                      </div>
                      <Progress
                        value={(metrics.cacheWriteTokens / (metrics.inputTokens + metrics.outputTokens)) * 100}
                        className="h-2"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">平均每令牌成本</span>
                  <span className="font-mono">{formatCurrency(metrics.averageCostPerToken)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Time-based Spending */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                支出趋势
              </CardTitle>
              <CardDescription>按时间段的支出分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">日支出</div>
                  <div className="text-lg font-bold">{formatCurrency(metrics.dailySpend)}</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">周支出</div>
                  <div className="text-lg font-bold">{formatCurrency(metrics.weeklySpend)}</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">月支出</div>
                  <div className="text-lg font-bold">{formatCurrency(metrics.monthlySpend)}</div>
                </div>
              </div>

              {/* Projections */}
              <div className="pt-3 border-t space-y-2">
                <h4 className="text-sm font-medium">预测支出</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">预计月支出:</span>
                    <span className="font-mono">{formatCurrency(metrics.dailySpend * 30)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">预计年支出:</span>
                    <span className="font-mono">{formatCurrency(metrics.dailySpend * 365)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Usage Activity */}
      {recentEntries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                近期使用活动
              </CardTitle>
              <CardDescription>最近的API调用和成本</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentEntries.slice(0, 10).map((entry, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground w-16">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {entry.model}
                      </Badge>
                      <div className="text-sm font-mono">
                        {formatTokens(entry.input_tokens + entry.output_tokens)} 令牌
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrency(entry.cost)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};