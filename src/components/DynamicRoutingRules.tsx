import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit2, Trash2, Search, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface DynamicRoutingRule {
  id: string;
  name: string;
  keywords: string[];
  target_model: string;
  priority: number;
  enabled: boolean;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function DynamicRoutingRules() {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [rules, setRules] = useState<DynamicRoutingRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<DynamicRoutingRule | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testText, setTestText] = useState('');
  const [matchedRule, setMatchedRule] = useState<DynamicRoutingRule | null>(null);
  
  // Form state for new/edit rule
  const [formData, setFormData] = useState<Partial<DynamicRoutingRule>>({
    id: '',
    name: '',
    keywords: [],
    target_model: '',
    priority: 1,
    enabled: true,
  });
  const [keywordInput, setKeywordInput] = useState('');

  // 显示通知
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // 加载规则列表
  const loadRules = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<DynamicRoutingRule[]>('router_get_dynamic_rules');
      setRules(data);
    } catch (error) {
      console.error('加载动态路由规则失败:', error);
      showNotification('error', '加载动态路由规则失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加规则
  const addRule = async () => {
    if (!formData.id || !formData.name || formData.keywords?.length === 0 || !formData.target_model) {
      showNotification('error', '请填写所有必填字段');
      return;
    }

    try {
      await invoke<string>('router_add_dynamic_rule', {
        rule: formData as DynamicRoutingRule
      });
      showNotification('success', '规则添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      loadRules();
    } catch (error) {
      showNotification('error', `添加规则失败: ${error}`);
    }
  };

  // 更新规则
  const updateRule = async () => {
    if (!editingRule) return;

    try {
      await invoke<string>('router_update_dynamic_rule', {
        rule: formData as DynamicRoutingRule
      });
      showNotification('success', '规则更新成功');
      setEditingRule(null);
      resetForm();
      loadRules();
    } catch (error) {
      showNotification('error', `更新规则失败: ${error}`);
    }
  };

  // 删除规则
  const deleteRule = async (ruleId: string) => {
    if (!confirm('确定要删除这个规则吗？')) return;

    try {
      await invoke<string>('router_delete_dynamic_rule', { ruleId });
      showNotification('success', '规则删除成功');
      loadRules();
    } catch (error) {
      showNotification('error', `删除规则失败: ${error}`);
    }
  };

  // 测试规则匹配
  const testRuleMatch = async () => {
    if (!testText) {
      showNotification('error', '请输入测试文本');
      return;
    }

    try {
      const matched = await invoke<DynamicRoutingRule | null>('router_match_dynamic_rule', {
        text: testText
      });
      setMatchedRule(matched);
      if (matched) {
        showNotification('success', `匹配到规则: ${matched.name}`);
      } else {
        showNotification('info', '没有匹配到任何规则');
      }
    } catch (error) {
      showNotification('error', `测试失败: ${error}`);
    }
  };

  // 切换规则启用状态
  const toggleRuleEnabled = async (rule: DynamicRoutingRule) => {
    try {
      const updatedRule = { ...rule, enabled: !rule.enabled };
      await invoke<string>('router_update_dynamic_rule', { rule: updatedRule });
      loadRules();
    } catch (error) {
      showNotification('error', `切换规则状态失败: ${error}`);
    }
  };

  // 添加关键词
  const addKeyword = () => {
    if (keywordInput && !formData.keywords?.includes(keywordInput)) {
      setFormData(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), keywordInput]
      }));
      setKeywordInput('');
    }
  };

  // 删除关键词
  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords?.filter(k => k !== keyword) || []
    }));
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      keywords: [],
      target_model: '',
      priority: 1,
      enabled: true,
    });
    setKeywordInput('');
  };

  // 开始编辑
  const startEdit = (rule: DynamicRoutingRule) => {
    setEditingRule(rule);
    setFormData(rule);
  };

  useEffect(() => {
    loadRules();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>动态路由规则</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加规则
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadRules}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '刷新'
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 通知显示 */}
        {notification && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            notification.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
          }`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
             <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{notification.message}</span>
          </div>
        )}
        
        {/* 测试区域 */}
        <div className="mb-6 p-4 border rounded-lg bg-muted/50">
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="输入文本测试规则匹配..."
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testRuleMatch} size="sm">
              <Search className="w-4 h-4 mr-1" />
              测试匹配
            </Button>
          </div>
          {matchedRule && (
            <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
              <span className="text-sm">匹配规则: </span>
              <Badge variant="default">{matchedRule.name}</Badge>
              <span className="text-sm ml-2">→ {matchedRule.target_model}</span>
            </div>
          )}
        </div>

        {/* 规则列表 */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无动态路由规则
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant="secondary">优先级: {rule.priority}</Badge>
                      {!rule.enabled && (
                        <Badge variant="outline">已禁用</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>关键词: </span>
                      {rule.keywords.map((kw, idx) => (
                        <Badge key={idx} variant="outline" className="mr-1 mb-1">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      目标模型: <code className="px-1 py-0.5 bg-muted rounded">{rule.target_model}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRuleEnabled(rule)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(rule)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* 添加规则对话框 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>添加动态路由规则</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>规则ID</Label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="rule_id"
                />
              </div>
              <div>
                <Label>规则名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="规则名称"
                />
              </div>
              <div>
                <Label>关键词</Label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="输入关键词"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <Button onClick={addKeyword} size="sm">添加</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.keywords?.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(kw)}
                    >
                      {kw} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>目标模型</Label>
                <Input
                  value={formData.target_model}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_model: e.target.value }))}
                  placeholder="provider,model"
                />
              </div>
              <div>
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  min="1"
                  max="100"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>启用规则</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={addRule}>
                添加规则
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑规则对话框 */}
        <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>编辑动态路由规则</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>规则ID</Label>
                <Input
                  value={formData.id}
                  disabled
                  placeholder="rule_id"
                />
              </div>
              <div>
                <Label>规则名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="规则名称"
                />
              </div>
              <div>
                <Label>关键词</Label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="输入关键词"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <Button onClick={addKeyword} size="sm">添加</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.keywords?.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(kw)}
                    >
                      {kw} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>目标模型</Label>
                <Input
                  value={formData.target_model}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_model: e.target.value }))}
                  placeholder="provider,model"
                />
              </div>
              <div>
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  min="1"
                  max="100"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>启用规则</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRule(null)}>
                取消
              </Button>
              <Button onClick={updateRule}>
                更新规则
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}