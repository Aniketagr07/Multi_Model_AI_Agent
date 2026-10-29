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

/**
 * Dispatches a multi-model comparison request to the FastAPI backend.
 * 
 * Contract:
 * POST /api/compare
 * Payload:
 * {
 *   "prompt": string,
 *   "model_a_id": string,
 *   "model_b_id": string
 * }
 * 
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} params.model_a_id
 * @param {string} params.model_b_id
 * @returns {Promise<{prompt: string, model_a: Object, model_b: Object, timestamp: string}>}
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
