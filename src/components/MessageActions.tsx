import React, { useState } from "react";
import {
  MoreVertical,
  Undo,
  Edit,
  Trash2,
  Scissors
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface MessageActionsProps {
  messageIndex: number;
  messageType: "user" | "assistant";
  messageContent: string;
  sessionId: string | null;
  projectId: string | null;
  projectPath: string | null;
  onUndo?: (messageIndex: number) => Promise<void>;
  onEdit?: (messageIndex: number, newContent: string) => Promise<void>;
  onDelete?: (messageIndex: number) => Promise<void>;
  onTruncate?: (messageIndex: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * Message action buttons (undo, edit, delete, truncate)
 * Displayed in each message card for fine-grained control
 */
export const MessageActions: React.FC<MessageActionsProps> = ({
  messageIndex,
  messageType,
  messageContent,
  onUndo,
  onEdit,
  onDelete,
  onTruncate,
  disabled = false
}) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState(messageContent);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUndo = async () => {
    if (!onUndo || isProcessing) return;
    try {
      setIsProcessing(true);
      await onUndo(messageIndex);
    } catch (error) {
      console.error("Failed to undo message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!onEdit || isProcessing) return;
    try {
      setIsProcessing(true);
      await onEdit(messageIndex, editContent);
      setShowEditDialog(false);
    } catch (error) {
      console.error("Failed to edit message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isProcessing) return;
    if (!confirm(`确定要删除消息 #${messageIndex}吗？此操作会创建安全检查点。`)) {
      return;
    }
    try {
      setIsProcessing(true);
      await onDelete(messageIndex);
    } catch (error) {
      console.error("Failed to delete message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTruncate = async () => {
    if (!onTruncate || isProcessing) return;
    if (!confirm(`确定要截断到消息 #${messageIndex} 吗？此操作会删除之后的所有消息。`)) {
      return;
    }
    try {
      setIsProcessing(true);
      await onTruncate(messageIndex);
    } catch (error) {
      console.error("Failed to truncate messages:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditDialog = () => {
    setEditContent(messageContent);
    setShowEditDialog(true);
  };

  // Only show actions for user messages
  if (messageType !== "user") {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={disabled || isProcessing}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleUndo}
            disabled={disabled || isProcessing}
            className="cursor-pointer"
          >
            <Undo className="mr-2 h-4 w-4" />
            撤销此消息
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={openEditDialog}
            disabled={disabled || isProcessing}
            className="cursor-pointer"
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑并重新生成
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleTruncate}
            disabled={disabled || isProcessing}
            className="cursor-pointer"
          >
            <Scissors className="mr-2 h-4 w-4" />
            截断到此处
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDelete}
            disabled={disabled || isProcessing}
            className="cursor-pointer text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除此消息
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑消息</DialogTitle>
            <DialogDescription>
              修改此消息并从此处重新生成对话。原始对话将作为检查点保存。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-content">消息内容</Label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="输入新的消息内容..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isProcessing}
            >
              取消
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isProcessing || !editContent.trim()}
            >
              {isProcessing ? "处理中..." : "保存并重新生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
