import { useState, useEffect, useCallback } from 'react';
import { fetchHealthStatus } from '../services/api';

export function useHealthCheck() {
  const [status, setStatus] = useState('checking'); // 'idle' | 'checking' | 'connected' | 'disconnected'
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      const result = await fetchHealthStatus();
      setData(result);
      setStatus('connected');
      setLastChecked(new Date());
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown connection error');
      setStatus('disconnected');
      setData(null);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    status,
    data,
    error,
    lastChecked,
    checkHealth,
  };
}

