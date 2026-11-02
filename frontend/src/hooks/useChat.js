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
import {
  getGuestConversations,
  getGuestConversation,
  createGuestConversation,
  saveGuestMessage,
  renameGuestConversation,
  deleteGuestConversation,
  pinGuestConversation,
  archiveGuestConversation,
} from '../services/guestStorage';
import { LocalModelProvider } from '../services/localInference';
import { categorizeInferenceError } from '../services/errorClassifier';
import { ModelDownloadManager } from '../services/modelDownloadManager';
import {
  LOCAL_MODELS,
  DEFAULT_LOCAL_MODEL_ID,
  DEFAULT_LOCAL_TEXT_MODEL_ID,
  isLocalModelId,
} from '../core/localModelRegistry';

export function useChat({ customModels = [], customKeys = {}, userSettings = {}, userToken = null } = {}) {
  const isGuestMode = !userToken;
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = new chat
  const [currentUserRole, setCurrentUserRole] = useState('owner');
  const [activeMessages, setActiveMessages] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (isGuestMode) {
      return DEFAULT_LOCAL_MODEL_ID;
    }
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

  // Local model loading state
  const [localModelReady, setLocalModelReady] = useState(() => LocalModelProvider.isReady());
  const [localModelLoading, setLocalModelLoading] = useState(false);

  // Document attachment state
  const [attachedDocument, setAttachedDocument] = useState(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const abortControllerRef = useRef(null);

  // Active conversation metadata
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Conversation';

  // Selected model metadata
  const allModels = [...customModels, ...AVAILABLE_MODELS];
  const selectedModel = allModels.find((m) => m.id === selectedModelId) || allModels[0];

  // Refresh conversations from appropriate persistence layer
  const refreshConversations = useCallback(
    async (query = null) => {
      if (isGuestMode) {
        let guestList = getGuestConversations();
        if (query && query.trim()) {
          const q = query.trim().toLowerCase();
          guestList = guestList.filter((c) => (c.title || '').toLowerCase().includes(q));
        }
        setConversations(guestList);
        return;
      }

      try {
        const convs = await fetchConversations(query);
        const formatted = convs.map((c) => {
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
            project_id: c.project_id,
            sharing_enabled: Boolean(c.sharing_enabled),
            share_permission: c.share_permission,
            share_token: c.share_token,
          };
        });
        setConversations(formatted);
      } catch (err) {
        console.warn('[OmniAI Storage] Unable to load conversations:', err.message);
      }
    },
    [isGuestMode]
  );

  // Trigger search when searchQuery changes
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
    if (!userToken) {
      setSelectedModelId(DEFAULT_LOCAL_MODEL_ID);
    }
  }, [userToken, refreshConversations]);

  // Action: Select an existing conversation and load its messages
  const selectConversation = useCallback(
    async (convId) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setActiveConversationId(convId);
      setInput('');
      setAttachedDocument(null);
      setIsLoading(false);

      if (isGuestMode) {
        const guestConv = getGuestConversation(convId);
        if (guestConv) {
          setActiveMessages(guestConv.messages || []);
          setCurrentUserRole('owner');
        } else {
          setActiveMessages([]);
        }
        return;
      }

      try {
        const data = await fetchConversationDetails(convId);
        setCurrentUserRole(data.user_role || 'owner');

        const loadedMessages = (data.messages || []).map((msg) => {
          const modelInfo = allModels.find((m) => m.id === msg.model_id);
          return {
            id: msg.id,
            sender: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
            modelId: msg.model_id,
            provider: msg.provider,
            latencyMs: msg.latency_ms,
            author_id: msg.author_id,
            author_name: msg.author_name,
            routed: Boolean(msg.routed),
            routingCategory: msg.routing_category,
            routingExplanation: msg.routing_explanation,
            effort: msg.effort || 'medium',
            documentId: msg.document_id,
            documentName: msg.document_name,
            timestamp: msg.created_at,
            modelName: modelInfo ? modelInfo.name : msg.model_id || 'OmniAI Model',
            modelTag: modelInfo ? modelInfo.tag : null,
          };
        });
        setActiveMessages(loadedMessages);
      } catch (err) {
        console.error('[OmniAI Storage] Unable to load conversation details:', err);
      }
    },
    [allModels, isGuestMode]
  );

  // Real-time synchronization handlers
  const handleIncomingRealtimeMessage = useCallback(
    (newMsg) => {
      setActiveMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const actualModel = allModels.find((mod) => mod.id === newMsg.model_id);
        return [
          ...prev,
          {
            id: newMsg.id,
            sender: newMsg.role === 'assistant' ? 'assistant' : 'user',
            content: newMsg.content,
            modelId: newMsg.model_id,
            provider: newMsg.provider,
            latencyMs: newMsg.latency_ms,
            author_id: newMsg.author_id,
            author_name: newMsg.author_name,
            timestamp: newMsg.created_at,
            modelName: actualModel ? actualModel.name : 'OmniAI Assistant',
            modelTag: actualModel ? actualModel.tag : null,
          },
        ];
      });
    },
    [allModels]
  );

  const handleIncomingRealtimeChunk = useCallback(
    (chunkData) => {
      setActiveMessages((prev) => {
        const existing = prev.find((m) => m.id === chunkData.message_id);
        const actualModel = allModels.find((mod) => mod.id === chunkData.model_id);
        if (existing) {
          return prev.map((m) =>
            m.id === chunkData.message_id
              ? {
                  ...m,
                  content: (m.content || '') + chunkData.chunk,
                  isStreaming: true,
                }
              : m
          );
        } else {
          return [
            ...prev,
            {
              id: chunkData.message_id,
              sender: 'assistant',
              content: chunkData.chunk,
              isStreaming: true,
              modelId: chunkData.model_id,
              provider: chunkData.provider,
              author_name: chunkData.author_name,
              timestamp: new Date().toISOString(),
              modelName: actualModel ? actualModel.name : 'OmniAI Assistant',
            },
          ];
        }
      });
    },
    [allModels]
  );

  const handleIncomingRealtimeDone = useCallback(
    (doneMsg) => {
      setActiveMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== doneMsg.id);
        const actualModel = allModels.find((mod) => mod.id === doneMsg.model_id);
        return [
          ...filtered,
          {
            id: doneMsg.id,
            sender: 'assistant',
            content: doneMsg.content,
            modelId: doneMsg.model_id,
            provider: doneMsg.provider,
            latencyMs: doneMsg.latency_ms,
            author_id: doneMsg.author_id,
            author_name: doneMsg.author_name,
            timestamp: doneMsg.created_at,
            modelName: actualModel ? actualModel.name : 'OmniAI Assistant',
          },
        ];
      });
    },
    [allModels]
  );

  // Action: Start a brand-new chat
  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveConversationId(null);
    setCurrentUserRole('owner');
    setActiveMessages([]);
    setInput('');
    setAttachedDocument(null);
    setIsLoading(false);

    if (isGuestMode) {
      setSelectedModelId(DEFAULT_LOCAL_MODEL_ID);
    } else if (userSettings?.new_chat_behavior === 'clear') {
      const defModel =
        userSettings?.default_routing_mode === 'manual' && userSettings?.default_model
          ? userSettings.default_model
          : 'auto';
      setSelectedModelId(defModel);
      setEffort(userSettings?.default_effort || 'medium');
    }
  }, [userSettings, isGuestMode]);

  // Action: Rename a conversation
  const renameConversationHandler = useCallback(
    async (convId, newTitle) => {
      if (!newTitle || !newTitle.trim()) return;
      const cleanTitle = newTitle.trim();

      if (isGuestMode) {
        renameGuestConversation(convId, cleanTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: cleanTitle } : c))
        );
        return;
      }

      try {
        await apiRenameConversation(convId, cleanTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: cleanTitle } : c))
        );
      } catch (err) {
        console.error('[OmniAI Storage] Rename failed:', err);
      }
    },
    [isGuestMode]
  );

  // Action: Delete a conversation
  const deleteConversationHandler = useCallback(
    async (convId) => {
      if (isGuestMode) {
        deleteGuestConversation(convId);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          setActiveConversationId(null);
          setActiveMessages([]);
          setAttachedDocument(null);
        }
        return;
      }

      try {
        await deleteConversationApi(convId);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          setActiveConversationId(null);
          setActiveMessages([]);
          setAttachedDocument(null);
        }
      } catch (err) {
        console.error('[OmniAI Storage] Delete failed:', err);
      }
    },
    [activeConversationId, isGuestMode]
  );

  // Action: Pin or Unpin a conversation
  const pinConversationHandler = useCallback(
    async (convId, isPinned) => {
      if (isGuestMode) {
        pinGuestConversation(convId, isPinned);
        refreshConversations(searchQuery);
        return;
      }

      try {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? { ...c, isPinned: Boolean(isPinned), pinnedAt: isPinned ? new Date().toISOString() : null }
              : c
          );
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
    },
    [refreshConversations, searchQuery, isGuestMode]
  );

  // Action: Archive or Restore a conversation
  const archiveConversationHandler = useCallback(
    async (convId, isArchived) => {
      if (isGuestMode) {
        archiveGuestConversation(convId, isArchived);
        refreshConversations(searchQuery);
        return;
      }

      try {
        setConversations((prev) =>
          prev.map((c) =>
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
    },
    [refreshConversations, searchQuery, isGuestMode]
  );

  // Action: Export a conversation
  const exportConversationHandler = useCallback(
    async (convId, format = 'markdown') => {
      if (isGuestMode) {
        const conv = getGuestConversation(convId);
        if (!conv) throw new Error('Conversation not found');
        let text = `# ${conv.title || 'OmniAI Conversation'}\n\n`;
        for (const m of conv.messages || []) {
          text += `### ${m.sender === 'user' ? 'User' : 'Assistant (OmniAI Local)'}\n${m.content}\n\n`;
        }
        return { content: text, filename: `${conv.title || 'conversation'}.${format === 'json' ? 'json' : 'md'}` };
      }

      try {
        return await exportConversationApi(convId, format);
      } catch (err) {
        console.error('[OmniAI Export] Export failed:', err);
        alert(`Export failed: ${err.message}`);
        throw err;
      }
    },
    [isGuestMode]
  );

  // Action: Attach Document
  const attachFile = useCallback(
    async (file) => {
      if (!file) return;

      const validExtensions = ['.pdf', '.txt', '.md', '.markdown'];
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

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
    },
    [activeConversationId]
  );

  // Action: Remove Document
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
    LocalModelProvider.cancelGeneration();
    setIsLoading(false);
    setActiveMessages((prev) =>
      prev.map((msg) =>
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

  // Action: Send Message with Local WebLLM Inference or Server Streaming
  const sendMessage = useCallback(
    async (textToSend, overrideModelId, overrideEffort, overrideDocId, overrideSkillId, attachedImage = null) => {
      const rawContent = (textToSend !== undefined ? textToSend : input).trim();
      const messageContent =
        rawContent ||
        (attachedImage
          ? 'Describe and analyze what is visible in this image.'
          : attachedDocument
          ? `Please analyze and summarize the attached document: ${attachedDocument.filename}`
          : '');

      if (!messageContent || isLoading || isUploadingDocument) return;

      let targetModelId = overrideModelId || selectedModelId;
      const isLocal = isLocalModelId(targetModelId);

      // Access Control: Block unauthenticated visitors from cloud models
      if (isGuestMode && !isLocal) {
        setSelectedModelId(DEFAULT_LOCAL_MODEL_ID);
        alert('Unauthenticated visitors have access to the browser-based local model only. Please sign in to use cloud models.');
        return;
      }

      const targetModel = allModels.find((m) => m.id === targetModelId) || selectedModel;
      const targetEffort = overrideEffort || effort;
      const targetDocId = overrideDocId !== undefined ? overrideDocId : attachedDocument?.id || null;
      const targetDocName = attachedDocument?.filename || null;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 1. Optimistic User Message
      const tempUserMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        role: 'user',
        content: messageContent,
        effort: targetEffort,
        documentId: targetDocId,
        documentName: targetDocName,
        image: attachedImage ? {
          name: attachedImage.name,
          url: attachedImage.previewUrl || attachedImage.dataUrl,
          size: attachedImage.size,
        } : null,
        imageUrl: attachedImage ? (attachedImage.previewUrl || attachedImage.dataUrl) : null,
        timestamp: new Date().toISOString(),
      };

      // 2. Optimistic Assistant Placeholder
      const assistantMsgId = `assist-${Date.now()}`;
      const initialAssistantMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        role: 'assistant',
        content: '',
        isStreaming: true,
        modelId: targetModelId === 'auto' ? null : targetModelId,
        provider: isLocal ? 'local' : targetModel.provider,
        modelName: isLocal ? targetModel.name : targetModelId === 'auto' ? null : targetModel.name,
        modelTag: isLocal ? 'On-Device WebGPU' : targetModelId === 'auto' ? null : targetModel.tag,
        effort: targetEffort,
        documentId: targetDocId,
        documentName: targetDocName,
        timestamp: new Date().toISOString(),
      };

      setActiveMessages((prev) => [...prev, tempUserMessage, initialAssistantMessage]);
      setInput('');
      setIsLoading(true);

      // -------------------------------------------------------------
      // PATH A: BROWSER-BASED LOCAL MODEL INFERENCE (WebLLM / WebGPU)
      // -------------------------------------------------------------
      if (isLocal) {
        let currentConvId = activeConversationId;
        if (!currentConvId && isGuestMode) {
          const newConv = createGuestConversation(messageContent.slice(0, 32));
          currentConvId = newConv.id;
          setActiveConversationId(newConv.id);
        }

        if (isGuestMode && currentConvId) {
          saveGuestMessage(currentConvId, tempUserMessage);
        }

        const messagesForContext = [
          ...activeMessages.map((m) => ({
            role: m.sender === 'assistant' ? 'assistant' : 'user',
            content: m.content || '',
          })),
          { role: 'user', content: messageContent },
        ];

        let accumulated = '';
        try {
          if (!LocalModelProvider.isReady(targetModelId)) {
            setLocalModelLoading(true);
          }

          const conversationHasImage = activeMessages.some((m) => Boolean(m.image || m.imageUrl));
          const result = await LocalModelProvider.streamResponse({
            messages: messagesForContext,
            modelId: targetModelId,
            image: attachedImage,
            hasPriorImageContext: Boolean(conversationHasImage),
            signal: controller.signal,
            onChunk: (delta) => {
              accumulated += delta;
              setActiveMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: accumulated,
                        isStreaming: true,
                      }
                    : msg
                )
              );
            },
          });

          setLocalModelReady(true);
          setLocalModelLoading(false);

          const finalAssistantMsg = {
            id: assistantMsgId,
            sender: 'assistant',
            role: 'assistant',
            content: result.content || accumulated,
            isStreaming: false,
            modelId: targetModelId,
            modelName: targetModel.name,
            provider: 'local',
            modelTag: 'On-Device WebGPU',
            latencyMs: result.latencyMs,
            timestamp: new Date().toISOString(),
          };

          setActiveMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? finalAssistantMsg : msg))
          );

          if (isGuestMode && currentConvId) {
            saveGuestMessage(currentConvId, finalAssistantMsg);
            refreshConversations();
          }
        } catch (localErr) {
          setLocalModelLoading(false);
          if (controller.signal.aborted) return;
          console.error('[LocalModelProvider] Inference Error:', localErr);

          const errorInfo = categorizeInferenceError(localErr);
          let errorContent = `### ⚠️ ${errorInfo.category}\n\n${errorInfo.message}`;
          if (errorInfo.details && errorInfo.details !== errorInfo.message) {
            errorContent += `\n\n**Details**: \`${errorInfo.details}\``;
          }
          if (errorInfo.suggestion) {
            errorContent += `\n\n💡 *Recommendation*: ${errorInfo.suggestion}`;
          }

          setActiveMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    isError: true,
                    content: errorContent,
                  }
                : msg
            )
          );
        } finally {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
        return;
      }

      // -------------------------------------------------------------
      // PATH B: SERVER-SIDE CLOUD INFERENCE (FastAPI)
      // -------------------------------------------------------------
      const customKey = targetModel.customApiKey || customKeys[targetModel.provider]?.apiKey || null;
      const customBaseUrl = targetModel.customBaseUrl || customKeys[targetModel.provider]?.baseUrl || null;
      const customProvider = targetModel.customProvider || targetModel.provider || null;
      const customProviderModelId = targetModel.provider_model_id || null;

      let accumulatedContent = '';

      try {
        if (userSettings?.streaming_enabled === false) {
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
          const actual = allModels.find((m) => m.id === resp.model_id) || targetModel;
          setActiveMessages((prev) =>
            prev.map((msg) =>
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
            const actual = allModels.find((m) => m.id === meta.model_id) || targetModel;
            setActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      modelId: meta.model_id,
                      modelName: actual.name,
                      modelTag: actual.tag,
                      provider: meta.provider,
                      routed: Boolean(meta.routed),
                      routingCategory: meta.routing_category,
                      routingExplanation: meta.routing_explanation,
                      documentId: meta.document_id || targetDocId,
                      documentName: meta.document_name || targetDocName,
                    }
                  : msg
              )
            );
          },

          onChunk: (chunk) => {
            accumulatedContent += chunk;
            setActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                    }
                  : msg
              )
            );
          },

          onDone: (doneEvent) => {
            setActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      isStreaming: false,
                      content: doneEvent.response || accumulatedContent,
                      latencyMs: doneEvent.latency_ms,
                      modelId: doneEvent.model_id || msg.modelId,
                      modelName: doneEvent.model_name || msg.modelName,
                      provider: doneEvent.provider || msg.provider,
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

        setActiveMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  isError: true,
                  modelTag: 'Error',
                  content: `⚠️ **${targetModel.name} Request Failed**\n\n${errorMessage}\n\n*Note*: To use cloud models, configure your API key in Settings or switch to the on-device Local Model.`,
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isLoading,
      isUploadingDocument,
      attachedDocument,
      activeConversationId,
      selectedModelId,
      selectedModel,
      effort,
      allModels,
      customKeys,
      refreshConversations,
      isGuestMode,
      activeMessages,
      userSettings,
    ]
  );

  // Action: Regenerate Response
  const regenerateResponse = useCallback(
    (assistantMessage) => {
      if (!assistantMessage || isLoading) return;

      const msgIndex = activeMessages.findIndex((m) => m.id === assistantMessage.id);
      let promptToReplay = assistantMessage.originalUserMessage;

      if (!promptToReplay && msgIndex > 0) {
        const priorUserMsg = [...activeMessages.slice(0, msgIndex)]
          .reverse()
          .find((m) => m.sender === 'user' || m.role === 'user');
        if (priorUserMsg) {
          promptToReplay = priorUserMsg.content;
        }
      }

      if (!promptToReplay) {
        console.warn('Could not locate original user message to regenerate.');
        return;
      }

      setActiveMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
      const modelToUse = assistantMessage.modelId || selectedModelId;
      const effortToUse = assistantMessage.effort || effort;
      sendMessage(promptToReplay, modelToUse, effortToUse, assistantMessage.documentId);
    },
    [activeMessages, isLoading, sendMessage, selectedModelId, effort]
  );

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
    localModelReady,
    localModelLoading,
    setLocalModelReady,
    // Document support
    attachedDocument,
    isUploadingDocument,
    uploadProgress,
    attachFile,
    removeDocument,
    // Realtime & Collaboration support
    currentUserRole,
    setCurrentUserRole,
    handleIncomingRealtimeMessage,
    handleIncomingRealtimeChunk,
    handleIncomingRealtimeDone,
  };
}
