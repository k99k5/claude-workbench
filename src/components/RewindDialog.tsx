import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  MessageSquare,
  FileCode,
  GitBranch,
  Clock,
  FileEdit,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Checkpoint } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface RewindDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  projectId: string;
  projectPath: string;
  currentMessageIndex?: number;
  onRestoreComplete?: () => void;
}

type RestoreMode = 'conversation_only' | 'code_only' | 'both';

interface RestoreModeOption {
  value: RestoreMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * Rewind Dialog Component
 * Allows users to restore checkpoints with three different modes:
 * - Conversation only: Restore messages, keep code
 * - Code only: Restore files, keep conversation
 * - Both: Full restore
 */
export const RewindDialog: React.FC<RewindDialogProps> = ({
  isOpen,
  onClose,
  sessionId,
  projectId,
  projectPath,
  onRestoreComplete
}) => {
  const { t } = useTranslation();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('both');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restoreModeOptions: RestoreModeOption[] = [
    {
      value: 'conversation_only',
      label: '仅对话',
      description: '恢复对话历史，保留当前代码更改',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20'
    },
    {
      value: 'code_only',
      label: '仅代码',
      description: '恢复代码文件，保留当前对话历史',
      icon: <FileCode className="w-5 h-5" />,
      color: 'bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20'
    },
    {
      value: 'both',
      label: '完全恢复',
      description: '同时恢复对话和代码到选定检查点',
      icon: <RotateCcw className="w-5 h-5" />,
      color: 'bg-purple-500/10 text-purple-600 border-purple-200 hover:bg-purple-500/20'
    }
  ];

  // Load checkpoints when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCheckpoints();
    }
  }, [isOpen, sessionId, projectId, projectPath]);

  const loadCheckpoints = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const checkpointList = await api.listCheckpoints(sessionId, projectId, projectPath);
      setCheckpoints(checkpointList);

      // Auto-select the most recent checkpoint
      if (checkpointList.length > 0) {
        setSelectedCheckpoint(checkpointList[0]);
      }
    } catch (err) {
      console.error("Failed to load checkpoints:", err);
      setError(t('common.failedToLoadTimeline'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedCheckpoint) return;

    try {
      setIsRestoring(true);
      setError(null);

      console.log('[RewindDialog] Starting restore process...');

      // CRITICAL: First create a checkpoint of current state (safety mechanism)
      console.log('[RewindDialog] Creating safety checkpoint before restore...');
      try {
        await api.createCheckpoint(
          sessionId,
          projectId,
          projectPath,
          undefined, // current message index
          `恢复前自动保存 (${new Date().toLocaleString('zh-CN')})`
        );
        console.log('[RewindDialog] Safety checkpoint created successfully');
      } catch (checkpointErr) {
        console.error('[RewindDialog] Failed to create safety checkpoint:', checkpointErr);
        // Continue anyway - user may want to restore even if safety checkpoint fails
      }

      // Now perform the actual restore
      console.log(`[RewindDialog] Restoring checkpoint ${selectedCheckpoint.id} with mode: ${restoreMode}`);
      await api.restoreCheckpoint(
        selectedCheckpoint.id,
        sessionId,
        projectId,
        projectPath,
        restoreMode
      );
      console.log('[RewindDialog] Checkpoint restored successfully');

      // Notify parent component to reload
      if (onRestoreComplete) {
        onRestoreComplete();
      }

      // Close dialog
      onClose();
    } catch (err) {
      console.error("[RewindDialog] Failed to restore checkpoint:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`${t('common.failedToRestoreCheckpoint')}: ${errorMessage}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    if (!isRestoring) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            恢复到检查点
          </DialogTitle>
          <DialogDescription>
            选择一个检查点和恢复模式。恢复前会自动创建当前状态的检查点。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Checkpoint List */}
          <div className="flex-1 overflow-hidden">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              可用检查点 ({checkpoints.length})
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">加载检查点...</div>
              </div>
            ) : checkpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">{t('common.noCheckpointsYet')}</p>
              </div>
            ) : (
              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-2 space-y-2">
                  {checkpoints.map((checkpoint) => (
                    <CheckpointCard
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      isSelected={selectedCheckpoint?.id === checkpoint.id}
                      onClick={() => setSelectedCheckpoint(checkpoint)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Restore Mode Selection */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">恢复模式</h3>
            <div className="grid grid-cols-3 gap-3">
              {restoreModeOptions.map((option) => (
                <RestoreModeButton
                  key={option.value}
                  option={option}
                  selected={restoreMode === option.value}
                  onClick={() => setRestoreMode(option.value)}
                />
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRestoring}
          >
            取消
          </Button>
          <Button
            onClick={handleRestore}
            disabled={!selectedCheckpoint || isRestoring}
            className="gap-2"
          >
            {isRestoring ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                恢复中...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                恢复
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Checkpoint Card Component
 */
interface CheckpointCardProps {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onClick: () => void;
}

const CheckpointCard: React.FC<CheckpointCardProps> = ({
  checkpoint,
  isSelected,
  onClick
}) => {
  return (
    <motion.div
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "bg-primary/5 border-primary shadow-sm"
          : "bg-background hover:bg-muted/50 border-border"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium truncate">
              {checkpoint.description || `检查点 ${checkpoint.id.slice(0, 8)}`}
            </h4>
            {isSelected && (
              <Badge variant="default" className="text-xs">
                已选择
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(checkpoint.timestamp), {
                      addSuffix: true,
                      locale: zhCN
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {new Date(checkpoint.timestamp).toLocaleString('zh-CN')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="flex items-center gap-1">
              <FileEdit className="w-3 h-3" />
              {checkpoint.metadata.fileChanges} 文件
            </span>

            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              消息 #{checkpoint.messageIndex}
            </span>
          </div>

          {checkpoint.metadata.userPrompt && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {checkpoint.metadata.userPrompt}
            </p>
          )}
        </div>

        {isSelected && (
          <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
        )}
      </div>
    </motion.div>
  );
};

/**
 * Restore Mode Button Component
 */
interface RestoreModeButtonProps {
  option: RestoreModeOption;
  selected: boolean;
  onClick: () => void;
}

const RestoreModeButton: React.FC<RestoreModeButtonProps> = ({
  option,
  selected,
  onClick
}) => {
  return (
    <motion.button
      className={cn(
        "p-4 rounded-lg border-2 text-left transition-all",
        selected
          ? option.color.replace('hover:', '') + ' border-current'
          : "bg-background border-border hover:bg-muted/50"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-md",
          selected ? "bg-current/10" : "bg-muted"
        )}>
          {option.icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm mb-1">{option.label}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {option.description}
          </p>
        </div>
      </div>
    </motion.button>
  );
};
