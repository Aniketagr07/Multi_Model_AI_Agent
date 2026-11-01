/**
 * Guest Storage Service for OmniAI
 * Provides 100% browser-local persistence for guest users.
 * Guest conversations and messages are never sent to the backend server.
 */

const GUEST_STORAGE_KEY = 'omniai_guest_conversations_v1';

/**
 * Reads all guest conversations from localStorage.
 * @returns {Array<Object>}
 */
function readStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[OmniAI GuestStorage] Failed to read guest storage:', err);
    return [];
  }
}

/**
 * Writes guest conversations to localStorage.
 * @param {Array<Object>} conversations
 */
function writeStorage(conversations) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    console.error('[OmniAI GuestStorage] Failed to write to guest storage:', err);
  }
}

/**
 * Returns formatted conversation list for sidebar/history.
 * Matches the format expected by useChat and Sidebar components.
 */
export function getGuestConversations() {
  const list = readStorage();
  return list
    .map((c) => {
      const d = new Date(c.updatedAt || c.updated_at || Date.now());
      const isToday = new Date().toDateString() === d.toDateString();
      const dateLabel = isToday
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return {
        id: c.id,
        title: c.title || 'New Conversation',
        isPinned: Boolean(c.isPinned),
        isArchived: Boolean(c.isArchived),
        pinnedAt: c.pinnedAt || null,
        dateLabel,
        createdAt: c.createdAt || c.created_at || new Date().toISOString(),
        updatedAt: c.updatedAt || c.updated_at || new Date().toISOString(),
        messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
        isGuest: true,
      };
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
}

/**
 * Retrieves full conversation details including messages by ID.
 * @param {string} id
 */
export function getGuestConversation(id) {
  const list = readStorage();
  const found = list.find((c) => c.id === id);
  if (!found) return null;

  return {
    ...found,
    messages: (found.messages || []).map((m) => ({
      id: m.id,
      sender: m.sender || m.role || 'user',
      role: m.role || (m.sender === 'assistant' ? 'assistant' : 'user'),
      content: m.content || '',
      modelId: m.modelId || m.model_id || 'qwen2.5-0.5b',
      provider: m.provider || 'local',
      modelName: m.modelName || 'Qwen2.5 0.5B (Browser)',
      latencyMs: m.latencyMs || m.latency_ms || 0,
      timestamp: m.timestamp || m.created_at || new Date().toISOString(),
      effort: m.effort || 'medium',
    })),
  };
}

/**
 * Creates and stores a new guest conversation.
 * @param {string} title
 */
export function createGuestConversation(title = 'New Conversation') {
  const list = readStorage();
  const now = new Date().toISOString();
  const newConv = {
    id: `guest-conv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title: title.trim() || 'New Conversation',
    isPinned: false,
    isArchived: false,
    pinnedAt: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
    isGuest: true,
  };

  list.unshift(newConv);
  writeStorage(list);
  return newConv;
}

/**
 * Saves a message into a guest conversation.
 * If message already exists by ID, updates it; otherwise appends.
 * @param {string} convId
 * @param {Object} message
 */
export function saveGuestMessage(convId, message) {
  const list = readStorage();
  let conv = list.find((c) => c.id === convId);

  const now = new Date().toISOString();
  if (!conv) {
    conv = {
      id: convId,
      title: (message.content || 'New Conversation').slice(0, 32),
      isPinned: false,
      isArchived: false,
      pinnedAt: null,
      createdAt: now,
      updatedAt: now,
      messages: [],
      isGuest: true,
    };
    list.unshift(conv);
  }

  if (!Array.isArray(conv.messages)) {
    conv.messages = [];
  }

  const existingIdx = conv.messages.findIndex((m) => m.id === message.id);
  const formattedMessage = {
    id: message.id || `msg-${Date.now()}`,
    sender: message.sender || (message.role === 'assistant' ? 'assistant' : 'user'),
    role: message.role || (message.sender === 'assistant' ? 'assistant' : 'user'),
    content: message.content || '',
    modelId: message.modelId || message.model_id || 'qwen2.5-0.5b',
    provider: message.provider || 'local',
    modelName: message.modelName || 'Qwen2.5 0.5B (Browser)',
    latencyMs: message.latencyMs || message.latency_ms || 0,
    timestamp: message.timestamp || message.created_at || now,
    effort: message.effort || 'medium',
  };

  if (existingIdx >= 0) {
    conv.messages[existingIdx] = {
      ...conv.messages[existingIdx],
      ...formattedMessage,
    };
  } else {
    conv.messages.push(formattedMessage);
  }

  // Update conversation title from first user message if default
  if ((!conv.title || conv.title === 'New Conversation') && formattedMessage.role === 'user' && formattedMessage.content) {
    conv.title = formattedMessage.content.trim().slice(0, 35) + (formattedMessage.content.length > 35 ? '...' : '');
  }

  conv.updatedAt = now;
  writeStorage(list);
  return formattedMessage;
}

/**
 * Renames a guest conversation.
 * @param {string} convId
 * @param {string} newTitle
 */
export function renameGuestConversation(convId, newTitle) {
  const list = readStorage();
  const conv = list.find((c) => c.id === convId);
  if (conv) {
    conv.title = newTitle.trim();
    conv.updatedAt = new Date().toISOString();
    writeStorage(list);
  }
}

/**
 * Deletes a guest conversation.
 * @param {string} convId
 */
export function deleteGuestConversation(convId) {
  const list = readStorage();
  const updated = list.filter((c) => c.id !== convId);
  writeStorage(updated);
}

/**
 * Toggles pin status for a guest conversation.
 * @param {string} convId
 * @param {boolean} isPinned
 */
export function pinGuestConversation(convId, isPinned) {
  const list = readStorage();
  const conv = list.find((c) => c.id === convId);
  if (conv) {
    conv.isPinned = Boolean(isPinned);
    conv.pinnedAt = isPinned ? new Date().toISOString() : null;
    conv.updatedAt = new Date().toISOString();
    writeStorage(list);
  }
}

/**
 * Toggles archive status for a guest conversation.
 * @param {string} convId
 * @param {boolean} isArchived
 */
export function archiveGuestConversation(convId, isArchived) {
  const list = readStorage();
  const conv = list.find((c) => c.id === convId);
  if (conv) {
    conv.isArchived = Boolean(isArchived);
    conv.updatedAt = new Date().toISOString();
    writeStorage(list);
  }
}

/**
 * Returns all guest data structured for migration to an authenticated backend account.
 * Preserves message ordering, timestamps, and model attribution.
 */
export function getAllGuestDataForMigration() {
  const list = readStorage();
  return list.map((c) => ({
    id: c.id,
    title: c.title || 'Conversation',
    created_at: c.createdAt || c.created_at || new Date().toISOString(),
    updated_at: c.updatedAt || c.updated_at || new Date().toISOString(),
    messages: (c.messages || []).map((m) => ({
      id: m.id,
      role: m.role || (m.sender === 'assistant' ? 'assistant' : 'user'),
      content: m.content || '',
      model_id: m.modelId || m.model_id || 'qwen2.5-0.5b',
      provider: m.provider || 'local',
      latency_ms: m.latencyMs || m.latency_ms || 0,
      created_at: m.timestamp || m.created_at || new Date().toISOString(),
    })),
  }));
}

/**
 * Clears all guest conversations from local storage.
 */
export function clearGuestStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (err) {
    console.warn('[OmniAI GuestStorage] Failed to clear guest storage:', err);
  }
}

