/**
 * API Service for communicating with OmniAI FastAPI Backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch health status from backend /api/health endpoint.
 * @returns {Promise<{app_name: string, status: string, version: string, environment: string, timestamp: string}>}
 */
export async function fetchHealthStatus() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/health`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch server-side registered models list from /api/models.
 * @returns {Promise<{models: Array<{id: string, name: string, provider: string, description: string, tag: string, is_available: boolean}>}>}
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
 * Fetch root service info from backend / endpoint.
 */
export async function fetchRootInfo() {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Dispatches a chat completion request to the FastAPI backend.
 * 
 * Contract:
 * POST /api/chat
 * Payload:
 * {
 *   "message": string,
 *   "model_id": string,
 *   "conversation_id": string | null,
 *   "messages": Array<{ role: "user" | "assistant", content: string }> | null
 * }
 * 
 * @param {Object} params
 * @param {string} params.message
 * @param {string} params.model_id
 * @param {string} [params.conversation_id]
 * @param {Array<{role: string, content: string}>} [params.messages]
 * @returns {Promise<{conversation_id: string, model_id: string, provider: string, response: string, latency_ms: number, timestamp: string}>}
 */
export async function sendChatMessage({ message, model_id, conversation_id, messages }) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/chat`;

  const payload = {
    message,
    model_id: model_id || 'gemini-1.5-flash',
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
    let errorMessage = `Server error (HTTP ${response.status})`;
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
