import { useState, useCallback } from 'react';
import { AVAILABLE_MODELS } from '../components/ModelSelector';
import { sendChatMessage } from '../services/api';

// Realistic demo conversation data
const INITIAL_DEMO_CONVERSATIONS = [
  {
    id: 'demo-binary-search',
    title: 'Binary Search in Python',
    dateLabel: 'Earlier today',
    modelId: 'auto',
  },
  {
    id: 'demo-fastapi-arch',
    title: 'FastAPI Decoupled Architecture',
    dateLabel: 'Yesterday',
    modelId: 'llama-3.1-8b-instant',
  },
  {
    id: 'demo-neural-loss',
    title: 'Cross-Entropy Loss Derivation',
    dateLabel: 'Oct 27',
    modelId: 'gemini-1.5-pro',
  },
];

const INITIAL_DEMO_MESSAGES = {
  'demo-binary-search': [
    {
      id: 'msg-bs-1',
      sender: 'user',
      content: 'Can you show me a clean implementation of binary search in Python with O(log n) time complexity?',
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'msg-bs-2',
      sender: 'assistant',
      modelName: 'Llama 3.1 8B',
      modelTag: 'Groq Cloud',
      provider: 'groq',
      latencyMs: 185,
      routed: true,
      routingCategory: 'coding',
      routingExplanation: 'Selected Llama 3.1 8B (Groq Cloud) because this request was classified as a coding/debugging task (high token velocity and deterministic code synthesis).',
      fallbackUsed: false,
      content: `Here is an optimal iterative implementation of Binary Search in Python:

\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    """Perform binary search on a sorted list.
    Returns index of target if found, else -1.
    """
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = left + (right - left) // 2

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1

# Verification test
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
print(binary_search(numbers, 23))  # Output: 5
\`\`\`

### Complexity Analysis
* **Time Complexity**: $\\mathcal{O}(\\log n)$ since the search space is halved every iteration.
* **Space Complexity**: $\\mathcal{O}(1)$ as only pointer indices are stored in memory.`,
      timestamp: new Date(Date.now() - 3600000 * 3 + 120000).toISOString(),
    },
  ],
  'demo-fastapi-arch': [
    {
      id: 'msg-fa-1',
      sender: 'user',
      content: 'What are the main advantages of using Groq LPUs compared to traditional GPUs for LLM inference?',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg-fa-2',
      sender: 'assistant',
      modelName: 'Llama 3.1 8B',
      modelTag: 'Groq LPU Free Tier',
      provider: 'groq',
      latencyMs: 142,
      routed: false,
      content: `Key architectural advantages of Groq Language Processing Units (LPUs) include:

1. **Deterministic Execution**: LPUs feature a Tensor Streaming Processor (TSP) architecture with no instruction cache or hardware branch prediction, eliminating variable scheduling overhead.
2. **SRAM-Centric Bandwidth**: Instead of relying solely on external HBM memory bottlenecks, Groq uses hundreds of megabytes of on-die SRAM providing up to 80 TB/s memory bandwidth.
3. **Ultra-Low Latency**: Generates tokens at 300–800 tokens per second for Llama 3 models, making real-time voice and agentic loops feasible.
4. **Energy Efficiency**: Predictable static scheduling minimizes power consumption compared to dynamic GPU warp schedulers.`,
      timestamp: new Date(Date.now() - 86400000 + 60000).toISOString(),
    },
  ],
  'demo-neural-loss': [
    {
      id: 'msg-nl-1',
      sender: 'user',
      content: 'Why is Categorical Cross-Entropy preferred over MSE for multi-class classification?',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'msg-nl-2',
      sender: 'assistant',
      modelName: 'Gemini 1.5 Pro',
      modelTag: 'Google Pro',
      provider: 'gemini',
      latencyMs: 640,
      routed: true,
      routingCategory: 'reasoning',
      routingExplanation: 'Selected Gemini 1.5 Pro (Google AI Studio) because this request was classified as an analytical/reasoning task (deep contextual reasoning and multi-step derivation).',
      fallbackUsed: false,
      content: `In multi-class classification, Cross-Entropy Loss with Softmax is preferred because:

* **Convex Optimization**: Cross-entropy produces a steeper gradient when predictions are confident and wrong, preventing saturation and vanishing gradients during backpropagation.
* **Probabilistic Grounding**: Cross-Entropy directly penalizes the divergence between the true one-hot distribution $y$ and the predicted probabilities $\\hat{y}$:

\`\`\`math
\\mathcal{L}_{CE} = -\\sum_{i=1}^{C} y_i \\log(\\hat{y}_i)
\`\`\`

Mean Squared Error (MSE) assumes Gaussian error distributions, which causes slower convergence and local minima when combined with Softmax outputs.`,
      timestamp: new Date(Date.now() - 86400000 * 2 + 180000).toISOString(),
    },
  ],
};

export function useChat() {
  const [conversations, setConversations] = useState(INITIAL_DEMO_CONVERSATIONS);
  const [messagesByConv, setMessagesByConv] = useState(INITIAL_DEMO_MESSAGES);
  const [activeConversationId, setActiveConversationId] = useState(null); // null = new chat
  const [selectedModelId, setSelectedModelId] = useState('auto'); // Default to Auto Smart Router in Day 6
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Active messages list
  const activeMessages = activeConversationId ? (messagesByConv[activeConversationId] || []) : [];

  // Active conversation title
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeTitle = activeConversation ? activeConversation.title : 'New Conversation';

  // Selected model metadata
  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  // Action: Start a brand-new chat
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setInput('');
  }, []);

  // Action: Select an existing conversation
  const selectConversation = useCallback((convId) => {
    setActiveConversationId(convId);
    setInput('');
  }, []);

  // Action: Delete a conversation
  const deleteConversation = useCallback((convId) => {
    setConversations(prev => prev.filter(c => c.id !== convId));
    setMessagesByConv(prev => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    setActiveConversationId(current => (current === convId ? null : current));
  }, []);

  // Action: Send Message
  const sendMessage = useCallback(async (textToSend, overrideModelId) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    if (!messageContent || isLoading) return;

    // Lock in the model for THIS specific request closure
    const targetModelId = overrideModelId || selectedModelId;
    const targetModel = AVAILABLE_MODELS.find(m => m.id === targetModelId) || selectedModel;

    let targetConvId = activeConversationId;
    const isNewSession = !targetConvId;

    // Generate new conversation if none active
    if (isNewSession) {
      targetConvId = `conv-${Date.now()}`;
      const autoTitle = messageContent.length > 32
        ? `${messageContent.substring(0, 32).trim()}...`
        : messageContent;

      const newConv = {
        id: targetConvId,
        title: autoTitle,
        dateLabel: 'Just now',
        modelId: targetModelId,
      };

      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(targetConvId);
    }

    // Create user message
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    // Extract prior conversational messages for multi-turn context
    const priorMessages = (messagesByConv[targetConvId] || [])
      .filter(m => !m.isError && !m.isNotice && m.content)
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Append user message immediately
    setMessagesByConv(prev => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), userMessage],
    }));

    // Clear input field and set loading state
    setInput('');
    setIsLoading(true);

    try {
      // Real API request to FastAPI POST /api/chat
      const result = await sendChatMessage({
        message: messageContent,
        model_id: targetModelId,
        conversation_id: targetConvId,
        messages: priorMessages,
      });

      // Find actual model used (could differ from 'auto' if router selected it)
      const actualModel = AVAILABLE_MODELS.find(m => m.id === result.model_id) || {
        name: result.model_id,
        tag: result.provider === 'groq' ? 'Groq Cloud' : 'Google AI Studio',
      };

      // Append real AI assistant response with routing explanations
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

      setMessagesByConv(prev => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), assistantMessage],
      }));
    } catch (err) {
      console.error('[OmniAI Chat] Model request failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown communication error occurred.';

      const keyName = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'GROQ_API_KEY'
        : 'GEMINI_API_KEY';
      const portalUrl = targetModel.provider && targetModel.provider.toLowerCase().includes('groq')
        ? 'https://console.groq.com/keys'
        : 'https://aistudio.google.com/app/apikey';

      // Construct informative error message
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

      setMessagesByConv(prev => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), errorNotice],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeConversationId, selectedModelId, selectedModel, messagesByConv]);

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
    deleteConversation,
    setSelectedModelId,
    sendMessage,
  };
}
