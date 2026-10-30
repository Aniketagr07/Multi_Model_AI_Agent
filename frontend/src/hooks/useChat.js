import { useState, useCallback, useEffect, useRef } from 'react';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import {
  sendChatMessage,
  streamChatMessage,
  fetchConversations,
  fetchConversationDetails,
  renameConversation as apiRenameConversation,
  deleteConversationApi,
  pinConversationApi,
  archiveConversationApi,
  exportConversationApi,
  uploadDocument,
  deleteDocumentApi,
} from '../services/api';

export function useChat({ customModels = [], customKeys = {}, userSettings = {}, userToken = null } = {}) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = new chat
  const [activeMessages, setActiveMessages] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (userSettings?.default_routing_mode === 'manual' && userSettings?.default_model) {
      return userSettings.default_model;
    }
    return 'auto';
  });
  const [effort, setEffort] = useState(() => userSettings?.default_effort || 'medium');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Document attachment state (TASK 1 & TASK 4)
  const [attachedDocument, setAttachedDocument] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const abortControllerRef = useRef(null);

  // Active conversation metadata
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Conversation';

  // Selected model metadata
  const allModels = [...customModels, ...AVAILABLE_MODELS];
  const selectedModel = allModels.find(m => m.id === selectedModelId) || allModels[0];

  // Load persistent conversations from SQLite
  const refreshConversations = useCallback(async (query = null) => {
    try {
      const convs = await fetchConversations(query);
      const formatted = convs.map(c => {
        const d = new Date(c.updated_at);
        const isToday = new Date().toDateString() === d.toDateString();
        const dateLabel = isToday
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return {
          id: c.id,
          title: c.title,
          isPinned: Boolean(c.is_pinned),
          isArchived: Boolean(c.is_archived),
          pinnedAt: c.pinned_at,
          dateLabel,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          messageCount: c.message_count,
        };
      });
      setConversations(formatted);
    } catch (err) {
      console.warn('[OmniAI Storage] Unable to load conversations:', err.message);
    }
  }, []);

  // Trigger search when searchQuery changes (debounced 200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshConversations(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, refreshConversations]);

  // Reload conversations when user logs in or out
  useEffect(() => {
    refreshConversations();
    setActiveConversationId(null);
    setActiveMessages([]);
  }, [userToken, refreshConversations]);

  // Action: Select an existing conversation and load its messages
  const selectConversation = useCallback(async (convId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setActiveConversationId(convId);
    setInput('');
    setAttachedDocument(null);
    setIsLoading(true);

    try {
      const details = await fetchConversationDetails(convId);
      const mappedMessages = (details.messages || []).map(m => {
        const actualModel = allModels.find(mod => mod.id === m.model_id);
        return {
          id: m.id,
          sender: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          modelId: m.model_id,
          provider: m.provider,
          latencyMs: m.latency_ms,
          routed: Boolean(m.routed),
          routingCategory: m.routing_category,
          routingExplanation: m.routing_explanation,
          effort: m.effort || 'medium',
          documentId: m.document_id,
          documentName: m.document_name,
          timestamp: m.created_at,
          modelName: actualModel ? actualModel.name : (m.model_id || 'OmniAI Assistant'),
          modelTag: actualModel ? actualModel.tag : (m.provider === 'groq' ? 'Groq Cloud' : 'Google AI Studio'),
        };
      });
      setActiveMessages(mappedMessages);
    } catch (err) {
      console.error('[OmniAI Storage] Failed to load conversation messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Action: Start a brand-new chat
  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveConversationId(null);
    setActiveMessages([]);
    setInput('');
    setAttachedDocument(null);
    setIsLoading(false);

    if (userSettings?.new_chat_behavior === 'clear') {
      const defModel = userSettings?.default_routing_mode === 'manual' && userSettings?.default_model
        ? userSettings.default_model
        : 'auto';
      setSelectedModelId(defModel);
      setEffort(userSettings?.default_effort || 'medium');
    }
  }, [userSettings]);

  // Action: Rename a conversation
  const renameConversationHandler = useCallback(async (convId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    try {
      await apiRenameConversation(convId, newTitle.trim());
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, title: newTitle.trim() } : c))
      );
    } catch (err) {
      console.error('[OmniAI Storage] Rename failed:', err);
    }
  }, []);

  // Action: Delete a conversation
  const deleteConversationHandler = useCallback(async (convId) => {
    try {
      await deleteConversationApi(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setActiveMessages([]);
        setAttachedDocument(null);
      }
    } catch (err) {
      console.error('[OmniAI Storage] Delete failed:', err);
    }
  }, [activeConversationId]);

  // Action: Pin or Unpin a conversation (TASK 2 & 3)
  const pinConversationHandler = useCallback(async (convId, isPinned) => {
    try {
      // Optimistic local update
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === convId
            ? { ...c, isPinned: Boolean(isPinned), pinnedAt: isPinned ? new Date().toISOString() : null }
            : c
        );
        // Re-sort: pinned first, then updatedAt desc
        return [...updated].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
      });
      await pinConversationApi(convId, isPinned);
    } catch (err) {
      console.error('[OmniAI Storage] Pin toggle failed:', err);
      refreshConversations(searchQuery);
    }
  }, [refreshConversations, searchQuery]);

  // Action: Archive or Restore a conversation (TASK 2 & 3)
  const archiveConversationHandler = useCallback(async (convId, isArchived) => {
    try {
      // Optimistic local update
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, isArchived: Boolean(isArchived), isPinned: isArchived ? false : c.isPinned }
            : c
        )
      );
      await archiveConversationApi(convId, isArchived);
    } catch (err) {
      console.error('[OmniAI Storage] Archive toggle failed:', err);
      refreshConversations(searchQuery);
    }
  }, [refreshConversations, searchQuery]);

  // Action: Export a conversation (TASK 4)
  const exportConversationHandler = useCallback(async (convId, format = 'markdown') => {
    try {
      return await exportConversationApi(convId, format);
    } catch (err) {
      console.error('[OmniAI Export] Export failed:', err);
      alert(`Export failed: ${err.message}`);
      throw err;
    }
  }, []);

  // Action: Attach Document (TASK 1)
  const attachFile = useCallback(async (file) => {
    if (!file) return;

    const validExtensions = ['.pdf', '.txt', '.md', '.markdown'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      alert('Only PDF (.pdf), Plain Text (.txt), and Markdown (.md) documents are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10MB limit.');
      return;
    }

    setIsUploadingDocument(true);
    setUploadProgress(0);

    try {
      const doc = await uploadDocument(file, activeConversationId, (pct) => {
        setUploadProgress(pct);
      });
      setAttachedDocument(doc);
    } catch (err) {
      console.error('[OmniAI Upload] Document upload failed:', err);
      alert(`Document upload failed: ${err.message}`);
    } finally {
      setIsUploadingDocument(false);
      setUploadProgress(0);
    }
  }, [activeConversationId]);

  // Action: Remove Document (TASK 1 & 4)
  const removeDocument = useCallback(async () => {
    if (attachedDocument) {
      const docId = attachedDocument.id;
      setAttachedDocument(null);
      try {
        await deleteDocumentApi(docId);
      } catch (err) {
        console.warn('Failed to delete document from server:', err);
      }
    }
  }, [attachedDocument]);

  // Action: Stop Generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setActiveMessages(prev =>
      prev.map(msg =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.content
                ? `${msg.content}\n\n*[Generation stopped by user]*`
                : '*[Generation stopped by user]*',
            }
          : msg
      )
    );
  }, []);

  // Action: Send Message with Real-Time SSE Streaming and Document Grounding
  const sendMessage = useCallback(async (textToSend, overrideModelId, overrideEffort, overrideDocId, overrideSkillId) => {
    const rawContent = (textToSend !== undefined ? textToSend : input).trim();
    // Default prompt if user attached document without typing text
    const messageContent = rawContent || (attachedDocument ? `Please analyze and summarize the attached document: ${attachedDocument.filename}` : '');

    if (!messageContent || isLoading || isUploadingDocument) return;

    const targetModelId = overrideModelId || selectedModelId;
    const targetModel = allModels.find(m => m.id === targetModelId) || selectedModel;
    const targetEffort = overrideEffort || effort;
    const targetDocId = overrideDocId !== undefined ? overrideDocId : (attachedDocument?.id || null);
    const targetDocName = attachedDocument?.filename || null;

    const customKey = targetModel.customApiKey || customKeys[targetModel.provider]?.apiKey || null;
    const customBaseUrl = targetModel.customBaseUrl || customKeys[targetModel.provider]?.baseUrl || null;
    const customProvider = targetModel.customProvider || targetModel.provider || null;
    const customProviderModelId = targetModel.provider_model_id || null;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. Optimistic User Message
    const tempUserMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      effort: targetEffort,
      documentId: targetDocId,
      documentName: targetDocName,
      timestamp: new Date().toISOString(),
    };

    // 2. Optimistic Assistant Placeholder
    const assistantMsgId = `assist-${Date.now()}`;
    const initialAssistantMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      content: '',
      isStreaming: true,
      modelId: targetModelId,
      provider: targetModel.provider,
      modelName: targetModel.name,
      modelTag: targetModel.tag,
      effort: targetEffort,
      documentId: targetDocId,
      documentName: targetDocName,
      timestamp: new Date().toISOString(),
    };

    setActiveMessages(prev => [...prev, tempUserMessage, initialAssistantMessage]);
    setInput('');
    setIsLoading(true);

    let accumulatedContent = '';

    try {
      if (userSettings?.streaming_enabled === false) {
        // Non-streaming fallback when user prefers buffered completions
        const resp = await sendChatMessage({
          message: messageContent,
          model_id: targetModelId,
          conversation_id: activeConversationId,
          effort: targetEffort,
          document_id: targetDocId,
          skill_id: overrideSkillId || null,
          custom_instructions: userSettings?.custom_instructions,
          custom_api_key: customKey,
          custom_provider: customProvider,
          custom_base_url: customBaseUrl,
          custom_provider_model_id: customProviderModelId,
        });

        if (resp.conversation_id && resp.conversation_id !== activeConversationId) {
          setActiveConversationId(resp.conversation_id);
        }
        const actual = allModels.find(m => m.id === resp.model_id) || targetModel;
        setActiveMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  content: resp.response,
                  latencyMs: resp.latency_ms,
                  modelId: resp.model_id,
                  modelName: actual.name,
                  modelTag: actual.tag,
                  provider: resp.provider,
                  routed: Boolean(resp.routed),
                  routingCategory: resp.routing_category,
                  routingExplanation: resp.routing_explanation,
                  effort: resp.effort || targetEffort,
                  documentId: resp.document_id || targetDocId,
                  documentName: resp.document_name || targetDocName,
                }
              : msg
          )
        );
        refreshConversations();
        return;
      }

      await streamChatMessage({
        message: messageContent,
        model_id: targetModelId,
        conversation_id: activeConversationId,
        effort: targetEffort,
        document_id: targetDocId,
        skill_id: overrideSkillId || null,
        custom_instructions: userSettings?.custom_instructions,
        custom_api_key: customKey,
        custom_provider: customProvider,
        custom_base_url: customBaseUrl,
        custom_provider_model_id: customProviderModelId,
        signal: controller.signal,

        onMeta: (meta) => {
          if (meta.conversation_id && meta.conversation_id !== activeConversationId) {
            setActiveConversationId(meta.conversation_id);
          }
          const actual = allModels.find(m => m.id === meta.model_id) || targetModel;
          setActiveMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    modelId: meta.model_id,
                    modelName: meta.model_name || actual.name,
                    modelTag: meta.model_tag || actual.tag,
                    provider: meta.provider,
                    routed: Boolean(meta.routed),
                    routingCategory: meta.routing_category,
                    routingExplanation: meta.routing_explanation,
                    effort: meta.effort || targetEffort,
                    documentId: meta.document_id || targetDocId,
                    documentName: meta.document_name || targetDocName,
                  }
                : msg
            )
          );
        },

        onToken: (token) => {
          accumulatedContent += token;
          setActiveMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedContent, isStreaming: true }
                : msg
            )
          );
        },

        onDone: (doneEvent) => {
          setActiveMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    content: doneEvent.response || accumulatedContent,
                    latencyMs: doneEvent.latency_ms,
                    effort: doneEvent.effort || targetEffort,
                    documentId: doneEvent.document_id || targetDocId,
                    documentName: doneEvent.document_name || targetDocName,
                  }
                : msg
            )
          );
          refreshConversations();
        },

        onError: (errorText) => {
          throw new Error(errorText);
        },
      });
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('[OmniAI Chat Stream] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown communication error occurred.';

      const keyName = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'GROQ_API_KEY'
        : 'GEMINI_API_KEY';
      const portalUrl = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'https://console.groq.com/keys'
        : 'https://aistudio.google.com/app/apikey';

      setActiveMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                isError: true,
                modelTag: 'Error',
                originalUserMessage: messageContent,
                content: `⚠️ **${targetModel.name} Request Failed**\n\n${errorMessage}\n\n*Evaluation Guide*: If \`${keyName}\` is not configured in \`backend/.env\`, obtain a free key at [${targetModel.provider}](${portalUrl}), add \`${keyName}=\` to \`backend/.env\`, and restart the FastAPI server.`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, isUploadingDocument, attachedDocument, activeConversationId, selectedModelId, selectedModel, effort, allModels, customKeys, refreshConversations]);

  // Action: Regenerate Response
  const regenerateResponse = useCallback((assistantMessage) => {
    if (!assistantMessage || isLoading) return;

    const msgIndex = activeMessages.findIndex(m => m.id === assistantMessage.id);
    let promptToReplay = assistantMessage.originalUserMessage;

    if (!promptToReplay && msgIndex > 0) {
      const priorUserMsg = [...activeMessages.slice(0, msgIndex)].reverse().find(m => m.sender === 'user');
      if (priorUserMsg) {
        promptToReplay = priorUserMsg.content;
      }
    }

    if (!promptToReplay) {
      console.warn('Could not locate original user message to regenerate.');
      return;
    }

    setActiveMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    sendMessage(promptToReplay, assistantMessage.modelId, assistantMessage.effort, assistantMessage.documentId);
  }, [activeMessages, isLoading, sendMessage]);

  return {
    conversations,
    activeConversationId,
    activeMessages,
    activeTitle,
    selectedModelId,
    selectedModel,
    effort,
    setEffort,
    input,
    setInput,
    isLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    searchQuery,
    setSearchQuery,
    startNewChat,
    selectConversation,
    renameConversation: renameConversationHandler,
    deleteConversation: deleteConversationHandler,
    pinConversation: pinConversationHandler,
    archiveConversation: archiveConversationHandler,
    exportConversation: exportConversationHandler,
    refreshConversations,
    setSelectedModelId,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    // Document support
    attachedDocument,
    isUploadingDocument,
    uploadProgress,
    attachFile,
    removeDocument,
  };
}
