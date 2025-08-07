import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  RefreshCw, 
  Settings, 
  Monitor, 
  AlertCircle,
  CheckCircle,
  Globe
} from 'lucide-react';

interface CCRWebViewProps {
  className?: string;
}

export default function CCRWebView({ className }: CCRWebViewProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0); // 用于强制刷新iframe

  // 检查CCR健康状态
  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const healthy = await invoke<boolean>('router_ccr_health_check');
      setIsHealthy(healthy);
      return healthy;
    } catch (error) {
      console.error('健康检查失败:', error);
      setIsHealthy(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新WebView
  const refreshWebView = () => {
    setWebViewKey(prev => prev + 1);
  };

  // 在外部浏览器中打开
  const openInBrowser = () => {
    // 使用Tauri的shell API打开外部URL
    window.open('http://127.0.0.1:3456/ui/', '_blank');
  };

  // 初始化健康检查
  useEffect(() => {
    checkHealth();
    // 设置定时健康检查
    const interval = setInterval(checkHealth, 30000); // 每30秒检查一次
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <span>Claude Code Router 管理界面</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isHealthy ? "default" : "destructive"}>
                {isHealthy ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    在线
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    离线
                  </>
                )}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshWebView}
                disabled={!isHealthy}
              >
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openInBrowser}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                外部打开
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {isHealthy ? (
            <Tabs value="ui" onValueChange={() => {}} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mb-2">
                <TabsTrigger value="ui" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  配置管理
                </TabsTrigger>
                <TabsTrigger value="monitor" className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  状态监控
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="ui" className="flex-1 m-0 p-4">
                <div className="h-full rounded-lg overflow-hidden border">
                  <iframe
                    key={webViewKey}
                    src="http://127.0.0.1:3456/ui/"
                    className="w-full h-full border-none"
                    title="Claude Code Router UI"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    loading="lazy"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="monitor" className="flex-1 m-0 p-4">
                <div className="h-full space-y-4">
                  <Alert>
                    <Monitor className="w-4 h-4" />
                    <AlertDescription>
                      Router状态监控功能正在开发中，敬请期待...
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">服务状态</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>服务地址:</span>
                            <span className="font-mono">http://127.0.0.1:3456</span>
                          </div>
                          <div className="flex justify-between">
                            <span>健康状态:</span>
                            <span className={isHealthy ? 'text-green-600' : 'text-red-600'}>
                              {isHealthy ? '正常' : '异常'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">快速操作</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Settings className="w-4 h-4 mr-2" />
                          编辑配置文件
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          重启Router服务
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <Alert className="max-w-md">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-center">
                  <div className="mb-2">CCR服务当前不可用</div>
                  <div className="text-sm text-gray-600 mb-4">
                    请确保claude-code-router服务正在运行
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded">
                      ccr start
                    </div>
                    <Button variant="outline" size="sm" onClick={checkHealth} disabled={isLoading}>
                      {isLoading ? '检查中...' : '重新检查'}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}