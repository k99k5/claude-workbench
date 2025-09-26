import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage, type ApiBaseUrlUsage } from "@/lib/api";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Filter,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Briefcase,
  BarChart3,
  PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

/**
 * UsageDashboard component - Displays Claude API usage statistics and costs
 * 
 * @example
 * <UsageDashboard onBack={() => setView('welcome')} />
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d" | "today">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [apiBaseUrlStats, setApiBaseUrlStats] = useState<ApiBaseUrlUsage[] | null>(null);

  const loadUsageStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let statsPromise: Promise<UsageStats>;
      let sessionPromise: Promise<ProjectUsage[]>;
      const apiBasePromise = api.getUsageByApiBaseUrl();

      if (selectedDateRange === "today") {
        statsPromise = api.getTodayUsageStats();
        sessionPromise = api.getSessionStats(undefined, undefined, "desc");
      } else if (selectedDateRange === "all") {
        statsPromise = api.getUsageStats();
        sessionPromise = api.getSessionStats(undefined, undefined, "desc");
      } else {
        const endDate = new Date();
        const startDate = new Date();
        const days = selectedDateRange === "7d" ? 7 : 30;
        startDate.setDate(startDate.getDate() - days);

        statsPromise = api.getUsageByDateRange(
          startDate.toISOString(),
          endDate.toISOString()
        );
        sessionPromise = api.getSessionStats(
          formatDateForApi(startDate),
          formatDateForApi(endDate),
          "desc"
        );
      }

      const [statsResult, sessionResult, apiBaseResult] = await Promise.allSettled([
        statsPromise,
        sessionPromise,
        apiBasePromise,
      ]);

      if (statsResult.status !== "fulfilled") {
        throw statsResult.reason ?? new Error("Failed to load usage stats");
      }

      setStats(statsResult.value);

      if (sessionResult.status === "fulfilled") {
        setSessionStats(sessionResult.value);
      } else {
        setSessionStats(null);
        console.warn("Failed to load session stats:", sessionResult.reason);
      }

      if (apiBaseResult.status === "fulfilled") {
        setApiBaseUrlStats(apiBaseResult.value);
      } else {
        setApiBaseUrlStats(null);
        console.warn("Failed to load API base URL stats:", apiBaseResult.reason);
      }
    } catch (err) {
      console.error("Failed to load usage stats:", err);
      setError("加载使用统计失败，请重试。");
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange]);

  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatTokens = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  };

  const formatPercent = (value: number): string => {
    if (!Number.isFinite(value)) {
      return "0%";
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDateForApi = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const derivedMetrics = useMemo(() => {
    if (!stats) {
      return {
        avgCostPerSession: 0,
        avgTokensPerSession: 0,
        cacheReuseRate: 0,
        cacheCoverageRate: 0,
      };
    }

    const sessionCount = Math.max(stats.total_sessions, 1);
    const totalCacheOps = stats.total_cache_creation_tokens + stats.total_cache_read_tokens;
    const cacheReuseRate = totalCacheOps > 0 ? stats.total_cache_read_tokens / totalCacheOps : 0;
    const cacheCoverageRate = (stats.total_input_tokens + stats.total_cache_read_tokens) > 0
      ? stats.total_cache_read_tokens / (stats.total_input_tokens + stats.total_cache_read_tokens)
      : 0;

    return {
      avgCostPerSession: stats.total_cost / sessionCount,
      avgTokensPerSession: stats.total_tokens / sessionCount,
      cacheReuseRate,
      cacheCoverageRate,
    };
  }, [stats]);

  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  };

  const getModelColor = (model: string): string => {
    if (model.includes("opus")) return "text-purple-500";
    if (model.includes("sonnet")) return "text-blue-500";
    return "text-gray-500";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">使用情况仪表盘</h1>
              <p className="text-xs text-muted-foreground">
                追踪您的 Claude Code 使用情况和成本
              </p>
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(["all", "30d", "7d", "today"] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  className="text-xs"
                >
                  {range === "all" ? "所有时间" : range === "7d" ? "近 7 天" : range === "30d" ? "近 30 天" : "今天"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">正在加载使用统计数据...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={loadUsageStats} size="sm">
                Retry
              </Button>
            </div>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Total Cost Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总成本</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(stats.total_cost)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Sessions Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总会话</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatNumber(stats.total_sessions)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Tokens Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总令牌</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTokens(stats.total_tokens)}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Cost per Session Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">平均每会话成本</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(derivedMetrics.avgCostPerSession)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Tokens per Session Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">平均每会话令牌数</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTokens(derivedMetrics.avgTokensPerSession)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Cache Reuse Rate Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">缓存重用率</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatPercent(derivedMetrics.cacheReuseRate)}
                    </p>
                  </div>
                  <PieChart className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="models">按模型</TabsTrigger>
                <TabsTrigger value="projects">按项目</TabsTrigger>
                <TabsTrigger value="sessions">按会话</TabsTrigger>
                <TabsTrigger value="api-base-url">按API地址</TabsTrigger>
                <TabsTrigger value="timeline">时间线</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">令牌明细</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">输入令牌</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_input_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">输出令牌</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_output_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存写入</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_cache_creation_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存读取</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_cache_read_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存重用率</p>
                      <p className="text-lg font-semibold">{formatPercent(derivedMetrics.cacheReuseRate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存覆盖率</p>
                      <p className="text-lg font-semibold">{formatPercent(derivedMetrics.cacheCoverageRate)}</p>
                    </div>
                  </div>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">最常用模型</h3>
                    <div className="space-y-3">
                      {stats.by_model.slice(0, 3).map((model) => (
                        <div key={model.model} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={cn("text-xs", getModelColor(model.model))}>
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {model.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">热门项目</h3>
                    <div className="space-y-3">
                      {stats.by_project.slice(0, 3).map((project) => (
                        <div key={project.project_path} className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium truncate max-w-[200px]" title={project.project_path}>
                              {project.project_path}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(project.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按模型使用情况</h3>
                  <div className="space-y-4">
                    {stats.by_model.map((model) => (
                      <div key={model.model} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getModelColor(model.model))}
                            >
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {model.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">输入： </span>
                            <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">输出： </span>
                            <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存写： </span>
                            <span className="font-medium">{formatTokens(model.cache_creation_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存读： </span>
                            <span className="font-medium">{formatTokens(model.cache_read_tokens)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按项目使用情况</h3>
                  <div className="space-y-3">
                    {stats.by_project.map((project) => (
                      <div key={project.project_path} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex flex-col truncate">
                          <span className="text-sm font-medium truncate" title={project.project_path}>
                            {project.project_path}
                          </span>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} 个会话
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTokens(project.total_tokens)} 个令牌
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(project.total_cost)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(project.total_cost / project.session_count)}/会话
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions">
                  <Card className="p-6">
                      <h3 className="text-sm font-semibold mb-4">按会话使用情况</h3>
                      <div className="space-y-3">
                          {sessionStats?.map((session) => (
                              <div key={`${session.project_path}-${session.project_name}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                  <div className="flex flex-col">
                                      <div className="flex items-center space-x-2">
                                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={session.project_path}>
                                            {session.project_path.split('/').slice(-2).join('/')}
                                        </span>
                                      </div>
                                      <span className="text-sm font-medium mt-1">
                                          {session.project_name}
                                      </span>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-sm font-semibold">{formatCurrency(session.total_cost)}</p>
                                      <p className="text-xs text-muted-foreground">
                                          {new Date(session.last_used).toLocaleDateString()}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </TabsContent>

              {/* API Base URL Tab */}
              <TabsContent value="api-base-url">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按API地址使用情况</h3>
                  <div className="space-y-4">
                    {apiBaseUrlStats?.map((apiUrlStat) => (
                      <div key={apiUrlStat.api_base_url} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs">
                              {apiUrlStat.api_base_url}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {apiUrlStat.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(apiUrlStat.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">输入： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">输出： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存写： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.cache_creation_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存读： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.cache_read_tokens)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>日常使用情况</span>
                  </h3>
                  {stats.by_date.length > 0 ? (() => {
                    const maxCost = Math.max(...stats.by_date.map(d => d.total_cost), 0);
                    const halfMaxCost = maxCost / 2;

                    return (
                      <div className="relative pl-8 pr-4">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(maxCost)}</span>
                          <span>{formatCurrency(halfMaxCost)}</span>
                          <span>{formatCurrency(0)}</span>
                        </div>
                        
                        {/* Chart container */}
                        <div className="flex items-end space-x-2 h-64 border-l border-b border-border pl-4">
                          {stats.by_date.slice().reverse().map((day) => {
                            const heightPercent = maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0;
                            const date = new Date(day.date.replace(/-/g, '/'));
                            const formattedDate = date.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            });
                            
                            return (
                              <div key={day.date} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                  <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap">
                                    <p className="text-sm font-semibold">{formattedDate}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      成本： {formatCurrency(day.total_cost)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatTokens(day.total_tokens)} 个令牌
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {day.models_used.length} 个模型
                                    </p>
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                    <div className="border-4 border-transparent border-t-border"></div>
                                  </div>
                                </div>
                                
                                {/* Bar */}
                                <div 
                                  className="w-full bg-[#d97757] hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                                  style={{ height: `${heightPercent}%` }}
                                />
                                
                                {/* X-axis label – absolutely positioned below the bar so it doesn't affect bar height */}
                                <div
                                  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap pointer-events-none"
                                >
                                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* X-axis label */}
                        <div className="mt-8 text-center text-xs text-muted-foreground">
                          日常使用情况随时间变化
                        </div>
                      </div>
                    )
                  })() : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      所选时期内无使用数据
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}; 
