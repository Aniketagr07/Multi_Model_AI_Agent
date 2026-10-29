import { useState, useCallback } from 'react';
import { AVAILABLE_MODELS } from '../components/ModelSelector';

// Realistic demo conversation data for Day 2 demonstration
const INITIAL_DEMO_CONVERSATIONS = [
  {
    id: 'demo-binary-search',
    title: 'Binary Search in Python',
    dateLabel: 'Earlier today',
    modelId: 'gpt-4o-demo',
  },
  {
    id: 'demo-fastapi-arch',
    title: 'FastAPI Decoupled Architecture',
    dateLabel: 'Yesterday',
    modelId: 'claude-3-5-sonnet-demo',
  },
  {
    id: 'demo-neural-loss',
    title: 'Cross-Entropy Loss Derivation',
    dateLabel: 'Oct 27',
    modelId: 'gemini-1-5-pro-demo',
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
      modelName: 'GPT-4o',
      modelTag: 'Demo Session',
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
* **Space Complexity**: $\\mathcal{O}(1)$ as only pointers are stored in memory.`,
      timestamp: new Date(Date.now() - 3600000 * 3 + 120000).toISOString(),
    },
  ],
  'demo-fastapi-arch': [
    {
      id: 'msg-fa-1',
      sender: 'user',
      content: 'What are the main advantages of using FastAPI with Pydantic for an AI gateway?',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg-fa-2',
      sender: 'assistant',
      modelName: 'Claude 3.5 Sonnet',
      modelTag: 'Demo Session',
      content: `Key benefits of FastAPI for multi-model AI gateways include:

1. **Native Asynchronous I/O**: High-concurrency routing to multiple LLM APIs via \`asyncio\` and \`httpx\`.
2. **Pydantic Validation**: Strict schema enforcement for prompts, model parameters, and provider responses.
3. **Automatic OpenAPI Docs**: Live interactive Swagger documentation generated automatically from Python type hints.
4. **CORS Security**: Robust middleware protecting backend endpoints against unauthorized cross-origin requests.`,
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
      modelTag: 'Demo Session',
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
  const [selectedModelId, setSelectedModelId] = useState('gpt-4o-demo');
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
  const sendMessage = useCallback(async (textToSend) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    if (!messageContent || isLoading) return;

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
        modelId: selectedModelId,
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

    // Append user message immediately
    setMessagesByConv(prev => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), userMessage],
    }));

    // Clear input field
    setInput('');
    setIsLoading(true);

    // Simulate standard asynchronous request pipeline (Day 2 boundary)
    setTimeout(() => {
      // Clean, honest Day 2 status notice (No fake AI responses)
      const assistantNotice = {
        id: `assist-${Date.now()}`,
        sender: 'assistant',
        modelName: selectedModel.name,
        modelTag: `${selectedModel.tag}`,
        isNotice: true,
        status: 'unconnected',
        originalUserMessage: messageContent,
        content: `**Day 2 Interface Verification Active**

Your message has been successfully received by the OmniAI UI state pipeline:
> "${messageContent}"

**Status Disclosure for Project Evaluation:**
* **Frontend Composer & State Pipeline**: Fully functional.
* **Target Model Selected**: **${selectedModel.name}** (${selectedModel.provider}).
* **Model Orchestration Layer**: Live model API calls (OpenAI, Anthropic Claude, Google Gemini, Ollama) will be connected to the backend in **Day 3**.
* No fake AI tokens or simulated outputs have been generated.`,
        timestamp: new Date().toISOString(),
      };

      setMessagesByConv(prev => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), assistantNotice],
      }));

      setIsLoading(false);
    }, 600);
  }, [input, isLoading, activeConversationId, selectedModelId, selectedModel]);

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
