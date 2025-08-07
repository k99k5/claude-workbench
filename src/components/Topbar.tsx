import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Settings, BarChart3, Network, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaudeStatusIndicator } from "@/components/ClaudeStatusIndicator";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface TopbarProps {
  /**
   * Callback when CLAUDE.md is clicked
   */
  onClaudeClick: () => void;
  /**
   * Callback when Settings is clicked
   */
  onSettingsClick: () => void;
  /**
   * Callback when Usage Dashboard is clicked
   */
  onUsageClick: () => void;
  /**
   * Callback when MCP is clicked
   */
  onMCPClick: () => void;
  /**
   * Callback when Router is clicked
   */
  onRouterClick: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Topbar component with status indicator and navigation buttons
 * 
 * @example
 * <Topbar
 *   onClaudeClick={() => setView('editor')}
 *   onSettingsClick={() => setView('settings')}
 *   onUsageClick={() => setView('usage-dashboard')}
 *   onMCPClick={() => setView('mcp')}
 * />
 */
export const Topbar: React.FC<TopbarProps> = ({
  onClaudeClick,
  onSettingsClick,
  onUsageClick,
  onMCPClick,
  onRouterClick,
  className,
}) => {
  const { t } = useTranslation();
  
  // Memoize the status indicator to prevent recreation on every render
  const statusIndicator = useMemo(
    () => <ClaudeStatusIndicator onSettingsClick={onSettingsClick} />,
    [onSettingsClick]
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {/* Status Indicator */}
      {statusIndicator}
      
      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUsageClick}
          className="text-xs"
        >
          <BarChart3 className="mr-2 h-3 w-3" />
          {t('navigation.usage')}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClaudeClick}
          className="text-xs"
        >
          <FileText className="mr-2 h-3 w-3" />
          CLAUDE.md
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onMCPClick}
          className="text-xs"
        >
          <Network className="mr-2 h-3 w-3" />
          {t('navigation.mcpManager')}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onRouterClick}
          className="text-xs"
        >
          <Route className="mr-2 h-3 w-3" />
          智能路由
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          className="text-xs"
        >
          <Settings className="mr-2 h-3 w-3" />
          {t('navigation.settings')}
        </Button>
      </div>
    </motion.div>
  );
}; 