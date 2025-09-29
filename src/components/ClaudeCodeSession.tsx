import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  FolderOpen,
  Copy,
  ChevronDown,
  GitBranch,
  Settings,
  ChevronUp,
  X,
  Command,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Session } from "@/lib/api";
import { cn, normalizeUsageData } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { StreamMessage } from "./StreamMessage";
import { FloatingPromptInput, type FloatingPromptInputRef } from "./FloatingPromptInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { TimelineNavigator } from "./TimelineNavigator";
import { CheckpointSettings } from "./CheckpointSettings";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SplitPane } from "@/components/ui/split-pane";
import { WebviewPreview } from "./WebviewPreview";
import type { ClaudeStreamMessage } from "./AgentExecution";
import { translationMiddleware, isSlashCommand, type TranslationResult } from '@/lib/translationMiddleware';
import { progressiveTranslationManager, TranslationPriority, type TranslationState } from '@/lib/progressiveTranslation';
import { useVirtualizer } from "@tanstack/react-virtual";
import { tokenExtractor } from '@/lib/tokenExtractor';

interface ClaudeCodeSessionProps {
  /**
   * Optional session to resume (when clicking from SessionList)
   */
  session?: Session;
  /**
   * Initial project path (for new sessions)
   */
  initialProjectPath?: string;
  /**
   * Callback to go back
   */
  onBack: () => void;
  /**
   * Callback to open hooks configuration
   */
  onProjectSettings?: (projectPath: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when streaming state changes
   */
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  /**
   * Whether this session is currently active (for event listener management)
   */
  isActive?: boolean;
}

/**
 * ClaudeCodeSession component for interactive Claude Code sessions
 * 
 * @example
 * <ClaudeCodeSession onBack={() => setView('projects')} />
 */
export const ClaudeCodeSession: React.FC<ClaudeCodeSessionProps> = ({
  session,
  initialProjectPath = "",
  onBack,
  onProjectSettings,
  className,
  onStreamingChange,
  isActive = true, // 默认为活跃状态，保持向后兼容
}) => {
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session); // Key state for session continuation
  // const [totalTokens, setTotalTokens] = useState(0); // Removed token counter from header
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{ sessionId: string; projectId: string } | null>(null);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showSlashCommandsSettings, setShowSlashCommandsSettings] = useState(false);
  const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
  const [forkSessionName, setForkSessionName] = useState("");

  // Queued prompts state
  const [queuedPrompts, setQueuedPrompts] = useState<Array<{ id: string; prompt: string; model: "sonnet" | "opus" | "sonnet1m" }>>([]);

  // Calculate session cost
  const sessionCost = useMemo(() => {
    if (messages.length === 0) return 0;

    let totalCost = 0;
    const relevantMessages = messages.filter(m => m.type === 'assistant' || m.type === 'user');

    relevantMessages.forEach(message => {
      const tokens = tokenExtractor.extract(message);
      // const model = (message as any).model || 'claude-3-5-sonnet-20241022';

      // Simple cost calculation (per 1M tokens)
      const pricing = {
        input: 3.00,
        output: 15.00,
        cache_write: 3.75,
        cache_read: 0.30
      };

      const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
      const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
      const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cache_write;
      const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cache_read;

      totalCost += inputCost + outputCost + cacheWriteCost + cacheReadCost;
    });

    return totalCost;
  }, [messages.length]);

  // Format cost display
  const formatCost = (amount: number): string => {
    if (amount === 0) return '$0.00';
    if (amount < 0.01) {
      return `$${(amount * 100).toFixed(3)}¢`;
    }
    return `$${amount.toFixed(4)}`;
  };

  // Progressive translation state
  const [translationStates, setTranslationStates] = useState<TranslationState>({});
  const [translationEnabled, setTranslationEnabled] = useState<boolean>(false);
  // Settings state to avoid repeated loading in StreamMessage components
  const [claudeSettings, setClaudeSettings] = useState<{ showSystemInitialization?: boolean }>({});

  // Debug logging for translation states - TODO: Use in UI components
  React.useEffect(() => {
    if (Object.keys(translationStates).length > 0) {
      console.debug('[ClaudeCodeSession] Translation states updated:', Object.keys(translationStates).length, 'messages');
    }
  }, [translationStates]);

  React.useEffect(() => {
    console.debug('[ClaudeCodeSession] Translation enabled state:', translationEnabled);
  }, [translationEnabled]);

  // New state for preview feature
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  
  // Translation state
  const [lastTranslationResult, setLastTranslationResult] = useState<TranslationResult | null>(null);
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  
  // Add collapsed state for queued prompts
  const [queuedPromptsCollapsed, setQueuedPromptsCollapsed] = useState(false);
  
  
  // Enhanced scroll management
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPositionRef = useRef(0);
  
  const parentRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const hasActiveSessionRef = useRef(false);
  const floatingPromptRef = useRef<FloatingPromptInputRef>(null);
  const queuedPromptsRef = useRef<Array<{ id: string; prompt: string; model: "sonnet" | "opus" | "sonnet1m" }>>([]);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);
  const handleSendPromptRef = useRef<((prompt: string, model: "sonnet" | "opus" | "sonnet1m", thinkingInstruction?: string) => Promise<void>) | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);


  // Get effective session info (from prop or extracted) - use useMemo to ensure it updates
  const effectiveSession = useMemo(() => {
    if (session) return session;
    if (extractedSessionInfo) {
      return {
        id: extractedSessionInfo.sessionId,
        project_id: extractedSessionInfo.projectId,
        project_path: projectPath,
        created_at: Date.now(),
      } as Session;
    }
    return null;
  }, [session, extractedSessionInfo, projectPath]);

  // Filter out messages that shouldn't be displayed
  const displayableMessages = useMemo(() => {
    return messages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // Skip user messages that only contain tool results that are already displayed
      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }

        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            }
            if (content.type === "tool_result") {
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Look for the matching tool_use in previous assistant messages
                for (let i = index - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => 
                      c.type === 'tool_use' && c.id === content.tool_use_id
                    );
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = [
                        'task', 'edit', 'multiedit', 'todowrite', 'ls', 'read', 
                        'glob', 'bash', 'write', 'grep'
                      ];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }
              if (!willBeSkipped) {
                hasVisibleContent = true;
                break;
              }
            }
          }
          if (!hasVisibleContent) {
            return false;
          }
        }
      }
      return true;
    });
  }, [messages]);

  const rowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 增加估计高度，减少重复测量
    overscan: 8, // 增加 overscan 确保流畅滚动
    measureElement: (element) => {
      // 确保元素完全渲染后再测量
      return element?.getBoundingClientRect().height ?? 200;
    },
  });

  // Debug logging
  useEffect(() => {
    console.log('[ClaudeCodeSession] State update:', {
      projectPath,
      session,
      extractedSessionInfo,
      effectiveSession,
      messagesCount: messages.length,
      isLoading
    });
  }, [projectPath, session, extractedSessionInfo, effectiveSession, messages.length, isLoading]);


  // Load session history if resuming
  useEffect(() => {
    if (session) {
      // Set the claudeSessionId immediately when we have a session
      setClaudeSessionId(session.id);

      // Load session history first, then check for active session
      const initializeSession = async () => {
        await loadSessionHistory();
        // After loading history, check if the session is still active
        if (isMountedRef.current) {
          await checkForActiveSession();
        }
      };

      initializeSession();
    }
  }, [session]); // Remove hasLoadedSession dependency to ensure it runs on mount

  // Load Claude settings once for all StreamMessage components
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getClaudeSettings();
        setClaudeSettings(settings);
      } catch (error) {
        console.error("Failed to load Claude settings:", error);
        setClaudeSettings({ showSystemInitialization: true }); // Default fallback
      }
    };

    loadSettings();
  }, []);

  // Report streaming state changes
  useEffect(() => {
    onStreamingChange?.(isLoading, claudeSessionId);
  }, [isLoading, claudeSessionId, onStreamingChange]);

  // 🔧 NEW: Handle active/inactive state changes for event listener management
  useEffect(() => {
    if (!isActive && isListeningRef.current) {
      // Tab became inactive, clean up event listeners to prevent conflicts
      console.log('[ClaudeCodeSession] Tab became inactive, cleaning up event listeners');
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];
      isListeningRef.current = false;
    }
    // Note: When tab becomes active, listeners will be set up by handleSendPrompt
  }, [isActive]);

  // Smart scroll detection - detect when user manually scrolls
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const currentScrollPosition = scrollTop;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
      
      // Detect if this was a user-initiated scroll
      const scrollDifference = Math.abs(currentScrollPosition - lastScrollPositionRef.current);
      if (scrollDifference > 5) { // Only count significant scroll movements
        const wasUserScroll = !shouldAutoScroll || scrollDifference > 100;
        
        if (wasUserScroll) {
          setUserScrolled(!isAtBottom);
          setShouldAutoScroll(isAtBottom);
        }
      }
      
      lastScrollPositionRef.current = currentScrollPosition;
      
      // Reset user scroll state after inactivity
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (isAtBottom) {
          setUserScrolled(false);
          setShouldAutoScroll(true);
        }
      }, 2000);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [shouldAutoScroll]);

  // Smart auto-scroll for new messages
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayableMessages.length, shouldAutoScroll, userScrolled]);

  // Enhanced streaming scroll - only when user hasn't manually scrolled away
  useEffect(() => {
    if (isLoading && displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const scrollToBottom = () => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      };

      // More frequent updates during streaming for better UX
      const intervalId = setInterval(scrollToBottom, 300);
      
      return () => clearInterval(intervalId);
    }
  }, [isLoading, displayableMessages.length, shouldAutoScroll, userScrolled]);

  // Token calculation removed - no longer displayed in header
  // useEffect(() => {
  //   try {
  //     if (messages.length > 0) {
  //       const totalTokens = tokenExtractor.sessionTotal(messages);
  //       setTotalTokens(totalTokens.total_tokens);
  //       console.log('[ClaudeCodeSession] 📊 Enhanced token calculation:', {
  //         messages: messages.length,
  //         totalTokens: totalTokens.total_tokens,
  //         efficiency: totalTokens.cache_read_tokens > 0 ? `${((totalTokens.cache_read_tokens / totalTokens.total_tokens) * 100).toFixed(1)}% cached` : 'no cache'
  //       });
  //     } else {
  //       setTotalTokens(0);
  //     }
  //   } catch (err) {
  //     console.error('[ClaudeCodeSession] Error in enhanced token calculation:', err);
  //     setTotalTokens(0);
  //   }
  // }, [messages]);

  const loadSessionHistory = async () => {
    if (!session) return;

    try {
      setIsLoading(true);
      setError(null);

      const history = await api.loadSessionHistory(session.id, session.project_id);

      // Convert history to messages format
      const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
        ...entry,
        type: entry.type || "assistant"
      }));

      // ✨ NEW: Normalize usage data for historical messages
      const processedMessages = loadedMessages.map(msg => {
        if (msg.message?.usage) {
          msg.message.usage = normalizeUsageData(msg.message.usage);
        }
        return msg;
      });

      // ✨ NEW: Immediate display - no more blocking on translation
      console.log('[ClaudeCodeSession] 🚀 Displaying messages immediately:', loadedMessages.length);
      setMessages(processedMessages);

      // ✨ NEW: Start progressive translation in background
      initializeProgressiveTranslation(processedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));

      // After loading history, we're continuing a conversation
    } catch (err) {
      console.error("Failed to load session history:", err);
      setError("加载会话历史记录失败");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Translate historical messages using the same logic as real-time messages
   */
  /**
   * Process a message with translation - shared logic for both real-time and reconnect scenarios
   */
  const processMessageWithTranslation = async (message: ClaudeStreamMessage, payload: string, currentTranslationResult?: TranslationResult) => {
    try {
      // Don't process if component unmounted
      if (!isMountedRef.current) return;

      // Add received timestamp for non-user messages
      if (message.type !== "user") {
        message.receivedAt = new Date().toISOString();
      }

      // 🌐 Translation: Process Claude response
      let processedMessage = { ...message };

      try {
        const isEnabled = await translationMiddleware.isEnabled();

        // 使用传递的翻译结果或状态中的结果
        const effectiveTranslationResult = currentTranslationResult || lastTranslationResult;

        console.log('[ClaudeCodeSession] Translation debug:', {
          isEnabled,
          hasCurrentResult: !!currentTranslationResult,
          hasStateResult: !!lastTranslationResult,
          hasEffectiveResult: !!effectiveTranslationResult,
          messageType: message.type,
          messageContent: message.content ? 'has content' : 'no content'
        });

        // 🔧 EXPANDED MESSAGE TYPE SUPPORT: Cover all possible Claude Code response types
        const isClaudeResponse = message.type === "assistant" ||
                               message.type === "result" ||
                               (message.type === "system" && message.subtype !== "init") ||
                               // Handle any message with actual content regardless of type
                               !!(message.content || message.message?.content || (message as any).text || (message as any).result || (message as any).summary || (message as any).error);

        if (isEnabled && isClaudeResponse) {
          console.log('[ClaudeCodeSession] Found Claude response message, checking translation conditions...');

          // 🌟 Enhanced Translation Strategy: Always translate English content when translation is enabled
          // This ensures comprehensive coverage of all Claude outputs, tool results, and system messages

          // 🌟 COMPREHENSIVE CONTENT EXTRACTION STRATEGY
          // This ensures we capture ALL possible text content from Claude Code SDK responses
          let textContent = '';
          let contentSources: string[] = [];

          // Method 1: Direct content string
          if (typeof message.content === 'string' && message.content.trim()) {
            textContent = message.content;
            contentSources.push('direct_content');
          }
          // Method 2: Array content (Claude API format)
          else if (Array.isArray(message.content)) {
            const arrayContent = message.content
              .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item.type === 'text') return item.text || '';
                return item.content || item.text || '';
              })
              .join('\n');
            if (arrayContent.trim()) {
              textContent = arrayContent;
              contentSources.push('array_content');
            }
          }
          // Method 3: Object with text property
          else if (message.content?.text && typeof message.content.text === 'string') {
            textContent = message.content.text;
            contentSources.push('content_text');
          }
          // Method 4: Nested in message.content (Claude Code SDK primary format)
          else if (message.message?.content) {
            const messageContent: any = message.message.content;
            if (typeof messageContent === 'string' && messageContent.trim()) {
              textContent = messageContent;
              contentSources.push('message_content_string');
            } else if (Array.isArray(messageContent)) {
              const nestedContent = messageContent
                .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
                .map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (item.type === 'text') return item.text || '';
                  return item.content || item.text || '';
                })
                .join('\n');
              if (nestedContent.trim()) {
                textContent = nestedContent;
                contentSources.push('message_content_array');
              }
            }
          }

          // Method 5: Direct text property
          if (!textContent && (message as any).text && typeof (message as any).text === 'string') {
            textContent = (message as any).text;
            contentSources.push('direct_text');
          }

          // Method 6: Result field (for result-type messages)
          if (!textContent && (message as any).result && typeof (message as any).result === 'string') {
            textContent = (message as any).result;
            contentSources.push('result_field');
          }

          // Method 7: Error field (for error messages)
          if (!textContent && (message as any).error && typeof (message as any).error === 'string') {
            textContent = (message as any).error;
            contentSources.push('error_field');
          }

          // Method 8: Summary field (for summary messages)
          if (!textContent && (message as any).summary && typeof (message as any).summary === 'string') {
            textContent = (message as any).summary;
            contentSources.push('summary_field');
          }

          console.log('[ClaudeCodeSession] Content extraction results:', {
            textContentLength: textContent.length,
            contentSources,
            messageType: message.type,
            hasMessageContent: !!message.message?.content,
            textPreview: textContent.substring(0, 100)
          });

          if (textContent.trim()) {
            console.log('[ClaudeCodeSession] 🔄 Processing content for translation...', {
              contentLength: textContent.length,
              messageType: message.type,
              preview: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '')
            });

            // Attempt translation - the middleware will handle language detection and decide whether to translate
            const responseTranslation = await translationMiddleware.translateClaudeResponse(textContent);

            if (responseTranslation.wasTranslated) {
                console.log('[ClaudeCodeSession] ✅ Claude response translated:', {
                  original: responseTranslation.originalText.substring(0, 50) + '...',
                  translated: responseTranslation.translatedText.substring(0, 50) + '...',
                  detectedLanguage: responseTranslation.detectedLanguage
                });

                // 🔧 COMPREHENSIVE MESSAGE UPDATE STRATEGY
                // Update the message content based on where we found the original content
                console.log('[ClaudeCodeSession] Updating message content with translation using sources:', contentSources);

                // Update based on the content source that was found
                const primarySource = contentSources[0];

                switch (primarySource) {
                  case 'direct_content':
                    processedMessage.content = responseTranslation.translatedText;
                    console.log('[ClaudeCodeSession] ✅ Updated direct content');
                    break;

                  case 'array_content':
                    if (Array.isArray(message.content)) {
                      processedMessage.content = message.content.map((item: any) => {
                        if (item && (item.type === 'text' || typeof item === 'string')) {
                          return typeof item === 'string'
                            ? { type: 'text', text: responseTranslation.translatedText }
                            : { ...item, text: responseTranslation.translatedText };
                        }
                        return item;
                      });
                      console.log('[ClaudeCodeSession] ✅ Updated array content');
                    }
                    break;

                  case 'content_text':
                    processedMessage.content = {
                      ...message.content,
                      text: responseTranslation.translatedText
                    };
                    console.log('[ClaudeCodeSession] ✅ Updated content.text');
                    break;

                  case 'message_content_string':
                    if (message.message) {
                      processedMessage.message = {
                        ...message.message,
                        content: [{ type: 'text', text: responseTranslation.translatedText }]
                      };
                      console.log('[ClaudeCodeSession] ✅ Updated message.content string');
                    }
                    break;

                  case 'message_content_array':
                    if (message.message?.content && Array.isArray(message.message.content)) {
                      processedMessage.message = {
                        ...message.message,
                        content: message.message.content.map((item: any) => {
                          if (item && (item.type === 'text' || typeof item === 'string')) {
                            return typeof item === 'string'
                              ? { type: 'text', text: responseTranslation.translatedText }
                              : { ...item, text: responseTranslation.translatedText };
                          }
                          return item;
                        })
                      };
                      console.log('[ClaudeCodeSession] ✅ Updated message.content array');
                    }
                    break;

                  case 'direct_text':
                    (processedMessage as any).text = responseTranslation.translatedText;
                    console.log('[ClaudeCodeSession] ✅ Updated direct text');
                    break;

                  case 'result_field':
                    (processedMessage as any).result = responseTranslation.translatedText;
                    console.log('[ClaudeCodeSession] ✅ Updated result field');
                    break;

                  case 'error_field':
                    (processedMessage as any).error = responseTranslation.translatedText;
                    console.log('[ClaudeCodeSession] ✅ Updated error field');
                    break;

                  case 'summary_field':
                    (processedMessage as any).summary = responseTranslation.translatedText;
                    console.log('[ClaudeCodeSession] ✅ Updated summary field');
                    break;

                  default:
                    // Fallback: Create new content structure
                    processedMessage.content = [{
                      type: 'text',
                      text: responseTranslation.translatedText
                    }];
                    console.log('[ClaudeCodeSession] ⚠️ Used fallback content structure');
                }

                // Add translation metadata
                processedMessage.translationMeta = {
                  wasTranslated: responseTranslation.wasTranslated,
                  detectedLanguage: responseTranslation.detectedLanguage,
                  originalText: responseTranslation.originalText
                };

                console.log('[ClaudeCodeSession] Final processed message structure:', {
                  type: processedMessage.type,
                  hasContent: !!processedMessage.content,
                  hasMessage: !!processedMessage.message,
                  messageContentLength: processedMessage.message?.content?.length || 'none'
                });
            }
          }
        }
      } catch (translationError) {
        console.error('[ClaudeCodeSession] Response translation failed:', translationError);
        // Continue with original message if translation fails
      }

      // 🔧 SAFE MESSAGE PROCESSING: Normalize usage data to handle cache token field mapping
      try {
        // Use the standardized usage normalization function to handle field name mapping
        if (processedMessage.message?.usage) {
          processedMessage.message.usage = normalizeUsageData(processedMessage.message.usage);
          console.log('[ClaudeCodeSession] ✅ Normalized message.usage data:', processedMessage.message.usage);
        }
        if (processedMessage.usage) {
          processedMessage.usage = normalizeUsageData(processedMessage.usage);
          console.log('[ClaudeCodeSession] ✅ Normalized top-level usage data:', processedMessage.usage);
        }
        setMessages((prev) => [...prev, processedMessage]);
      } catch (usageError) {
        console.warn('[ClaudeCodeSession] Error normalizing usage data, adding message without usage:', usageError);
        // Remove problematic usage data and add message anyway
        const safeMessage = { ...processedMessage };
        delete safeMessage.usage;
        if (safeMessage.message) {
          delete safeMessage.message.usage;
        }
        setMessages((prev) => [...prev, safeMessage]);
      }
    } catch (err) {
      console.error('Failed to parse message:', err, payload);
    }
  };

  /**
   * Initialize progressive translation for historical messages
   */
  const initializeProgressiveTranslation = async (messages: ClaudeStreamMessage[]): Promise<void> => {
    try {
      // Check if translation is enabled
      const isEnabled = await progressiveTranslationManager.isTranslationEnabled();
      setTranslationEnabled(isEnabled);

      if (!isEnabled) {
        console.log('[ClaudeCodeSession] Progressive translation disabled');
        return;
      }

      console.log('[ClaudeCodeSession] 🔄 Initializing progressive translation for', messages.length, 'messages');

      // Initialize translation states
      const initialStates: TranslationState = {};

      // Get the most recent messages (last 10) for priority translation
      const recentMessages = messages.slice(-10);

      messages.forEach((message, index) => {
        const messageId = `${message.timestamp || Date.now()}_${index}`;

        // Extract text content for translation
        let textContent = extractMessageContent(message);

        if (textContent.trim()) {
          initialStates[messageId] = {
            status: 'original',
            originalContent: textContent,
            translatedContent: undefined
          };

          // Determine priority
          const isRecent = recentMessages.includes(message);
          const priority = isRecent ? TranslationPriority.HIGH : TranslationPriority.NORMAL;

          // Add to translation queue
          progressiveTranslationManager.addTask(
            messageId,
            textContent,
            priority,
            (result) => {
              if (result && result.wasTranslated) {
                handleTranslationComplete(messageId, message, result, index);
              }
            }
          );
        }
      });

      setTranslationStates(initialStates);
      console.log('[ClaudeCodeSession] ✅ Progressive translation initialized:', Object.keys(initialStates).length, 'translatable messages');

    } catch (error) {
      console.error('[ClaudeCodeSession] Failed to initialize progressive translation:', error);
    }
  };

  /**
   * Extract translatable content from a message
   */
  const extractMessageContent = (message: ClaudeStreamMessage): string => {
    // Method 1: Direct content string
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content;
    }

    // Method 2: Array content (Claude API format)
    if (Array.isArray(message.content)) {
      const arrayContent = message.content
        .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text || '';
          return item.content || item.text || '';
        })
        .join('\n');
      if (arrayContent.trim()) {
        return arrayContent;
      }
    }

    // Method 3: Nested in message.content
    if (message.message?.content) {
      const messageContent: any = message.message.content;
      if (typeof messageContent === 'string' && messageContent.trim()) {
        return messageContent;
      } else if (Array.isArray(messageContent)) {
        const nestedContent = messageContent
          .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.type === 'text') return item.text || '';
            return item.content || item.text || '';
          })
          .join('\n');
        if (nestedContent.trim()) {
          return nestedContent;
        }
      }
    }

    // Method 4: Other fields
    if ((message as any).result && typeof (message as any).result === 'string') {
      return (message as any).result;
    }
    if ((message as any).summary && typeof (message as any).summary === 'string') {
      return (message as any).summary;
    }

    return '';
  };

  /**
   * Handle translation completion for a message
   */
  const handleTranslationComplete = (messageId: string, _originalMessage: ClaudeStreamMessage, result: TranslationResult, messageIndex: number) => {
    console.log('[ClaudeCodeSession] ✅ Translation completed for message:', messageId);

    // Update translation state
    setTranslationStates(prev => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        status: 'translated',
        translatedContent: result.translatedText
      }
    }));

    // Update the actual message in the messages array
    setMessages(prevMessages => {
      return prevMessages.map((msg, index) => {
        if (index === messageIndex) {
          // Apply the translation
          return applyTranslationToMessage(msg, result);
        }
        return msg;
      });
    });
  };

  /**
   * Apply translation result to a message
   */
  const applyTranslationToMessage = (message: ClaudeStreamMessage, result: TranslationResult): ClaudeStreamMessage => {
    let processedMessage = { ...message };

    // Apply translation based on the message structure
    if (typeof message.content === 'string') {
      processedMessage.content = result.translatedText;
    } else if (Array.isArray(message.content)) {
      processedMessage.content = message.content.map((item: any) => {
        if (item && (item.type === 'text' || typeof item === 'string')) {
          return typeof item === 'string'
            ? { type: 'text', text: result.translatedText }
            : { ...item, text: result.translatedText };
        }
        return item;
      });
    } else if (message.message?.content) {
      if (typeof message.message.content === 'string') {
        processedMessage.message = {
          ...message.message,
          content: [{ type: 'text', text: result.translatedText }]
        };
      } else if (Array.isArray(message.message.content)) {
        processedMessage.message = {
          ...message.message,
          content: message.message.content.map((item: any) => {
            if (item && (item.type === 'text' || typeof item === 'string')) {
              return typeof item === 'string'
                ? { type: 'text', text: result.translatedText }
                : { ...item, text: result.translatedText };
            }
            return item;
          })
        };
      }
    } else if ((message as any).result) {
      (processedMessage as any).result = result.translatedText;
    } else if ((message as any).summary) {
      (processedMessage as any).summary = result.translatedText;
    }

    return processedMessage;
  };

  // DEPRECATED: Legacy blocking translation function - replaced with progressive translation
  // @ts-ignore - function kept for reference but not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const translateHistoricalMessages = async (messages: ClaudeStreamMessage[]): Promise<ClaudeStreamMessage[]> => {
    try {
      const isEnabled = await translationMiddleware.isEnabled();
      if (!isEnabled) {
        console.log('[ClaudeCodeSession] Translation disabled, returning original historical messages');
        return messages;
      }

      console.log('[ClaudeCodeSession] Processing historical messages for translation');
      const translatedMessages: ClaudeStreamMessage[] = [];

      for (const message of messages) {
        // Only skip system init messages from translation
        if (message.type === "system" && message.subtype === "init") {
          translatedMessages.push(message);
          continue;
        }

        // Apply translation logic to both user messages and Claude responses
        let processedMessage = { ...message };

        // Extract text content using the same comprehensive extraction as real-time
        let textContent = '';
        let contentSources: string[] = [];

        // Method 1: Direct content string
        if (typeof message.content === 'string' && message.content.trim()) {
          textContent = message.content;
          contentSources.push('direct_content');
        }
        // Method 2: Array content (Claude API format)
        else if (Array.isArray(message.content)) {
          const arrayContent = message.content
            .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.type === 'text') return item.text || '';
              return item.content || item.text || '';
            })
            .join('\n');
          if (arrayContent.trim()) {
            textContent = arrayContent;
            contentSources.push('array_content');
          }
        }
        // Method 3: Object with text property
        else if (message.content?.text && typeof message.content.text === 'string') {
          textContent = message.content.text;
          contentSources.push('content_text');
        }
        // Method 4: Nested in message.content (Claude Code SDK primary format)
        else if (message.message?.content) {
          const messageContent: any = message.message.content;
          if (typeof messageContent === 'string' && messageContent.trim()) {
            textContent = messageContent;
            contentSources.push('message_content_string');
          } else if (Array.isArray(messageContent)) {
            const nestedContent = messageContent
              .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item.type === 'text') return item.text || '';
                return item.content || item.text || '';
              })
              .join('\n');
            if (nestedContent.trim()) {
              textContent = nestedContent;
              contentSources.push('message_content_array');
            }
          }
        }

        // Method 5: Other fields
        if (!textContent && (message as any).text && typeof (message as any).text === 'string') {
          textContent = (message as any).text;
          contentSources.push('direct_text');
        }
        if (!textContent && (message as any).result && typeof (message as any).result === 'string') {
          textContent = (message as any).result;
          contentSources.push('result_field');
        }
        if (!textContent && (message as any).summary && typeof (message as any).summary === 'string') {
          textContent = (message as any).summary;
          contentSources.push('summary_field');
        }

        // Apply translation if content found
        if (textContent.trim()) {
          try {
            const responseTranslation = await translationMiddleware.translateClaudeResponse(textContent);

            if (responseTranslation.wasTranslated) {
              console.log('[ClaudeCodeSession] Historical message translated:', {
                sources: contentSources,
                originalLength: textContent.length,
                translatedLength: responseTranslation.translatedText.length
              });

              // Update content based on source, same as real-time logic
              const primarySource = contentSources[0];
              switch (primarySource) {
                case 'direct_content':
                  processedMessage.content = responseTranslation.translatedText;
                  break;
                case 'array_content':
                  if (Array.isArray(message.content)) {
                    processedMessage.content = message.content.map((item: any) => {
                      if (item && (item.type === 'text' || typeof item === 'string')) {
                        return typeof item === 'string'
                          ? { type: 'text', text: responseTranslation.translatedText }
                          : { ...item, text: responseTranslation.translatedText };
                      }
                      return item;
                    });
                  }
                  break;
                case 'content_text':
                  processedMessage.content = {
                    ...message.content,
                    text: responseTranslation.translatedText
                  };
                  break;
                case 'message_content_string':
                  if (message.message) {
                    processedMessage.message = {
                      ...message.message,
                      content: [{ type: 'text', text: responseTranslation.translatedText }]
                    };
                  }
                  break;
                case 'message_content_array':
                  if (message.message?.content && Array.isArray(message.message.content)) {
                    processedMessage.message = {
                      ...message.message,
                      content: message.message.content.map((item: any) => {
                        if (item && (item.type === 'text' || typeof item === 'string')) {
                          return typeof item === 'string'
                            ? { type: 'text', text: responseTranslation.translatedText }
                            : { ...item, text: responseTranslation.translatedText };
                        }
                        return item;
                      })
                    };
                  }
                  break;
                case 'direct_text':
                  (processedMessage as any).text = responseTranslation.translatedText;
                  break;
                case 'result_field':
                  (processedMessage as any).result = responseTranslation.translatedText;
                  break;
                case 'summary_field':
                  (processedMessage as any).summary = responseTranslation.translatedText;
                  break;
              }

              // Add translation metadata
              processedMessage.translationMeta = {
                wasTranslated: responseTranslation.wasTranslated,
                detectedLanguage: responseTranslation.detectedLanguage,
                originalText: responseTranslation.originalText
              };
            }
          } catch (translationError) {
            console.error('[ClaudeCodeSession] Historical message translation failed:', translationError);
            // Continue with original message if translation fails
          }
        }

        // 🔧 CRITICAL FIX: Apply usage data normalization to historical messages
        // This ensures cache tokens are correctly displayed after re-entering session
        try {
          if (processedMessage.message?.usage) {
            processedMessage.message.usage = normalizeUsageData(processedMessage.message.usage);
            console.log('[ClaudeCodeSession] ✅ Normalized historical message.usage data:', processedMessage.message.usage);
          }
          if (processedMessage.usage) {
            processedMessage.usage = normalizeUsageData(processedMessage.usage);
            console.log('[ClaudeCodeSession] ✅ Normalized historical top-level usage data:', processedMessage.usage);
          }
        } catch (usageNormalizationError) {
          console.warn('[ClaudeCodeSession] Failed to normalize usage data for historical message:', usageNormalizationError);
          // Continue with message even if normalization fails
        }

        translatedMessages.push(processedMessage);
      }

      console.log('[ClaudeCodeSession] Historical message translation complete');
      return translatedMessages;
    } catch (error) {
      console.error('[ClaudeCodeSession] Historical message translation error:', error);
      // Return original messages if batch translation fails
      return messages;
    }
  };

  const checkForActiveSession = async () => {
    // If we have a session prop, check if it's still active
    if (session) {
      try {
        const activeSessions = await api.listRunningClaudeSessions();
        const activeSession = activeSessions.find((s: any) => {
          if ('process_type' in s && s.process_type && 'ClaudeSession' in s.process_type) {
            return (s.process_type as any).ClaudeSession.session_id === session.id;
          }
          return false;
        });
        
        if (activeSession) {
          // Session is still active, reconnect to its stream
          console.log('[ClaudeCodeSession] Found active session, reconnecting:', session.id);
          // IMPORTANT: Set claudeSessionId before reconnecting
          setClaudeSessionId(session.id);
          
          // Don't add buffered messages here - they've already been loaded by loadSessionHistory
          // Just set up listeners for new messages
          
          // Set up listeners for the active session
          reconnectToSession(session.id);
        }
      } catch (err) {
        console.error('Failed to check for active sessions:', err);
      }
    }
  };

  const reconnectToSession = async (sessionId: string) => {
    console.log('[ClaudeCodeSession] Reconnecting to session:', sessionId);
    
    // Prevent duplicate listeners
    if (isListeningRef.current) {
      console.log('[ClaudeCodeSession] Already listening to session, skipping reconnect');
      return;
    }
    
    // Clean up previous listeners
    unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
    unlistenRefs.current = [];
    
    // IMPORTANT: Set the session ID before setting up listeners
    setClaudeSessionId(sessionId);
    
    // Mark as listening
    isListeningRef.current = true;
    
    // Set up session-specific listeners
    const outputUnlisten = await listen<string>(`claude-output:${sessionId}`, async (event) => {
      try {
        console.log('[ClaudeCodeSession] Received claude-output on reconnect:', event.payload);

        if (!isMountedRef.current) return;

        // Store raw JSONL
        setRawJsonlOutput(prev => [...prev, event.payload]);

        // 🔧 CRITICAL FIX: Apply translation to reconnect messages too
        // Parse message
        const message = JSON.parse(event.payload) as ClaudeStreamMessage;

        // Apply translation using the same logic as handleStreamMessage
        await processMessageWithTranslation(message, event.payload);

      } catch (err) {
        console.error("Failed to parse message:", err, event.payload);
      }
    });

    const errorUnlisten = await listen<string>(`claude-error:${sessionId}`, (event) => {
      console.error("Claude error:", event.payload);
      if (isMountedRef.current) {
        setError(event.payload);
      }
    });

    const completeUnlisten = await listen<boolean>(`claude-complete:${sessionId}`, async (event) => {
      console.log('[ClaudeCodeSession] Received claude-complete on reconnect:', event.payload);
      if (isMountedRef.current) {
        setIsLoading(false);
        // 🔧 FIX: Reset hasActiveSessionRef when session completes
        hasActiveSessionRef.current = false;
        console.log('[ClaudeCodeSession] Reconnect session completed - ready for new input');
      }
    });

    unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten];
    
    // Mark as loading to show the session is active
    if (isMountedRef.current) {
      setIsLoading(true);
      hasActiveSessionRef.current = true;
    }
  };

  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目目录"
      });
      
      if (selected) {
        setProjectPath(selected as string);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to select directory: ${errorMessage}`);
    }
  };

  // Smart model selection for Default mode

  const handleSendPrompt = async (prompt: string, model: "sonnet" | "opus" | "sonnet1m", thinkingInstruction?: string) => {
    console.log('[ClaudeCodeSession] handleSendPrompt called with:', { prompt, model, projectPath, claudeSessionId, effectiveSession, thinkingInstruction });
    
    if (!projectPath) {
      setError("请先选择项目目录");
      return;
    }

    // Check if this is a slash command and handle it appropriately
    const isSlashCommandInput = isSlashCommand(prompt);
    const trimmedPrompt = prompt.trim();
    
    if (isSlashCommandInput) {
      const commandPreview = trimmedPrompt.split('\n')[0];
      console.log('[ClaudeCodeSession] ✅ Detected slash command, bypassing translation:', {
        command: commandPreview,
        model: model,
        projectPath: projectPath
      });
      
      // For slash commands, we need to send them as-is to Claude CLI
      // Claude CLI should handle the slash command parsing and execution
      // The key is to ensure the command is passed correctly to the Claude process
    }

    console.log('[ClaudeCodeSession] Using model:', model);

    // If already loading, queue the prompt
    if (isLoading) {
      const newPrompt = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        model
      };
      setQueuedPrompts(prev => [...prev, newPrompt]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      hasActiveSessionRef.current = true;

      // 🌐 Translation: Process user input before sending to Claude
      let processedPrompt = prompt;
      let userInputTranslation: TranslationResult | null = null;

      // For resuming sessions, ensure we have the session ID
      if (effectiveSession && !claudeSessionId) {
        setClaudeSessionId(effectiveSession.id);
      }

      // 🔧 CRITICAL FIX: Only set up listeners if this tab is active
      // This prevents multiple ClaudeCodeSession instances from processing the same events
      if (!isListeningRef.current && isActive) {
        // Clean up previous listeners
        unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
        unlistenRefs.current = [];

        // Mark as setting up listeners
        isListeningRef.current = true;

        console.log('[ClaudeCodeSession] Setting up event listeners for ACTIVE tab only');

        // --------------------------------------------------------------------
        // 1️⃣  Event Listener Setup Strategy
        // --------------------------------------------------------------------
        // Claude Code may emit a *new* session_id even when we pass --resume. If
        // we listen only on the old session-scoped channel we will miss the
        // stream until the user navigates away & back. To avoid this we:
        //   • Always start with GENERIC listeners (no suffix) so we catch the
        //     very first "system:init" message regardless of the session id.
        //   • Once that init message provides the *actual* session_id, we
        //     dynamically switch to session-scoped listeners and stop the
        //     generic ones to prevent duplicate handling.
        // --------------------------------------------------------------------

        let currentSessionId: string | null = claudeSessionId || effectiveSession?.id || null;

        // Helper to attach session-specific listeners **once we are sure**
        const attachSessionSpecificListeners = async (sid: string) => {
          console.log('[ClaudeCodeSession] Attaching session-specific listeners for', sid);

          const specificOutputUnlisten = await listen<string>(`claude-output:${sid}`, (evt) => {
            handleStreamMessage(evt.payload, userInputTranslation || undefined);
          });

          const specificErrorUnlisten = await listen<string>(`claude-error:${sid}`, (evt) => {
            console.error('Claude error (scoped):', evt.payload);
            setError(evt.payload);
          });

          const specificCompleteUnlisten = await listen<boolean>(`claude-complete:${sid}`, (evt) => {
            console.log('[ClaudeCodeSession] Received claude-complete (scoped):', evt.payload);
            processComplete(evt.payload);
          });

          // Replace existing unlisten refs with these new ones (after cleaning up)
          unlistenRefs.current.forEach((u) => u && typeof u === 'function' && u());
          unlistenRefs.current = [specificOutputUnlisten, specificErrorUnlisten, specificCompleteUnlisten];
        };

        // Generic listeners (catch-all) - ALWAYS process to ensure user sees output
        const genericOutputUnlisten = await listen<string>('claude-output', async (event) => {
          // Always handle generic events as fallback to ensure output visibility
          handleStreamMessage(event.payload, userInputTranslation || undefined);

          // Attempt to extract session_id on the fly (for the very first init)
          try {
            const msg = JSON.parse(event.payload) as ClaudeStreamMessage;
            if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
              if (!currentSessionId || currentSessionId !== msg.session_id) {
                console.log('[ClaudeCodeSession] Detected new session_id from generic listener:', msg.session_id);
                currentSessionId = msg.session_id;
                setClaudeSessionId(msg.session_id);

                // ✅ CRITICAL FIX: Update effectiveSession.id to use the new session_id
                // This ensures subsequent resume operations use the correct session_id
                if (effectiveSession) {
                  effectiveSession.id = msg.session_id;
                  console.log('[ClaudeCodeSession] Updated effectiveSession.id to:', msg.session_id);
                }

                // If we haven't extracted session info before, do it now
                if (!extractedSessionInfo) {
                  const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
                  setExtractedSessionInfo({ sessionId: msg.session_id, projectId });
                }

                // Switch to session-specific listeners
                await attachSessionSpecificListeners(msg.session_id);
              }
            }
          } catch {
            /* ignore parse errors */
          }
        });

        // Helper to process any JSONL stream message string
        // 使用闭包捕获当前的翻译结果，避免React状态异步更新问题
        async function handleStreamMessage(payload: string, currentTranslationResult?: TranslationResult) {
          try {
            // Don't process if component unmounted
            if (!isMountedRef.current) return;

            // Store raw JSONL
            setRawJsonlOutput((prev) => [...prev, payload]);

            const message = JSON.parse(payload) as ClaudeStreamMessage;

            // Use the shared translation function for consistency
            await processMessageWithTranslation(message, payload, currentTranslationResult);

          } catch (err) {
            console.error('Failed to parse message:', err, payload);
          }
        }

        // Helper to handle completion events (both generic and scoped)
        const processComplete = async (success: boolean) => {
          setIsLoading(false);
          // 🔧 FIX: Reset hasActiveSessionRef when session completes to show correct UI state
          hasActiveSessionRef.current = false;
          isListeningRef.current = false; // Reset listening state

          // ✅ CRITICAL FIX: Reset currentSessionId to allow detection of new session_id
          // This ensures the next message will pick up the new session_id from Claude CLI
          currentSessionId = null;
          console.log('[ClaudeCodeSession] Session completed - reset session state for new input');

          // Session is now ready to accept new input - UI will show input field instead of loading

          if (effectiveSession && success) {
            try {
              const settings = await api.getCheckpointSettings(
                effectiveSession.id,
                effectiveSession.project_id,
                projectPath
              );

              if (settings.auto_checkpoint_enabled) {
                await api.checkAutoCheckpoint(
                  effectiveSession.id,
                  effectiveSession.project_id,
                  projectPath,
                  prompt
                );
                // Reload timeline to show new checkpoint
                setTimelineVersion((v) => v + 1);
              }
            } catch (err) {
              console.error('Failed to check auto checkpoint:', err);
            }
          }

          // Process queued prompts after completion
          if (queuedPromptsRef.current.length > 0) {
            const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
            setQueuedPrompts(remainingPrompts);
            
            // Small delay to ensure UI updates
            setTimeout(() => {
              handleSendPrompt(nextPrompt.prompt, nextPrompt.model);
            }, 100);
          }
        };

        const genericErrorUnlisten = await listen<string>('claude-error', (evt) => {
          console.error('Claude error:', evt.payload);
          setError(evt.payload);
        });

        const genericCompleteUnlisten = await listen<boolean>('claude-complete', (evt) => {
          console.log('[ClaudeCodeSession] Received claude-complete (generic):', evt.payload);
          processComplete(evt.payload);
        });

        // Store the generic unlisteners for now; they may be replaced later.
        unlistenRefs.current = [genericOutputUnlisten, genericErrorUnlisten, genericCompleteUnlisten];

        // --------------------------------------------------------------------
        // 2️⃣  Auto-checkpoint logic moved after listener setup (unchanged)
        // --------------------------------------------------------------------

        // Skip translation entirely for slash commands
        if (!isSlashCommandInput) {
          try {
            const isEnabled = await translationMiddleware.isEnabled();
            if (isEnabled) {
              console.log('[ClaudeCodeSession] Translation enabled, processing user input...');
              // 确保传递给翻译中间件的参数与本地检测使用的参数一致
              userInputTranslation = await translationMiddleware.translateUserInput(prompt);
              processedPrompt = userInputTranslation.translatedText;

              if (userInputTranslation.wasTranslated) {
                console.log('[ClaudeCodeSession] User input translated:', {
                  original: userInputTranslation.originalText,
                  translated: userInputTranslation.translatedText,
                  language: userInputTranslation.detectedLanguage
                });
              }
            }
          } catch (translationError) {
            console.error('[ClaudeCodeSession] Translation failed, using original prompt:', translationError);
            // Continue with original prompt if translation fails
          }
        } else {
          const commandPreview = trimmedPrompt.split('\n')[0];
          console.log('[ClaudeCodeSession] ✅ Slash command detected, skipping translation:', {
            command: commandPreview,
            translationEnabled: await translationMiddleware.isEnabled()
          });
        }
        
        // Store the translation result AFTER all processing for response translation
        if (userInputTranslation) {
          setLastTranslationResult(userInputTranslation);
          console.log('[ClaudeCodeSession] Stored translation result for response processing:', userInputTranslation);
        }

        // 🎯 CRITICAL FIX: Add thinking instruction AFTER translation, not before
        // This ensures thinking instructions are not embedded within translated content
        if (thinkingInstruction) {
          console.log('[ClaudeCodeSession] Adding thinking instruction after translation:', thinkingInstruction);
          // Add thinking instruction at the end with proper punctuation
          const endsWithPunctuation = /[.!?]$/.test(processedPrompt.trim());
          const separator = endsWithPunctuation ? ' ' : '. ';
          processedPrompt = `${processedPrompt}${separator}${thinkingInstruction}.`;
        }

        // Add the user message immediately to the UI (show original text to user)
        const userMessage: ClaudeStreamMessage = {
          type: "user",
          message: {
            content: [
              {
                type: "text",
                text: prompt // Always show original user input
              }
            ]
          },
          sentAt: new Date().toISOString(),
          // Add translation metadata for debugging/info
          translationMeta: userInputTranslation ? {
            wasTranslated: userInputTranslation.wasTranslated,
            detectedLanguage: userInputTranslation.detectedLanguage,
            translatedText: userInputTranslation.translatedText
          } : undefined
        };
        setMessages(prev => [...prev, userMessage]);
      }

        // Execute the appropriate command based on session state
        // Use processedPrompt (potentially translated) for API calls
        if (effectiveSession && !isFirstPrompt) {
          // Resume existing session
          console.log('[ClaudeCodeSession] Resuming session:', effectiveSession.id);
          try {
            await api.resumeClaudeCode(projectPath, effectiveSession.id, processedPrompt, model);
          } catch (resumeError) {
            console.warn('[ClaudeCodeSession] Resume failed, falling back to continue mode:', resumeError);
            // Fallback to continue mode if resume fails
            await api.continueClaudeCode(projectPath, processedPrompt, model);
          }
        } else {
          // Start new session
          console.log('[ClaudeCodeSession] Starting new session');
          setIsFirstPrompt(false);
          await api.executeClaudeCode(projectPath, processedPrompt, model);
        }
    } catch (err) {
      console.error("Failed to send prompt:", err);
      setError("发送提示失败");
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      // Reset session state on error
      setClaudeSessionId(null);
    }
  };

  // Update ref whenever function changes
  useEffect(() => {
    handleSendPromptRef.current = handleSendPrompt;
  }, [handleSendPrompt]);

  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
  };

  const handleCopyAsMarkdown = async () => {
    let markdown = `# Claude 代码会话\n\n`;
    markdown += `**Project:** ${projectPath}\n`;
    markdown += `**Date:** ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      if (msg.type === "system" && msg.subtype === "init") {
        markdown += `## System Initialization\n\n`;
        markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
        markdown += `- Model: \`${msg.model || 'default'}\`\n`;
        if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
        if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
        markdown += `\n`;
      } else if (msg.type === "assistant" && msg.message) {
        markdown += `## Assistant\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            const textContent = typeof content.text === 'string' 
              ? content.text 
              : (content.text?.text || JSON.stringify(content.text || content));
            markdown += `${textContent}\n\n`;
          } else if (content.type === "tool_use") {
            markdown += `### Tool: ${content.name}\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
          }
        }
        if (msg.message.usage) {
          const { input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens } = msg.message.usage;
          let tokenText = `*Tokens: ${input_tokens} in, ${output_tokens} out`;
          if (cache_creation_tokens && cache_creation_tokens > 0) {
            tokenText += `, creation: ${cache_creation_tokens}`;
          }
          if (cache_read_tokens && cache_read_tokens > 0) {
            tokenText += `, read: ${cache_read_tokens}`;
          }
          markdown += tokenText + `*\n\n`;
        }
      } else if (msg.type === "user" && msg.message) {
        markdown += `## User\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            const textContent = typeof content.text === 'string' 
              ? content.text 
              : (content.text?.text || JSON.stringify(content.text));
            markdown += `${textContent}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### Tool Result\n\n`;
            let contentText = '';
            if (typeof content.content === 'string') {
              contentText = content.content;
            } else if (content.content && typeof content.content === 'object') {
              if (content.content.text) {
                contentText = content.content.text;
              } else if (Array.isArray(content.content)) {
                contentText = content.content
                  .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                  .join('\n');
              } else {
                contentText = JSON.stringify(content.content, null, 2);
              }
            }
            markdown += `\`\`\`\n${contentText}\n\`\`\`\n\n`;
          }
        }
      } else if (msg.type === "result") {
        markdown += `## Execution Result\n\n`;
        if (msg.result) {
          markdown += `${msg.result}\n\n`;
        }
        if (msg.error) {
          markdown += `**Error:** ${msg.error}\n\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
  };

  const handleCheckpointSelect = async () => {
    // Reload messages from the checkpoint
    await loadSessionHistory();
    // Ensure timeline reloads to highlight current checkpoint
    setTimelineVersion((v) => v + 1);
  };

  // Get conversation context for prompt enhancement
  const getConversationContext = (): string[] => {
    const contextMessages: string[] = [];
    const maxMessages = 5; // 获取最近5条消息作为上下文
    
    // Filter out system init messages and get meaningful content
    const meaningfulMessages = messages.filter(msg => {
      // Skip system init messages
      if (msg.type === "system" && msg.subtype === "init") return false;
      // Skip empty messages
      if (!msg.message?.content?.length && !msg.result) return false;
      return true;
    });
    
    // Get the last N messages
    const recentMessages = meaningfulMessages.slice(-maxMessages);
    
    for (const msg of recentMessages) {
      let contextLine = "";
      
      if (msg.type === "user" && msg.message) {
        // Extract user message text
        const userText = msg.message.content
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
        if (userText) {
          contextLine = `用户: ${userText}`;
        }
      } else if (msg.type === "assistant" && msg.message) {
        // Extract assistant message text
        const assistantText = msg.message.content
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => {
            if (typeof c.text === 'string') return c.text;
            return c.text?.text || '';
          })
          .join("\n");
        if (assistantText) {
          // Truncate very long assistant responses
          const truncated = assistantText.length > 500 
            ? assistantText.substring(0, 500) + "..." 
            : assistantText;
          contextLine = `助手: ${truncated}`;
        }
      } else if (msg.type === "result" && msg.result) {
        // Include execution results
        contextLine = `执行结果: ${msg.result}`;
      }
      
      if (contextLine) {
        contextMessages.push(contextLine);
      }
    }
    
    return contextMessages;
  };

  const handleCancelExecution = async () => {
    if (!claudeSessionId || !isLoading) return;
    
    try {
      await api.cancelClaudeExecution(claudeSessionId);
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];
      
      // Reset states
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
      
      // Reset session state on cancel
      setClaudeSessionId(null);
      
      // Clear queued prompts
      setQueuedPrompts([]);
      
      // Add a message indicating the session was cancelled
      const cancelMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "info",
        result: "用户已取消会话",
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, cancelMessage]);
    } catch (err) {
      console.error("Failed to cancel execution:", err);
      
      // Even if backend fails, we should update UI to reflect stopped state
      // Add error message but still stop the UI loading state
      const errorMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "error",
        result: `Failed to cancel execution: ${err instanceof Error ? err.message : 'Unknown error'}. The process may still be running in the background.`,
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Clean up listeners anyway
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];
      
      // Reset states to allow user to continue
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
    }
  };

  const handleFork = (checkpointId: string) => {
    setForkCheckpointId(checkpointId);
    setForkSessionName(`Fork-${new Date().toISOString().slice(0, 10)}`);
    setShowForkDialog(true);
  };

  const handleConfirmFork = async () => {
    if (!forkCheckpointId || !forkSessionName.trim() || !effectiveSession) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await api.forkFromCheckpoint(
        forkCheckpointId,
        effectiveSession.id,
        effectiveSession.project_id,
        projectPath,
        newSessionId,
        forkSessionName
      );
      
      // Open the new forked session
      // You would need to implement navigation to the new session
      console.log("Forked to new session:", newSessionId);
      
      setShowForkDialog(false);
      setForkCheckpointId(null);
      setForkSessionName("");
    } catch (err) {
      console.error("Failed to fork checkpoint:", err);
      setError("分支检查点失败");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL detection from terminal output
  const handleLinkDetected = (url: string) => {
    if (!showPreview && !showPreviewPrompt) {
      setPreviewUrl(url);
      setShowPreviewPrompt(true);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setIsPreviewMaximized(false);
    // Keep the previewUrl so it can be restored when reopening
  };

  const handlePreviewUrlChange = (url: string) => {
    console.log('[ClaudeCodeSession] Preview URL changed to:', url);
    setPreviewUrl(url);
  };

  const handleTogglePreviewMaximize = () => {
    setIsPreviewMaximized(!isPreviewMaximized);
    // Reset split position when toggling maximize
    if (isPreviewMaximized) {
      setSplitPosition(50);
    }
  };



  // Cleanup event listeners and track mount state
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('[ClaudeCodeSession] Component unmounting, cleaning up listeners');
      isMountedRef.current = false;
      isListeningRef.current = false;
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];
      
      // Reset session state on unmount
      setClaudeSessionId(null);
      
      // Clear checkpoint manager when session ends
      if (effectiveSession) {
        api.clearCheckpointManager(effectiveSession.id).catch(err => {
          console.error("Failed to clear checkpoint manager:", err);
        });
      }
    };
  }, [effectiveSession, projectPath]);

  const messagesList = (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto relative"
      style={{
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', // 优化底部空间，让内容更贴近输入框
        paddingTop: '20px',
      }}
    >
      <div
        className="relative w-full max-w-5xl mx-auto px-4 pt-8 pb-4"
        style={{
          height: `${Math.max(rowVirtualizer.getTotalSize(), 100)}px`,
          minHeight: '100px',
        }}
      >
        <AnimatePresence>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const message = displayableMessages[virtualItem.index];
            return (
              <motion.div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={(el) => el && rowVirtualizer.measureElement(el)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-x-4 pb-4"
                style={{
                  top: virtualItem.start,
                }}
              >
                <StreamMessage
                  message={message}
                  streamMessages={messages}
                  onLinkDetected={handleLinkDetected}
                  claudeSettings={claudeSettings}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>


      {/* Error indicator */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive w-full max-w-5xl mx-auto"
          style={{ marginBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );

  const projectPathInput = !session && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="p-4 border-b border-border flex-shrink-0"
    >
      <Label htmlFor="project-path" className="text-sm font-medium">
        项目目录
      </Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          id="project-path"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="/path/to/your/project"
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          onClick={handleSelectPath}
          size="icon"
          variant="outline"
          disabled={isLoading}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // If preview is maximized, render only the WebviewPreview in full screen
  if (showPreview && isPreviewMaximized) {
    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 z-50 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <WebviewPreview
            initialUrl={previewUrl}
            onClose={handleClosePreview}
            isMaximized={isPreviewMaximized}
            onToggleMaximize={handleTogglePreviewMaximize}
            onUrlChange={handlePreviewUrlChange}
            className="h-full"
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="h-8 w-8 hover:bg-accent hover:text-accent-foreground mr-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>返回会话列表</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="h-5 w-px bg-border mr-3" />
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {projectPath || "未选择项目"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Session Cost Display */}
            {messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8">
                  <DollarSign className="h-3 w-3 text-green-600" />
                  <span className="font-mono text-xs">{formatCost(sessionCost)}</span>
                </Badge>
              </motion.div>
            )}

            {/* Loading Indicator in Toolbar */}
            {isLoading && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-600">
                <div className="rotating-symbol text-blue-600" style={{ width: '12px', height: '12px' }} />
                <span>处理中...</span>
              </div>
            )}
            
            {/* 合并的项目配置按钮 */}
            {projectPath && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="h-8"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    项目配置
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  {onProjectSettings && (
                    <DropdownMenuItem
                      onClick={() => onProjectSettings(projectPath)}
                      className="text-xs"
                    >
                      <Settings className="h-3 w-3 mr-2" />
                      Hooks
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setShowSlashCommandsSettings(true)}
                    className="text-xs"
                  >
                    <Command className="h-3 w-3 mr-2" />
                    Commands
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="flex items-center gap-2">
              {showSettings && (
                <CheckpointSettings
                  sessionId={effectiveSession?.id || ''}
                  projectId={effectiveSession?.project_id || ''}
                  projectPath={projectPath}
                />
              )}
              {/* 合并的检查点功能按钮 */}
              {effectiveSession && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      <GitBranch className="h-4 w-4 mr-2" />
                      检查点
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={() => setShowSettings(!showSettings)}
                      className="text-xs"
                    >
                      <Settings className="h-3 w-3 mr-2" />
                      {showSettings ? '隐藏设置' : '显示设置'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowTimeline(!showTimeline)}
                      className="text-xs"
                    >
                      <GitBranch className="h-3 w-3 mr-2" />
                      {showTimeline ? '隐藏时间线' : '显示时间线'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {messages.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      复制输出
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={handleCopyAsMarkdown}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCopyAsJsonl}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      JSONL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 overflow-hidden transition-all duration-300",
          showTimeline && "sm:mr-96"
        )}>
          {showPreview ? (
            // Split pane layout when preview is active
            <SplitPane
              left={
                <div className="h-full flex flex-col">
                  {projectPathInput}
                  {messagesList}
                </div>
              }
              right={
                <WebviewPreview
                  initialUrl={previewUrl}
                  onClose={handleClosePreview}
                  isMaximized={isPreviewMaximized}
                  onToggleMaximize={handleTogglePreviewMaximize}
                  onUrlChange={handlePreviewUrlChange}
                />
              }
              initialSplit={splitPosition}
              onSplitChange={setSplitPosition}
              minLeftWidth={400}
              minRightWidth={400}
              className="h-full"
            />
          ) : (
            // Original layout when no preview
            <div className="h-full flex flex-col max-w-5xl mx-auto">
              {projectPathInput}
              {messagesList}

              {isLoading && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="rotating-symbol text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {session ? "加载会话历史记录..." : "初始化 Claude Code..."}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Floating Prompt Input - Always visible */}
        <ErrorBoundary>
          {/* Queued Prompts Display */}
          <AnimatePresence>
            {queuedPrompts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4"
                style={{
                  bottom: 'calc(140px + env(safe-area-inset-bottom))', // 在输入区域上方
                }}
              >
                <div className="floating-element backdrop-enhanced rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Queued Prompts ({queuedPrompts.length})
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQueuedPromptsCollapsed(prev => !prev)}>
                      {queuedPromptsCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>
                  {!queuedPromptsCollapsed && queuedPrompts.map((queuedPrompt, index) => (
                    <motion.div
                      key={queuedPrompt.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                            {queuedPrompt.model === "opus" ? "Opus" : queuedPrompt.model === "sonnet1m" ? "Sonnet 1M" : "Sonnet"}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 break-words">{queuedPrompt.prompt}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setQueuedPrompts(prev => prev.filter(p => p.id !== queuedPrompt.id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced scroll controls with smart indicators */}
          {displayableMessages.length > 5 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.5 }}
              className="fixed right-6 z-40"
              style={{
                bottom: 'calc(120px + env(safe-area-inset-bottom))', // 确保在输入区域上方
              }}
            >
              <div className="flex flex-col gap-2">
                {/* New message indicator - only show when user scrolled away */}
                <AnimatePresence>
                  {userScrolled && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.8 }}
                      className="floating-element backdrop-enhanced rounded-full px-3 py-2 cursor-pointer hover:bg-accent"
                      onClick={() => {
                        setUserScrolled(false);
                        setShouldAutoScroll(true);
                        if (parentRef.current) {
                          parentRef.current.scrollTo({
                            top: parentRef.current.scrollHeight,
                            behavior: 'smooth'
                          });
                        }
                      }}
                      title="New messages - click to scroll to bottom"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span>新消息</span>
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Traditional scroll controls */}
                <div className="flex items-center floating-element backdrop-enhanced rounded-full overflow-hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserScrolled(true);
                      setShouldAutoScroll(false);
                      if (parentRef.current) {
                        parentRef.current.scrollTo({
                          top: 0,
                          behavior: 'smooth'
                        });
                      }
                    }}
                    className="px-3 py-2 hover:bg-accent rounded-none"
                    title="滚动到顶部"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-4 bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserScrolled(false);
                      setShouldAutoScroll(true);
                      if (parentRef.current) {
                        parentRef.current.scrollTo({
                          top: parentRef.current.scrollHeight,
                          behavior: 'smooth'
                        });
                      }
                    }}
                    className="px-3 py-2 hover:bg-accent rounded-none"
                    title="滚动到底部"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          <div className={cn(
            "fixed bottom-0 left-0 right-0 transition-all duration-300 z-50",
            showTimeline && "sm:right-96"
          )}>
            <FloatingPromptInput
              ref={floatingPromptRef}
              onSend={handleSendPrompt}
              onCancel={handleCancelExecution}
              isLoading={isLoading}
              disabled={!projectPath}
              projectPath={projectPath}
              getConversationContext={getConversationContext}
              // Removed hasActiveSession - now using Claude Code SDK directly
            />
          </div>

        </ErrorBoundary>

        {/* Timeline */}
        <AnimatePresence>
          {showTimeline && effectiveSession && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l border-border shadow-xl z-30 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                {/* Timeline Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-lg font-semibold">Session Timeline</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTimeline(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Timeline Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <TimelineNavigator
                    sessionId={effectiveSession.id}
                    projectId={effectiveSession.project_id}
                    projectPath={projectPath}
                    currentMessageIndex={messages.length - 1}
                    onCheckpointSelect={handleCheckpointSelect}
                    onFork={handleFork}
                    refreshVersion={timelineVersion}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fork Dialog */}
      <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork Session</DialogTitle>
            <DialogDescription>
              Create a new session branch from the selected checkpoint.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fork-name">New Session Name</Label>
              <Input
                id="fork-name"
                placeholder="e.g., Alternative approach"
                value={forkSessionName}
                onChange={(e) => setForkSessionName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleConfirmFork();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForkDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFork}
              disabled={isLoading || !forkSessionName.trim()}
            >
              Create Fork
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      {showSettings && effectiveSession && (
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl">
            <CheckpointSettings
              sessionId={effectiveSession.id}
              projectId={effectiveSession.project_id}
              projectPath={projectPath}
              onClose={() => setShowSettings(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Slash Commands Settings Dialog */}
      {showSlashCommandsSettings && (
        <Dialog open={showSlashCommandsSettings} onOpenChange={setShowSlashCommandsSettings}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Slash Commands</DialogTitle>
              <DialogDescription>
                Manage project-specific slash commands for {projectPath}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <SlashCommandsManager projectPath={projectPath} />
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
