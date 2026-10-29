import { useState, useCallback, useEffect } from 'react';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import {
  sendChatMessage,
  fetchConversations,
  fetchConversationDetails,
  renameConversation as apiRenameConversation,
  deleteConversationApi,
} from '../services/api';

export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = new chat
  const [activeMessages, setActiveMessages] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('auto'); // Default to Auto Smart Router
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Active conversation metadata
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Conversation';

  // Selected model metadata
  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

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
    setActiveConversationId(convId);
    setInput('');
    setIsLoading(true);

    try {
      const details = await fetchConversationDetails(convId);
      const mappedMessages = (details.messages || []).map(m => {
        const actualModel = AVAILABLE_MODELS.find(mod => mod.id === m.model_id);
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
    setActiveConversationId(null);
    setActiveMessages([]);
    setInput('');
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

  // Action: Send Message
  const sendMessage = useCallback(async (textToSend, overrideModelId) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    if (!messageContent || isLoading) return;

    const targetModelId = overrideModelId || selectedModelId;
    const targetModel = AVAILABLE_MODELS.find(m => m.id === targetModelId) || selectedModel;

    // Temporary optimistic user message
    const tempUserMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    setActiveMessages(prev => [...prev, tempUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Real API request to FastAPI POST /api/chat
      const result = await sendChatMessage({
        message: messageContent,
        model_id: targetModelId,
        conversation_id: activeConversationId,
      });

      // Update active conversation ID from backend response
      if (result.conversation_id && result.conversation_id !== activeConversationId) {
        setActiveConversationId(result.conversation_id);
      }

      // Map actual model metadata
      const actualModel = AVAILABLE_MODELS.find(m => m.id === result.model_id) || {
        name: result.model_id,
        tag: result.provider === 'groq' ? 'Groq Cloud' : 'Google AI Studio',
      };

      const assistantMessage = {
        id: `assist-${Date.now()}`,
        sender: 'assistant',
        content: result.response,
        modelId: result.model_id,
        provider: result.provider || targetModel.provider,
        modelName: actualModel.name,
        modelTag: actualModel.tag,
        latencyMs: result.latency_ms,
        routed: Boolean(result.routed),
        routingCategory: result.routing_category,
        routingExplanation: result.routing_explanation,
        fallbackUsed: Boolean(result.fallback_used),
        timestamp: result.timestamp || new Date().toISOString(),
      };

      setActiveMessages(prev => [...prev, assistantMessage]);

      // Refresh sidebar list to reflect new conversation title and updated timestamp
      await refreshConversations();
    } catch (err) {
      console.error('[OmniAI Chat] Model request failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown communication error occurred.';

      const keyName = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'GROQ_API_KEY'
        : 'GEMINI_API_KEY';
      const portalUrl = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'https://console.groq.com/keys'
        : 'https://aistudio.google.com/app/apikey';

      const errorNotice = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ **${targetModel.name} Request Failed**\n\n${errorMessage}\n\n*Evaluation Guide*: If \`${keyName}\` is not configured in \`backend/.env\`, obtain a free key at [${targetModel.provider}](${portalUrl}), add \`${keyName}=\` to \`backend/.env\`, and restart the FastAPI server.`,
        isError: true,
        modelId: targetModelId,
        modelName: targetModel.name,
        modelTag: 'Error',
        originalUserMessage: messageContent,
        timestamp: new Date().toISOString(),
      };

      setActiveMessages(prev => [...prev, errorNotice]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeConversationId, selectedModelId, selectedModel, refreshConversations]);

  return {
    conversations,
    activeConversationId,
    activeMessages,
    activeTitle,
    selectedModelId,
    selectedModel,
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
  };
}
