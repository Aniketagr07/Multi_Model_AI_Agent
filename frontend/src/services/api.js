/**
 * OmniAI API Service
 * Centralizes all asynchronous communication between the React frontend
 * and the FastAPI backend, providing typed payload contracts and error normalization.
 */

const rawApiUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = rawApiUrl !== undefined ? rawApiUrl : 'http://127.0.0.1:8000';

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

/**
 * Fetches all persistent conversations from SQLite. Supports search filtering.
 * Target: GET /api/conversations(?q=...)
 */
export async function fetchConversations(query = null) {
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

  const response = await authFetch(url, {
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

  const response = await authFetch(url, {
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

  const response = await authFetch(url, {
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

  const response = await authFetch(url, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete conversation: HTTP ${response.status}`);
  }

  return true;
}

/**
 * Pins or unpins a conversation.
 * Target: PATCH /api/conversations/{id}/pin
 */
export async function pinConversationApi(conversationId, isPinned) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}/pin`;

  const response = await authFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ is_pinned: Boolean(isPinned) }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update pin state: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Archives or restores a conversation.
 * Target: PATCH /api/conversations/{id}/archive
 */
export async function archiveConversationApi(conversationId, isArchived) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/conversations/${conversationId}/archive`;

  const response = await authFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ is_archived: Boolean(isArchived) }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update archive state: HTTP ${response.status}`);
  }

  return await response.json();
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
