import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ShieldCheck,
  FlaskConical,
  ShieldAlert,
  Gauge,
  ArrowLeft,
  Search,
  History,
  Zap,
  Users,
  Target,
  TrendingUp,
  XCircle,
  Clock
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type {
  SubagentSpecialty,
  RoutingDecision,
  RoutingHistory
} from '@/types/subagents';

interface SubagentManagerProps {
  onBack: () => void;
}

const SpecialtyIcons = {
  'general': Bot,
  'code-reviewer': ShieldCheck,
  'test-engineer': FlaskConical,
  'security-auditor': ShieldAlert,
  'performance-optimizer': Gauge,
} as const;

const SpecialtyColors = {
  'general': 'bg-gray-500',
  'code-reviewer': 'bg-blue-500',
  'test-engineer': 'bg-green-500',
  'security-auditor': 'bg-red-500',
  'performance-optimizer': 'bg-purple-500',
} as const;

export function SubagentManager({ onBack }: SubagentManagerProps) {
  const [specialties, setSpecialties] = useState<SubagentSpecialty[]>([]);
  const [routingHistory, setRoutingHistory] = useState<RoutingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [testRequest, setTestRequest] = useState('');
  const [routingResult, setRoutingResult] = useState<RoutingDecision | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    initializeSystem();
  }, []);

  const initializeSystem = async () => {
    try {
      setLoading(true);
      setError(null);

      await api.initSubagentSystem();

      const [specialtiesData, historyData] = await Promise.all([
        api.listSubagentSpecialties(),
        api.getRoutingHistory(50)
      ]);

      setSpecialties(specialtiesData);
      setRoutingHistory(historyData);
    } catch (err) {
      console.error('Failed to initialize subagent system:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize system');
    } finally {
      setLoading(false);
    }
  };

  const testRouting = async () => {
    if (!testRequest.trim()) return;

    try {
      setTestLoading(true);
      const result = await api.routeToSubagent(testRequest);
      setRoutingResult(result);
    } catch (err) {
      console.error('Failed to test routing:', err);
      setError(err instanceof Error ? err.message : 'Failed to test routing');
    } finally {
      setTestLoading(false);
    }
  };


  const renderOverview = () => {
    const stats = {
      totalSpecialties: specialties.length,
      totalRoutingHistory: routingHistory.length,
      avgConfidence: routingHistory.length > 0
        ? routingHistory.reduce((sum, item) => sum + item.confidence_score, 0) / routingHistory.length
        : 0,
      successRate: routingHistory.length > 0
        ? (routingHistory.filter(item => item.user_feedback === 1).length / routingHistory.length) * 100
        : 0,
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalSpecialties}</p>
                  <p className="text-xs text-muted-foreground">专业化类型</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{(stats.avgConfidence * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">平均置信度</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">成功率</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalRoutingHistory}</p>
                  <p className="text-xs text-muted-foreground">路由记录</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>可用专业化类型</span>
            </CardTitle>
            <CardDescription>
              系统预定义的专业化子代理类型
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {specialties.map((specialty) => {
                const IconComponent = SpecialtyIcons[specialty.specialty_type as keyof typeof SpecialtyIcons] || Bot;
                const colorClass = SpecialtyColors[specialty.specialty_type as keyof typeof SpecialtyColors] || 'bg-gray-500';

                return (
                  <motion.div
                    key={specialty.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${colorClass} text-white flex-shrink-0`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">
                              {specialty.display_name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {specialty.description}
                            </p>
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                {specialty.specialty_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRoutingTest = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>智能路由测试</span>
          </CardTitle>
          <CardDescription>
            测试系统如何为不同的用户请求选择合适的专业化子代理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-request">用户请求</Label>
            <Textarea
              id="test-request"
              placeholder="例如：请帮我审查这段代码的安全性..."
              value={testRequest}
              onChange={(e) => setTestRequest(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            onClick={testRouting}
            disabled={!testRequest.trim() || testLoading}
            className="w-full"
          >
            {testLoading ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            测试路由
          </Button>

          <AnimatePresence>
            {routingResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Target className="h-5 w-5" />
                      <span>路由结果</span>
                      <Badge variant={routingResult.confidence_score > 0.7 ? "default" : "secondary"}>
                        置信度: {(routingResult.confidence_score * 100).toFixed(1)}%
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">选中的专业化类型</Label>
                      <p className="text-lg font-semibold text-primary mt-1">
                        {routingResult.specialty_type}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">匹配的关键词</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {routingResult.matched_keywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">路由原因</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {routingResult.reasoning}
                      </p>
                    </div>

                    <Progress value={routingResult.confidence_score * 100} className="h-2" />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在初始化Subagent专业化系统...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto p-6 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subagent专业化系统</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              管理专业化子代理类型，配置智能路由，优化用户体验
            </p>
          </div>
        </motion.div>

        {error && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>概览</span>
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>智能路由</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {renderOverview()}
          </TabsContent>

          <TabsContent value="routing" className="space-y-6">
            {renderRoutingTest()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}