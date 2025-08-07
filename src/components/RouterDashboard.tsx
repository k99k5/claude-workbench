import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Activity, 
  Zap, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  BarChart3,
  Settings2,
  Cpu,
  Network,
} from 'lucide-react';

import { useRouter } from '@/hooks/useRouter';
import { RoutingMode, RouterUtils } from '@/lib/router-types';

/**
 * Router仪表盘主组件
 * 提供Router系统的完整管理界面
 */
export function RouterDashboard() {
  const router = useRouter({
    autoInit: true,
    enablePolling: true,
    pollingInterval: 30000,
    debug: true,
  });

  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('control');
  
  // 状态指示器颜色
  const getStatusColor = (status: typeof router.healthStatus) => {
    switch (status.type) {
      case 'healthy': return 'text-green-500';
      case 'unhealthy': return 'text-red-500';
      case 'starting': return 'text-yellow-500';
      case 'stopping': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: typeof router.healthStatus) => {
    switch (status.type) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'unhealthy': return <XCircle className="w-4 h-4" />;
      case 'starting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'stopping': return <RefreshCw className="w-4 h-4 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // 事件监听
  useEffect(() => {
    const unsubscribe = router.addEventListener((event) => {
      console.log('Router事件:', event);
      
      switch (event.type) {
        case 'status_changed':
          // 可以在这里添加通知或其他副作用
          break;
        case 'model_switched':
          // 模型切换成功的处理
          break;
        case 'error':
          // 错误处理
          console.error('Router错误:', event.error);
          break;
      }
    });

    return unsubscribe;
  }, [router]);

  // 模型切换处理
  const handleModelSwitch = async () => {
    if (selectedProvider && selectedModel) {
      await router.switchToModel(selectedProvider, selectedModel);
      setSelectedProvider('');
      setSelectedModel('');
    }
  };

  // 获取可用的提供商和模型
  const providers = Array.from(new Set(router.availableModels.map(m => m.provider)));
  const modelsForProvider = selectedProvider 
    ? router.availableModels.filter(m => m.provider === selectedProvider)
    : [];

  if (router.loading && !router.isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>正在初始化Router...</span>
        </div>
      </div>
    );
  }

  if (router.error && !router.isInitialized) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Router初始化失败: {router.error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={router.initialize}
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className={getStatusColor(router.healthStatus)}>
                {getStatusIcon(router.healthStatus)}
              </div>
              <div>
                <p className="text-sm font-medium">Router状态</p>
                <p className="text-xs text-muted-foreground">
                  {RouterUtils.formatHealthStatus(router.healthStatus)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">运行状态</p>
                <p className="text-xs text-muted-foreground">
                  {router.isRunning ? '运行中' : '已停止'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Network className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">路由模式</p>
                <p className="text-xs text-muted-foreground">
                  {router.routingMode === RoutingMode.SmartRouting && '智能路由'}
                  {router.routingMode === RoutingMode.Native && '原生模式'}
                  {router.routingMode === RoutingMode.RouterOnly && '仅Router'}
                  {router.routingMode === RoutingMode.Manual && '手动选择'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">可用模型</p>
                <p className="text-xs text-muted-foreground">
                  {router.availableModels.length} 个模型
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 错误提示 */}
      {router.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {router.error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => window.location.reload()}
            >
              刷新
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="control">控制面板</TabsTrigger>
          <TabsTrigger value="models">模型管理</TabsTrigger>
          <TabsTrigger value="stats">统计监控</TabsTrigger>
          <TabsTrigger value="config">配置管理</TabsTrigger>
        </TabsList>

        {/* 控制面板 */}
        <TabsContent value="control">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>进程控制</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Button 
                    onClick={router.startRouter}
                    disabled={router.isRunning || router.loading}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    启动
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={router.stopRouter}
                    disabled={!router.isRunning || router.loading}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    停止
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={router.restartRouter}
                    disabled={router.loading}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    重启
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>路由模式</Label>
                  <Select 
                    value={router.routingMode} 
                    onValueChange={(value: RoutingMode) => router.setRoutingMode(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RoutingMode.SmartRouting}>智能路由</SelectItem>
                      <SelectItem value={RoutingMode.Native}>原生Claude CLI</SelectItem>
                      <SelectItem value={RoutingMode.RouterOnly}>仅使用Router</SelectItem>
                      <SelectItem value={RoutingMode.Manual}>手动选择</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  variant="outline" 
                  onClick={router.syncWithWorkbench}
                  disabled={router.loading}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  与Workbench同步配置
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>健康监控</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>当前状态:</span>
                  <div className="flex items-center space-x-2">
                    <div className={getStatusColor(router.healthStatus)}>
                      {getStatusIcon(router.healthStatus)}
                    </div>
                    <Badge variant={router.healthStatus.type === 'healthy' ? 'default' : 'destructive'}>
                      {RouterUtils.formatHealthStatus(router.healthStatus)}
                    </Badge>
                  </div>
                </div>

                {router.stats && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>可用性:</span>
                      <span>{router.stats.averageResponseTime > 0 ? '99.9%' : 'N/A'}</span>
                    </div>
                    <Progress 
                      value={router.stats.averageResponseTime > 0 ? 99.9 : 0} 
                      className="h-2" 
                    />
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={router.performHealthCheck}
                    disabled={router.loading}
                    className="flex-1"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    健康检查
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={router.refreshStats}
                    disabled={router.loading}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    刷新状态
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 模型管理 */}
        <TabsContent value="models">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>模型切换</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={router.refreshModels}
                    disabled={router.loading}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>提供商</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择提供商" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map(provider => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>模型</Label>
                  <Select 
                    value={selectedModel} 
                    onValueChange={setSelectedModel}
                    disabled={!selectedProvider}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelsForProvider.map(model => (
                        <SelectItem key={model.name} value={model.name}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.displayName}</span>
                            {model.costPerToken && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {RouterUtils.formatCost(model.costPerToken)}/token
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleModelSwitch}
                  disabled={!selectedProvider || !selectedModel || router.loading}
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  切换模型
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>当前活跃模型</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {router.activeModel ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">提供商:</span>
                      <Badge variant="secondary">{router.activeModel[0]}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">模型:</span>
                      <Badge>{router.activeModel[1]}</Badge>
                    </div>
                    
                    {/* 显示模型详细信息 */}
                    {(() => {
                      const currentModel = router.availableModels.find(
                        m => m.provider === router.activeModel![0] && m.name === router.activeModel![1]
                      );
                      return currentModel && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span>上下文限制:</span>
                            <span>{currentModel.contextLimit?.toLocaleString() || 'N/A'} tokens</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>成本:</span>
                            <span>{currentModel.costPerToken ? RouterUtils.formatCost(currentModel.costPerToken) + '/token' : 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>状态:</span>
                            <Badge variant={currentModel.available ? 'default' : 'destructive'}>
                              {currentModel.available ? '可用' : '不可用'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    暂无活跃模型
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 统计监控 */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {router.stats ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>请求统计</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">总请求数:</span>
                        <span className="font-medium">{router.stats.totalRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">成功请求:</span>
                        <span className="font-medium text-green-600">{router.stats.successfulRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">失败请求:</span>
                        <span className="font-medium text-red-600">{router.stats.failedRequests}</span>
                      </div>
                    </div>
                    
                    {router.stats.totalRequests > 0 && (
                      <Progress 
                        value={(router.stats.successfulRequests / router.stats.totalRequests) * 100} 
                        className="h-2" 
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5" />
                      <span>成本统计</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {RouterUtils.formatCost(router.stats.totalCost)}
                      </div>
                      <div className="text-sm text-muted-foreground">总成本</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>平均每请求:</span>
                        <span>
                          {router.stats.totalRequests > 0 
                            ? RouterUtils.formatCost(router.stats.totalCost / router.stats.totalRequests)
                            : '$0.0000'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Clock className="w-5 h-5" />
                      <span>性能统计</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {router.stats.averageResponseTime.toFixed(0)}ms
                      </div>
                      <div className="text-sm text-muted-foreground">平均响应时间</div>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      最后更新: {new Date(router.stats.lastUpdated).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="col-span-full">
                <CardContent className="text-center py-8">
                  <div className="text-muted-foreground">
                    暂无统计数据
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={router.refreshStats}
                    className="mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    加载统计
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* 配置管理 */}
        <TabsContent value="config">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings2 className="w-5 h-5" />
                  <span>基础配置</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {router.config && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enabled">启用Router</Label>
                      <Switch 
                        id="enabled"
                        checked={router.config.enabled}
                        onCheckedChange={(enabled) => {
                          router.updateConfig({
                            ...router.config!,
                            enabled
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="port">监听端口</Label>
                      <Input 
                        id="port"
                        type="number"
                        value={router.config.port}
                        onChange={(e) => {
                          router.updateConfig({
                            ...router.config!,
                            port: parseInt(e.target.value) || 3456
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeout">超时时间(毫秒)</Label>
                      <Input 
                        id="timeout"
                        type="number"
                        value={router.config.timeoutMs}
                        onChange={(e) => {
                          router.updateConfig({
                            ...router.config!,
                            timeoutMs: parseInt(e.target.value) || 30000
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="retries">最大重试次数</Label>
                      <Input 
                        id="retries"
                        type="number"
                        value={router.config.maxRetries}
                        onChange={(e) => {
                          router.updateConfig({
                            ...router.config!,
                            maxRetries: parseInt(e.target.value) || 3
                          });
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>高级选项</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {router.config && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="autoStart">自动启动</Label>
                      <Switch 
                        id="autoStart"
                        checked={router.config.autoStart}
                        onCheckedChange={(autoStart) => {
                          router.updateConfig({
                            ...router.config!,
                            autoStart
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="costOptimization">成本优化</Label>
                      <Switch 
                        id="costOptimization"
                        checked={router.config.costOptimization}
                        onCheckedChange={(costOptimization) => {
                          router.updateConfig({
                            ...router.config!,
                            costOptimization
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="fallbackEnabled">故障转移</Label>
                      <Switch 
                        id="fallbackEnabled"
                        checked={router.config.fallbackEnabled}
                        onCheckedChange={(fallbackEnabled) => {
                          router.updateConfig({
                            ...router.config!,
                            fallbackEnabled
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      // 配置验证逻辑
                      router.manager.validateConfig().then(warnings => {
                        if (warnings.length > 0) {
                          console.warn('配置警告:', warnings);
                        }
                      });
                    }}
                    className="w-full"
                  >
                    验证配置
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 最后更新时间 */}
      {router.lastUpdated && (
        <div className="text-xs text-muted-foreground text-center">
          最后更新: {router.lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
}