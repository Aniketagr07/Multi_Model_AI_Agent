/**
 * OmniAI API Service
 * Centralizes all asynchronous communication between the React frontend
 * and the FastAPI backend, providing typed payload contracts and error normalization.
 */

export function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = window.__OMNIAI_API_URL__ || localStorage.getItem('omniai_api_base_url');
    if (custom && String(custom).trim() !== '') {
      return String(custom).trim().replace(/\/+$/, '');
    }
  }

  const envUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : import.meta.env.VITE_API_BASE_URL;
  const isEnvSet = envUrl !== undefined && envUrl !== null && String(envUrl).trim() !== '';
  const trimmedEnv = isEnvSet ? String(envUrl).trim().replace(/\/+$/, '') : '';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

    if (!isLocalhost) {
      // In production browser, never call localhost (prevents mixed content and unreachable 127.0.0.1 errors)
      if (trimmedEnv && !trimmedEnv.includes('localhost') && !trimmedEnv.includes('127.0.0.1')) {
        return trimmedEnv;
      }
      return '';
    }
  }

  if (trimmedEnv) {
    return trimmedEnv;
  }

  return 'http://127.0.0.1:8000';
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Retrieves single-user access token from localStorage or Vite environment if configured.
 */
export function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const userToken = localStorage.getItem('omniai_user_token');
  const token = userToken || localStorage.getItem('omniai_access_token') || import.meta.env.VITE_ACCESS_TOKEN || '';
  if (token && token.trim()) {
    return {
      'X-OmniAI-Token': token.trim(),
      'Authorization': `Bearer ${token.trim()}`,
    };
  }
  return {};
}

/**
 * Authenticated fetch wrapper that merges auth headers automatically.
 */
export async function authFetch(url, options = {}) {
  const authHeaders = getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  };
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });
}

/**
 * Checks backend health status.
 * Target: GET /api/health
 */
export async function checkBackendHealth() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/health`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await authFetch(url, {
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

export const fetchHealthStatus = checkBackendHealth;

/**
 * Fetches the server-side model registry.
 * Target: GET /api/models
 */
export async function fetchModelRegistry() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/models`;

  const response = await authFetch(url, {
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
 * Fetches model usage sliding window analytics and remaining quotas.
 * Target: GET /api/usage
 */
export async function fetchModelUsage() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/usage`;

  const response = await authFetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch usage: HTTP ${response.status}`);
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
  document_id,
  custom_instructions,
  custom_api_key,
  custom_provider,
  custom_base_url,
  custom_provider_model_id,
  skill_id,
  skillId,
}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/chat`;

  const payload = {
    message,
    model_id,
    conversation_id: conversation_id || null,
    messages: messages && messages.length > 0 ? messages : null,
    effort: effort || 'medium',
    document_id: document_id || null,
    custom_instructions: custom_instructions || null,
    custom_api_key: custom_api_key || null,
    custom_provider: custom_provider || null,
    custom_base_url: custom_base_url || null,
    custom_provider_model_id: custom_provider_model_id || null,
    skill_id: skill_id || skillId || null,
  };

  let response;
  try {
    response = await authFetch(url, {
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
  document_id,
  custom_instructions,
  custom_api_key,
  custom_provider,
  custom_base_url,
  custom_provider_model_id,
  skill_id,
  skillId,
  signal,
  onMeta,
  onToken,
  onChunk,
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
    document_id: document_id || null,
    custom_instructions: custom_instructions || null,
    custom_api_key: custom_api_key || null,
    custom_provider: custom_provider || null,
    custom_base_url: custom_base_url || null,
    custom_provider_model_id: custom_provider_model_id || null,
    skill_id: skill_id || skillId || null,
  };

  let response;
  try {
    response = await authFetch(url, {
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
          else if (event.type === 'token') {
            const tok = event.token !== undefined ? event.token : (event.chunk || '');
            if (onToken) onToken(tok);
            if (onChunk) onChunk(tok);
          }
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
 * Uploads a document (PDF, TXT, MD) to the backend with progress tracking.
 * Target: POST /api/documents/upload
 */
export async function uploadDocument(file, conversationId = null, onProgress = null) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/documents/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    const authHeaders = getAuthHeaders();
    for (const [headerKey, headerVal] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(headerKey, headerVal);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON response from server.'));
        }
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson.detail) errorMsg = errJson.detail;
        } catch (_) {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error uploading document.'));
    };

    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    xhr.send(formData);
  });
}

/**
 * Deletes an uploaded document from backend storage.
 * Target: DELETE /api/documents/{id}
 */
export async function deleteDocumentApi(documentId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/documents/${documentId}`;
  const response = await authFetch(url, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    throw new Error(`Failed to delete document: HTTP ${response.status}`);
  }
  return true;
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
    response = await authFetch(url, {
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
    response = await authFetch(url, {
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

const USER_CONVERSATIONS_KEY = 'omniai_user_conversations';

export function getStoredUserConversations() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredUserConversations(convs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_CONVERSATIONS_KEY, JSON.stringify(convs));
  } catch (e) {
    console.warn('Failed to save user conversations to localStorage', e);
  }
}

export function saveUserMessage(conversationId, message) {
  if (typeof window === 'undefined' || !conversationId) return;
  const convs = getStoredUserConversations();
  let conv = convs.find((c) => c.id === conversationId);
  const now = new Date().toISOString();
  if (!conv) {
    conv = {
      id: conversationId,
      title: (message && message.content ? message.content.slice(0, 36) : 'New Conversation'),
      created_at: now,
      updated_at: now,
      message_count: 0,
      is_pinned: 0,
      is_archived: 0,
      messages: [],
    };
    convs.unshift(conv);
  }
  if (!conv.messages) conv.messages = [];
  if (message) {
    const existingIdx = conv.messages.findIndex((m) => m.id === message.id);
    if (existingIdx >= 0) {
      conv.messages[existingIdx] = { ...conv.messages[existingIdx], ...message };
    } else {
      conv.messages.push(message);
    }
    conv.updated_at = now;
    conv.message_count = conv.messages.length;
  }
  saveStoredUserConversations(convs);
}

/**
 * Fetches all persistent conversations. Supports search filtering.
 * Target: GET /api/conversations(?q=...)
 */
export async function fetchConversations(query = null) {
  const localList = getStoredUserConversations();
  try {
    const params = new URLSearchParams();
    if (query && query.trim()) {
      params.set('q', query.trim());
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations${queryString}`;

    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const serverList = Array.isArray(data) ? data : (data.conversations || []);
      const mergedMap = new Map();
      localList.forEach((c) => mergedMap.set(c.id, c));
      serverList.forEach((c) => {
        const local = mergedMap.get(c.id);
        if (local && local.messages?.length > (c.message_count || 0)) {
          mergedMap.set(c.id, { ...c, messages: local.messages });
        } else {
          mergedMap.set(c.id, c);
        }
      });
      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      );
      saveStoredUserConversations(merged);
      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        return merged.filter((c) => (c.title || '').toLowerCase().includes(q));
      }
      return merged;
    }
  } catch (err) {
    console.warn('[OmniAI Storage] Server fetch failed, using local user storage:', err.message);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    return localList.filter((c) => (c.title || '').toLowerCase().includes(q));
  }
  return localList;
}

/**
 * Fetches single conversation details and its complete message history.
 * Target: GET /api/conversations/{id}
 */
export async function fetchConversationDetails(conversationId) {
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;

    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.id) {
        saveUserMessage(data.id, null);
        return data;
      }
    }
  } catch (e) {}

  const localList = getStoredUserConversations();
  const conv = localList.find((c) => c.id === conversationId);
  if (conv) {
    return {
      id: conv.id,
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      user_role: 'owner',
      messages: conv.messages || [],
    };
  }

  throw new Error(`Failed to load conversation: ${conversationId}`);
}

/**
 * Creates a new conversation in persistent storage.
 * Target: POST /api/conversations
 */
export async function createConversation(title = 'New Conversation') {
  const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newConv = {
    id: newId,
    title,
    created_at: now,
    updated_at: now,
    message_count: 0,
    is_pinned: 0,
    is_archived: 0,
    messages: [],
  };

  const convs = getStoredUserConversations();
  convs.unshift(newConv);
  saveStoredUserConversations(convs);

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations`;
    await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ id: newId, title }),
    });
  } catch (e) {}

  return newConv;
}

/**
 * Renames a conversation title.
 * Target: PATCH /api/conversations/{id}
 */
export async function renameConversation(conversationId, title) {
  const convs = getStoredUserConversations();
  const conv = convs.find((c) => c.id === conversationId);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date().toISOString();
    saveStoredUserConversations(convs);
  }

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;
    await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
  } catch (e) {}

  return { id: conversationId, title };
}

/**
 * Deletes a conversation and all its messages.
 * Target: DELETE /api/conversations/{id}
 */
export async function deleteConversationApi(conversationId) {
  const convs = getStoredUserConversations().filter((c) => c.id !== conversationId);
  saveStoredUserConversations(convs);

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}`;
    await authFetch(url, {
      method: 'DELETE',
    });
  } catch (e) {}

  return true;
}

/**
 * Pins or unpins a conversation.
 * Target: PATCH /api/conversations/{id}/pin
 */
export async function pinConversationApi(conversationId, isPinned) {
  const convs = getStoredUserConversations();
  const conv = convs.find((c) => c.id === conversationId);
  if (conv) {
    conv.is_pinned = isPinned ? 1 : 0;
    conv.pinned_at = isPinned ? new Date().toISOString() : null;
    saveStoredUserConversations(convs);
  }

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}/pin`;
    await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ is_pinned: Boolean(isPinned) }),
    });
  } catch (e) {}

  return { id: conversationId, is_pinned: Boolean(isPinned) };
}

/**
 * Archives or restores a conversation.
 * Target: PATCH /api/conversations/{id}/archive
 */
export async function archiveConversationApi(conversationId, isArchived) {
  const convs = getStoredUserConversations();
  const conv = convs.find((c) => c.id === conversationId);
  if (conv) {
    conv.is_archived = isArchived ? 1 : 0;
    saveStoredUserConversations(convs);
  }

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}/archive`;
    await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ is_archived: Boolean(isArchived) }),
    });
  } catch (e) {}

  return { id: conversationId, is_archived: Boolean(isArchived) };
}

/**
 * Downloads a conversation export as Markdown, Plain Text, or sanitized JSON.
 * Target: GET /api/conversations/{id}/export?format={format}
 */
export async function exportConversationApi(conversationId, format = 'markdown') {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}/export?format=${encodeURIComponent(format)}`;

  const response = await authFetch(url);
  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = `conversation.${format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json'}`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);

  return filename;
}

/**
 * Fetches user settings, preferences, and custom instructions from backend.
 * Target: GET /api/settings
 */
export async function fetchUserSettings() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/settings`;

  const response = await authFetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load settings: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Persists updated user preferences, theme, and custom instructions to backend SQLite.
 * Target: PUT /api/settings
 */
export async function saveUserSettings(settingsPayload) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/settings`;

  const response = await authFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(settingsPayload),
  });

  if (!response.ok) {
    let errorDetail = `Failed to save settings: HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return await response.json();
}


// ----------------------------------------------------------------------------
// User Authentication API
// ----------------------------------------------------------------------------

export async function registerUser(email, username, password) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/register`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  return await response.json();
}

export async function loginUser(email, password) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Invalid email or password');
  }
  return await response.json();
}

export async function logoutUser() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/logout`;
  try {
    await authFetch(url, { method: 'POST' });
  } catch (_) {}
  localStorage.removeItem('omniai_user_token');
}

export async function fetchCurrentUser() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/me`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error('Not authenticated');
  }
  return await response.json();
}

export async function deleteUserAccount() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/account`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete account');
  }
  localStorage.removeItem('omniai_user_token');
  return await response.json();
}

// ----------------------------------------------------------------------------
// Skills Marketplace API
// ----------------------------------------------------------------------------

export async function fetchSkillsCatalog(category = null, query = null, installedOnly = false, featuredOnly = false) {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (query && query.trim()) params.append('q', query.trim());
  if (installedOnly) params.append('installed_only', 'true');
  if (featuredOnly) params.append('featured_only', 'true');

  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills${qs}`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to load skills: HTTP ${response.status}`);
  }
  return await response.json();
}

export async function fetchSkillDetail(skillId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/${encodeURIComponent(skillId)}`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error('Skill not found');
  }
  return await response.json();
}

export async function installSkill(skillId, consent = true, config = null) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/${encodeURIComponent(skillId)}/install`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consent, config }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Installation failed' }));
    throw new Error(err.detail || 'Installation failed');
  }
  return await response.json();
}

export async function uninstallSkill(skillId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/${encodeURIComponent(skillId)}/install`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to uninstall skill');
  }
  return await response.json();
}

export async function toggleSkillStatus(skillId, enabled) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/${encodeURIComponent(skillId)}/toggle`;
  const response = await authFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update skill' }));
    throw new Error(err.detail || 'Failed to update skill status');
  }
  return await response.json();
}

export async function executeSkill(skillId, params = {}, conversationId = null) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/${encodeURIComponent(skillId)}/execute`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ params, conversation_id: conversationId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Skill execution failed' }));
    throw new Error(err.detail || 'Skill execution failed');
  }
  return await response.json();
}

export async function fetchSkillExecutionHistory(limit = 20) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/skills/executions/history?limit=${limit}`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error('Failed to load execution history');
  }
  return await response.json();
}



// ----------------------------------------------------------------------------
// OAuth & Extended Account Services
// ----------------------------------------------------------------------------

export async function fetchOAuthProvidersStatus() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/oauth/providers`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error('Failed to fetch OAuth providers status');
  }
  return await response.json();
}

export async function fetchOAuthUrl(provider, action = 'login', redirectUri = null) {
  const params = new URLSearchParams({ action });
  if (redirectUri) {
    params.append('redirect_uri', redirectUri);
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/oauth/${encodeURIComponent(provider)}/url?${params.toString()}`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to generate OAuth URL' }));
    throw new Error(err.detail || 'Failed to generate OAuth URL');
  }
  return await response.json();
}

export async function handleOAuthCallback(provider, code, state, redirectUri = null) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/oauth/${encodeURIComponent(provider)}/callback`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'OAuth authentication failed' }));
    throw new Error(err.detail || 'OAuth authentication failed');
  }
  return await response.json();
}

export async function fetchLinkedProviders() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/linked-providers`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error('Failed to fetch linked providers');
  }
  return await response.json();
}

export async function unlinkProvider(provider) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/linked-providers/${encodeURIComponent(provider)}`;
  const response = await authFetch(url, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to unlink provider' }));
    throw new Error(err.detail || 'Failed to unlink provider');
  }
  return await response.json();
}

export async function requestPasswordReset(email) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/forgot-password`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to request password reset' }));
    throw new Error(err.detail || 'Failed to request password reset');
  }
  return await response.json();
}

export async function migrateGuestConversations(data = null) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/auth/migrate-guest-conversations`;
  let bodyPayload = {};
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'string') {
      bodyPayload = { conversation_ids: data };
    } else {
      bodyPayload = { conversations: data };
    }
  } else if (data && typeof data === 'object') {
    bodyPayload = data;
  }
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to migrate guest conversations' }));
    throw new Error(err.detail || 'Failed to migrate guest conversations');
  }
  return await response.json();
}

// -----------------------------------------------------------------------------
// Conversation Sharing & Real-Time Collaboration
// -----------------------------------------------------------------------------

export async function getConversationShareSettings(conversationId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/share`;
  const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to load share settings' }));
    const error = new Error(err.detail || 'Failed to load share settings');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function updateConversationShareSettings(conversationId, { sharing_enabled, share_permission }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/share`;
  const response = await authFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ sharing_enabled, share_permission }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update share settings' }));
    const error = new Error(err.detail || 'Failed to update share settings');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function createConversationInvitation(conversationId, { email, role = 'editor', expiry_days = 7 }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/invitations`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: email || null, role, expiry_days }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to send invitation' }));
    const error = new Error(err.detail || 'Failed to send invitation');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function revokeConversationInvitation(conversationId, invitationId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/invitations/${encodeURIComponent(invitationId)}`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to revoke invitation' }));
    const error = new Error(err.detail || 'Failed to revoke invitation');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function removeConversationMember(conversationId, targetUserId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(targetUserId)}`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
    const error = new Error(err.detail || 'Failed to remove member');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function updateConversationMemberRole(conversationId, targetUserId, role) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(targetUserId)}`;
  const response = await authFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update member role' }));
    const error = new Error(err.detail || 'Failed to update member role');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export async function joinConversationByToken(token) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/join/${encodeURIComponent(token)}`;
  const response = await authFetch(url, { method: 'POST', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to join conversation' }));
    const error = new Error(err.detail || 'Failed to join conversation');
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

// -----------------------------------------------------------------------------
// Collaborative Projects Workspaces (With Resilient Edge & Local Fallback)
// -----------------------------------------------------------------------------

const USER_PROJECTS_KEY = 'omniai_user_projects';

export function getStoredUserProjects() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredUserProjects(projs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PROJECTS_KEY, JSON.stringify(projs));
  } catch (e) {
    console.warn('Failed to save user projects to localStorage', e);
  }
}

export async function fetchProjects() {
  const localList = getStoredUserProjects();
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects`;
    const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      const serverList = Array.isArray(data) ? data : (data.projects || []);
      const map = new Map();
      localList.forEach(p => map.set(p.id, p));
      serverList.forEach(p => map.set(p.id, { ...map.get(p.id), ...p }));
      const merged = Array.from(map.values());
      saveStoredUserProjects(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[OmniAI Projects] Server fetch failed, using local storage:', err.message);
  }
  return localList;
}

export async function createProject({ name, description, icon = 'folder', visibility = 'private' }) {
  const localList = getStoredUserProjects();
  const now = new Date().toISOString();
  const tempId = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const newProj = {
    id: tempId,
    name,
    description: description || null,
    icon,
    visibility,
    owner_id: 'usr_me',
    created_at: now,
    updated_at: now,
    current_user_role: 'owner',
    member_count: 1,
    conversation_count: 0,
    file_count: 0,
    members: [{
      id: 'mem_' + Date.now(),
      user_id: 'usr_me',
      display_name: 'You (Owner)',
      email: 'user@omniai.app',
      role: 'owner',
      joined_at: now
    }],
    conversations: [],
    files: [],
    skills: [],
    recent_activity: [{
      id: 'act_' + Date.now(),
      event_type: 'project_created',
      details: `Project "${name}" created`,
      created_at: now
    }],
    pending_invitations: []
  };

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, description, icon, visibility }),
    });
    if (response.ok) {
      const serverProj = await response.json();
      const updatedList = [serverProj, ...localList.filter(p => p.id !== tempId)];
      saveStoredUserProjects(updatedList);
      return serverProj;
    }
  } catch (e) {
    console.warn('[OmniAI Projects] Remote creation fallback to local:', e.message);
  }

  localList.unshift(newProj);
  saveStoredUserProjects(localList);
  return newProj;
}

export async function fetchProjectDetail(projectId) {
  const localList = getStoredUserProjects();
  const cached = localList.find(p => p.id === projectId);
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}`;
    const response = await authFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      const updatedList = localList.map(p => p.id === projectId ? { ...p, ...data } : p);
      if (!updatedList.some(p => p.id === projectId)) updatedList.push(data);
      saveStoredUserProjects(updatedList);
      return data;
    }
  } catch (err) {
    console.warn('[OmniAI Projects] Server load failed, using local project detail:', err.message);
  }
  if (cached) return cached;
  return {
    id: projectId,
    name: 'Project Workspace',
    description: '',
    icon: 'folder',
    visibility: 'private',
    owner_id: 'usr_me',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_user_role: 'owner',
    member_count: 1,
    conversation_count: 0,
    file_count: 0,
    members: [],
    conversations: [],
    files: [],
    skills: [],
    recent_activity: [],
    pending_invitations: []
  };
}

export async function updateProject(projectId, updateData) {
  const localList = getStoredUserProjects();
  const updatedList = localList.map(p => p.id === projectId ? { ...p, ...updateData, updated_at: new Date().toISOString() } : p);
  saveStoredUserProjects(updatedList);
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}`;
    const response = await authFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(updateData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[OmniAI Projects] Remote update failed:', err.message);
  }
  return updatedList.find(p => p.id === projectId);
}

export async function deleteProject(projectId) {
  const localList = getStoredUserProjects();
  saveStoredUserProjects(localList.filter(p => p.id !== projectId));
  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}`;
    const response = await authFetch(url, { method: 'DELETE' });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[OmniAI Projects] Remote delete failed:', err.message);
  }
  return { success: true, id: projectId };
}

export async function createProjectInvitation(projectId, { email, role = 'member', expiry_days = 7 }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/invitations`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: email || null, role, expiry_days }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to invite project member' }));
    throw new Error(err.detail || 'Failed to invite project member');
  }
  return await response.json();
}

export async function joinProjectByToken(token) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/join/${encodeURIComponent(token)}`;
  const response = await authFetch(url, { method: 'POST', headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to join project' }));
    throw new Error(err.detail || 'Failed to join project');
  }
  return await response.json();
}

export async function updateProjectMemberRole(projectId, targetUserId, role) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(targetUserId)}?role=${encodeURIComponent(role)}`;
  const response = await authFetch(url, { method: 'PATCH' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update member role' }));
    throw new Error(err.detail || 'Failed to update member role');
  }
  return await response.json();
}

export async function removeProjectMember(projectId, targetUserId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(targetUserId)}`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
    throw new Error(err.detail || 'Failed to remove member');
  }
  return await response.json();
}

export async function moveConversationToProject(projectId, conversationId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/conversations/move`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to move conversation' }));
    throw new Error(err.detail || 'Failed to move conversation');
  }
  return await response.json();
}

export async function toggleProjectSkill(projectId, skillId, isEnabled) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillId)}?is_enabled=${isEnabled ? 'true' : 'false'}`;
  const response = await authFetch(url, { method: 'PATCH' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to toggle project skill' }));
    throw new Error(err.detail || 'Failed to toggle project skill');
  }
  return await response.json();
}

export async function uploadProjectFile(projectId, file) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/files`;
  const formData = new FormData();
  formData.append('file', file);
  const authHeaders = getAuthHeaders();
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...authHeaders,
    },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to upload project file' }));
    throw new Error(err.detail || 'Failed to upload project file');
  }
  return await response.json();
}

export async function deleteProjectFile(projectId, fileId) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`;
  const response = await authFetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to delete file' }));
    throw new Error(err.detail || 'Failed to delete file');
  }
  return await response.json();
}

// -----------------------------------------------------------------------------
// BYOK (Bring Your Own API Key) Service Methods
// -----------------------------------------------------------------------------

export async function getBYOKStatus() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/byok/status`;
  const response = await authFetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to load API key status' }));
    throw new Error(err.detail || 'Failed to load API key status');
  }
  const data = await response.json();
  if (typeof window !== 'undefined' && data?.providers) {
    data.providers = data.providers.map((p) => {
      const isDisabled = localStorage.getItem(`omniai_byok_${p.provider}_disabled`) === 'true';
      const customFp = localStorage.getItem(`omniai_byok_${p.provider}_fp`);
      if (isDisabled) {
        return {
          ...p,
          is_connected: false,
          key_fingerprint: null,
          connection_status: 'disconnected',
        };
      }
      if (customFp) {
        return {
          ...p,
          is_connected: true,
          key_fingerprint: customFp,
          connection_status: 'active',
        };
      }
      return p;
    });
    const total = data.providers.filter((p) => p.is_connected).length;
    data.total_connected = total;
    data.has_active_provider = total > 0;
    data.byok_setup_completed = total > 0;
  }
  return data;
}

export async function validateBYOKKey(provider, apiKey) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/byok/validate`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Validation request failed' }));
    throw new Error(err.detail || 'Validation request failed');
  }
  return await response.json();
}

export async function saveBYOKKey(provider, apiKey) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`omniai_byok_${provider}_disabled`);
    const fp = apiKey.length >= 8 ? '••••••••••••' + apiKey.slice(-4) : '••••••••••••key';
    localStorage.setItem(`omniai_byok_${provider}_fp`, fp);
    localStorage.setItem(`omniai_byok_${provider}_key`, apiKey);
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/byok/save`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to save API key' }));
    throw new Error(err.detail || 'Failed to save API key');
  }
  return await response.json();
}

export async function deleteBYOKKey(provider) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`omniai_byok_${provider}_disabled`, 'true');
    localStorage.removeItem(`omniai_byok_${provider}_fp`);
    localStorage.removeItem(`omniai_byok_${provider}_key`);
  }
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/byok/${encodeURIComponent(provider)}`;
  const response = await authFetch(url, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to remove API key' }));
    throw new Error(err.detail || 'Failed to remove API key');
  }
  return await response.json();
}

