/**
 * OmniAI API Service
 * Centralizes all asynchronous communication between the React frontend
 * and the FastAPI backend, providing typed payload contracts and error normalization.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Checks backend health status.
 * Target: GET /api/health
 */
export async function checkBackendHealth() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/health`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Alias for backwards compatibility
export const fetchHealthStatus = checkBackendHealth;

/**
 * Fetches the server-side model registry.
 * Target: GET /api/models
 */
export async function fetchModelRegistry() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/models`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Dispatches a chat message to the FastAPI backend.
 * Target: POST /api/chat
 */
export async function sendChatMessage({ message, model_id, conversation_id, messages }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/chat`;

  const payload = {
    message,
    model_id,
    conversation_id: conversation_id || null,
    messages: messages && messages.length > 0 ? messages : null,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error(
      `Network connection failure: Unable to reach OmniAI backend at ${API_BASE_URL}. Ensure the FastAPI server is running.`
    );
  }

  if (!response.ok) {
    let errorMessage = `Provider request failed with HTTP ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Non-JSON error body fallback
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Dispatches a multi-model comparison request to the FastAPI backend.
 * Target: POST /api/compare
 */
export async function sendCompareRequest({ prompt, model_a_id, model_b_id }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/compare`;

  const payload = {
    prompt,
    model_a_id,
    model_b_id,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error(
      `Network connection failure: Unable to reach OmniAI backend at ${API_BASE_URL}. Ensure the FastAPI server is running.`
    );
  }

  if (!response.ok) {
    let errorMessage = `Comparison error (HTTP ${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Fetches all persistent conversations from SQLite.
 * Target: GET /api/conversations
 */
export async function fetchConversations() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.conversations || [];
}

/**
 * Fetches single conversation details and its complete message history.
 * Target: GET /api/conversations/{id}
 */
export async function fetchConversationDetails(conversationId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load conversation: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Creates a new conversation in persistent storage.
 * Target: POST /api/conversations
 */
export async function createConversation(title = 'New Conversation') {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Renames a conversation title.
 * Target: PATCH /api/conversations/{id}
 */
export async function renameConversation(conversationId, title) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rename conversation: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Deletes a conversation and all its messages.
 * Target: DELETE /api/conversations/{id}
 */
export async function deleteConversationApi(conversationId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;

  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete conversation: HTTP ${response.status}`);
  }

  return true;
}
