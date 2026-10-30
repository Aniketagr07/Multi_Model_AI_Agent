import { useState, useCallback, useEffect, useRef } from 'react';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import {
  streamChatMessage,
  fetchConversations,
  fetchConversationDetails,
  renameConversation as apiRenameConversation,
  deleteConversationApi,
} from '../services/api';

export function useChat({ customModels = [], customKeys = {} } = {}) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = new chat
  const [activeMessages, setActiveMessages] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('auto'); // Default to Auto Smart Router
  const [effort, setEffort] = useState('medium'); // 'low' | 'medium' | 'high'
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const abortControllerRef = useRef(null);

  // Active conversation metadata
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Conversation';

  // Selected model metadata
  const allModels = [...customModels, ...AVAILABLE_MODELS];
  const selectedModel = allModels.find(m => m.id === selectedModelId) || allModels[0];

  // Load persistent conversations from SQLite on initial mount
  const refreshConversations = useCallback(async () => {
    try {
      const convs = await fetchConversations();
      const formatted = convs.map(c => {
        const d = new Date(c.updated_at);
        const isToday = new Date().toDateString() === d.toDateString();
        const dateLabel = isToday
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return {
          id: c.id,
          title: c.title,
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

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Action: Select an existing conversation and load its messages
  const selectConversation = useCallback(async (convId) => {
    // If generation is active, abort it when switching conversations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setActiveConversationId(convId);
    setInput('');
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
    setIsLoading(false);
  }, []);

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
      }
    } catch (err) {
      console.error('[OmniAI Storage] Delete failed:', err);
    }
  }, [activeConversationId]);

  // Action: Stop Generation (TASK 2)
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

  // Action: Send Message with Real-Time SSE Streaming (TASK 1 & TASK 4)
  const sendMessage = useCallback(async (textToSend, overrideModelId, overrideEffort) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    if (!messageContent || isLoading) return; // Prevent duplicate submissions

    const targetModelId = overrideModelId || selectedModelId;
    const targetModel = allModels.find(m => m.id === targetModelId) || selectedModel;
    const targetEffort = overrideEffort || effort;

    const customKey = targetModel.customApiKey || customKeys[targetModel.provider]?.apiKey || null;
    const customBaseUrl = targetModel.customBaseUrl || customKeys[targetModel.provider]?.baseUrl || null;
    const customProvider = targetModel.customProvider || targetModel.provider || null;
    const customProviderModelId = targetModel.provider_model_id || null;

    // Abort any existing running stream
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
      timestamp: new Date().toISOString(),
    };

    setActiveMessages(prev => [...prev, tempUserMessage, initialAssistantMessage]);
    setInput('');
    setIsLoading(true);

    let accumulatedContent = '';

    try {
      await streamChatMessage({
        message: messageContent,
        model_id: targetModelId,
        conversation_id: activeConversationId,
        effort: targetEffort,
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
        // Handled cleanly by stopGeneration()
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
  }, [input, isLoading, activeConversationId, selectedModelId, selectedModel, effort, allModels, customKeys, refreshConversations]);

  // Action: Regenerate Response (TASK 2)
  const regenerateResponse = useCallback((assistantMessage) => {
    if (!assistantMessage || isLoading) return;

    // Find the message in activeMessages to get the preceding user prompt
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

    // Remove the assistant message that's being regenerated
    setActiveMessages(prev => prev.filter(m => m.id !== assistantMessage.id));

    // Re-trigger sendMessage with the retrieved prompt
    sendMessage(promptToReplay, assistantMessage.modelId, assistantMessage.effort);
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
    startNewChat,
    selectConversation,
    renameConversation: renameConversationHandler,
    deleteConversation: deleteConversationHandler,
    setSelectedModelId,
    sendMessage,
    stopGeneration,
    regenerateResponse,
  };
}
