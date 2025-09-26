import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, BarChart3, PieChart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CostDashboard } from './CostDashboard';
import { SessionCostTracker } from './SessionCostTracker';
import { UsageDashboard } from './UsageDashboard';

interface CostAnalyticsPageProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
  /**
   * Optional session ID for focused analysis
   */
  sessionId?: string;
  /**
   * Optional project path for scoped analysis
   */
  projectPath?: string;
}

/**
 * CostAnalyticsPage component - Comprehensive cost analytics interface
 *
 * Combines multiple cost analysis components into a unified dashboard:
 * - Real-time cost monitoring
 * - Historical usage analytics
 * - Session-specific tracking
 * - Project-scoped analysis
 * - Cost trends and projections
 */
export const CostAnalyticsPage: React.FC<CostAnalyticsPageProps> = ({
  onBack,
  sessionId,
  projectPath
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showSessionTracker, setShowSessionTracker] = useState(!!sessionId);

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
              <h1 className="text-lg font-semibold">成本分析中心</h1>
              <p className="text-xs text-muted-foreground">
                全面的成本监控、分析和优化平台
              </p>
            </div>
          </div>

          {sessionId && (
            <div className="flex items-center space-x-2">
              <Button
                variant={showSessionTracker ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSessionTracker(!showSessionTracker)}
                className="text-xs"
              >
                {showSessionTracker ? "隐藏会话追踪" : "显示会话追踪"}
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                实时监控
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                详细分析
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                使用统计
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                历史趋势
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Real-time Monitoring Tab */}
            <TabsContent value="overview" className="h-full p-0">
              <div className="h-full p-6">
                <CostDashboard
                  sessionId={sessionId}
                  projectPath={projectPath}
                  realTime={true}
                  className="h-full"
                />
              </div>
            </TabsContent>

            {/* Detailed Analytics Tab */}
            <TabsContent value="analytics" className="h-full p-0">
              <div className="h-full p-6">
                <CostDashboard
                  sessionId={sessionId}
                  projectPath={projectPath}
                  realTime={false}
                  className="h-full"
                />
              </div>
            </TabsContent>

            {/* Usage Statistics Tab */}
            <TabsContent value="usage" className="h-full p-0">
              <div className="h-full">
                <UsageDashboard onBack={() => setActiveTab('overview')} />
              </div>
            </TabsContent>

            {/* Historical Trends Tab */}
            <TabsContent value="history" className="h-full p-0">
              <div className="h-full p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">历史趋势分析</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    这里将显示长期的成本趋势、使用模式分析和预测功能。
                    目前可以在"使用统计"标签中查看基本的历史数据。
                  </p>
                </motion.div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Session Cost Tracker Overlay */}
      {showSessionTracker && sessionId && (
        <SessionCostTracker
          sessionId={sessionId}
          detailed={true}
          autoHide={300} // Hide after 5 minutes of inactivity
          position="bottom-right"
        />
      )}
    </div>
  );
};