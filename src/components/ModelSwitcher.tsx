import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface CCRModel {
  provider: string;
  model: string;
  full_name: string;
}

interface CCRConfigInfo {
  providers: {
    name: string;
    api_base_url: string;
    models: string[];
  }[];
  router_rules: {
    default: string;
    background: string;
    think: string;
    long_context: string;
    web_search: string;
    long_context_threshold: number;
  };
  host: string;
  port: number;
  api_timeout_ms: number;
  log_enabled: boolean;
}

interface ModelSwitcherProps {
  sessionId?: string;
  onModelSwitched?: (provider: string, model: string) => void;
}

export default function ModelSwitcher({ onModelSwitched }: ModelSwitcherProps) {
  const [models, setModels] = useState<CCRModel[]>([]);
  const [config, setConfig] = useState<CCRConfigInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 检查CCR健康状态
  const checkHealth = async () => {
    try {
      const healthy = await invoke<boolean>('router_ccr_health_check');
      setIsHealthy(healthy);
      return healthy;
    } catch (error) {
      console.error('健康检查失败:', error);
      setIsHealthy(false);
      return false;
    }
  };

  // 加载CCR配置和模型
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      // 检查健康状态
      const healthy = await checkHealth();
      if (!healthy) {
        console.warn("CCR服务未运行", "请确保claude-code-router服务正在运行");
        return;
      }

      // 获取配置信息
      const configData = await invoke<CCRConfigInfo>('router_get_config_from_manager');
      setConfig(configData);

      // 获取模型列表
      const modelsData = await invoke<CCRModel[]>('router_get_models_from_config');
      setModels(modelsData);

      // 设置当前模型（默认模型）
      if (configData.router_rules.default) {
        setCurrentModel(configData.router_rules.default);
        setSelectedModel(configData.router_rules.default);
      }

      console.log("模型数据加载成功", `发现 ${modelsData.length} 个可用模型`);
    } catch (error) {
      console.error('加载数据失败:', error);
      console.error("加载失败", error as string);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 切换模型
  const switchModel = async () => {
    if (!selectedModel || selectedModel === currentModel) return;

    setIsLoading(true);
    try {
      const [provider, model] = selectedModel.split(',');
      
      // 使用统一的模型切换API
      await invoke<string>('router_switch_model', {
        provider: provider,
        model: model,
      });

      setCurrentModel(selectedModel);
      
      // 通知父组件
      if (onModelSwitched) {
        onModelSwitched(provider, model);
      }

      console.log("模型切换成功", `已切换到 ${provider} / ${model}`);

    } catch (error) {
      console.error('模型切换失败:', error);
      console.error("切换失败", error as string);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件初始化
  useEffect(() => {
    loadData();
  }, []);

  // 获取模型显示名称
  const getModelDisplayName = (fullName: string) => {
    const [provider, model] = fullName.split(',');
    return `${provider} / ${model}`;
  };

  // 获取路由规则标签
  const getRouteLabels = (fullName: string) => {
    if (!config) return [];
    
    const labels = [];
    const rules = config.router_rules;
    
    if (rules.default === fullName) labels.push('默认');
    if (rules.background === fullName) labels.push('后台');
    if (rules.think === fullName) labels.push('推理');
    if (rules.long_context === fullName) labels.push('长上下文');
    if (rules.web_search === fullName) labels.push('网络搜索');
    
    return labels;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>模型切换器</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            {isHealthy !== null && (
              <Badge variant={isHealthy ? "default" : "destructive"}>
                {isHealthy ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 mr-1" />
                )}
                {isHealthy ? '连接正常' : 'CCR离线'}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前模型显示 */}
        {currentModel && (
          <div>
            <label className="text-sm font-medium text-gray-700">当前模型:</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {getModelDisplayName(currentModel)}
              </span>
              {getRouteLabels(currentModel).map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 模型选择器 */}
        <div>
          <label className="text-sm font-medium text-gray-700">选择模型:</label>
          <div className="mt-1 flex gap-2">
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!isHealthy || models.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="选择一个模型..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.full_name} value={model.full_name}>
                    <div className="flex items-center justify-between w-full">
                      <span>{getModelDisplayName(model.full_name)}</span>
                      <div className="flex gap-1 ml-2">
                        {getRouteLabels(model.full_name).map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={switchModel}
              disabled={isLoading || !selectedModel || selectedModel === currentModel || !isHealthy}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  切换中...
                </>
              ) : (
                '切换模型'
              )}
            </Button>
          </div>
        </div>

        {/* CCR配置信息 */}
        {config && (
          <div className="text-xs text-gray-500 space-y-1">
            <div>CCR 服务: {config.host}:{config.port}</div>
            <div>提供商: {config.providers.length} 个</div>
            <div>可用模型: {models.length} 个</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}