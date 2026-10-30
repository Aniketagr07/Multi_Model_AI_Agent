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
 * Dispatches a chat message to the FastAPI backend (Synchronous non-streaming).
 * Target: POST /api/chat
 */
export async function sendChatMessage({
  message,
  model_id,
  conversation_id,
  messages,
  effort,
  custom_api_key,
  custom_provider,
  custom_base_url,
  custom_provider_model_id,
}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/chat`;

  const payload = {
    message,
    model_id,
    conversation_id: conversation_id || null,
    messages: messages && messages.length > 0 ? messages : null,
    effort: effort || 'medium',
    custom_api_key: custom_api_key || null,
    custom_provider: custom_provider || null,
    custom_base_url: custom_base_url || null,
    custom_provider_model_id: custom_provider_model_id || null,
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
 * Streams real-time chat completion tokens via Server-Sent Events (SSE).
 * Target: POST /api/chat/stream
 */
export async function streamChatMessage({
  message,
  model_id,
  conversation_id,
  messages,
  effort,
  custom_api_key,
  custom_provider,
  custom_base_url,
  custom_provider_model_id,
  signal,
  onMeta,
  onToken,
  onDone,
  onError,
}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/chat/stream`;

  const payload = {
    message,
    model_id: model_id || 'auto',
    conversation_id: conversation_id || null,
    messages: messages && messages.length > 0 ? messages : null,
    effort: effort || 'medium',
    custom_api_key: custom_api_key || null,
    custom_provider: custom_provider || null,
    custom_base_url: custom_base_url || null,
    custom_provider_model_id: custom_provider_model_id || null,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (networkError) {
    if (signal?.aborted) {
      throw new Error('Generation stopped by user.');
    }
    throw new Error(
      `Network connection failure: Unable to reach OmniAI backend at ${API_BASE_URL}. Ensure the FastAPI server is running.`
    );
  }

  if (!response.ok) {
    let errorMessage = `Streaming request failed with HTTP ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Non-JSON error fallback
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'meta' && onMeta) onMeta(event);
          else if (event.type === 'token' && onToken) onToken(event.token);
          else if (event.type === 'done' && onDone) onDone(event);
          else if (event.type === 'error' && onError) onError(event.error);
        } catch (parseErr) {
          console.warn('[OmniAI Stream] SSE JSON parse warning:', parseErr);
        }
      }
    }
  } catch (streamReadErr) {
    if (signal?.aborted) {
      throw new Error('Generation stopped by user.');
    }
    throw streamReadErr;
  }
}

/**
 * Dispatches a dynamic model discovery request to the FastAPI backend.
 * Target: POST /api/models/discover
 */
export async function discoverModels({ provider, api_key, base_url }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/models/discover`;

  const payload = {
    provider,
    api_key,
    base_url: base_url || null,
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
    let errorMessage = `Model discovery failed with HTTP ${response.status}`;
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
export async function sendCompareRequest({
  prompt,
  model_a_id,
  model_b_id,
  effort,
  custom_api_key_a,
  custom_provider_a,
  custom_base_url_a,
  custom_provider_model_id_a,
  custom_api_key_b,
  custom_provider_b,
  custom_base_url_b,
  custom_provider_model_id_b,
}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/compare`;

  const payload = {
    prompt,
    model_a_id,
    model_b_id,
    effort: effort || 'medium',
    custom_api_key_a: custom_api_key_a || null,
    custom_provider_a: custom_provider_a || null,
    custom_base_url_a: custom_base_url_a || null,
    custom_provider_model_id_a: custom_provider_model_id_a || null,
    custom_api_key_b: custom_api_key_b || null,
    custom_provider_b: custom_provider_b || null,
    custom_base_url_b: custom_base_url_b || null,
    custom_provider_model_id_b: custom_provider_model_id_b || null,
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
