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
