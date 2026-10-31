import { useState, useEffect, useCallback } from 'react';
import {
  loginUser,
  registerUser,
  logoutUser,
  fetchCurrentUser,
  deleteUserAccount,
} from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('omniai_user_token') || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate session token on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const storedToken = localStorage.getItem('omniai_user_token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await fetchCurrentUser();
        if (isMounted) {
          setUser(userData);
          setToken(storedToken);
        }
      } catch (_) {
        if (isMounted) {
          localStorage.removeItem('omniai_user_token');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('omniai_user_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }, []);

  const register = useCallback(async (email, username, password) => {
    setError(null);
    try {
      const data = await registerUser(email, username, password);
      localStorage.setItem('omniai_user_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (_) {}
    localStorage.removeItem('omniai_user_token');
    setToken(null);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await deleteUserAccount();
      setToken(null);
      setUser(null);
    } catch (err) {
      setError(err.message || 'Failed to delete account');
      throw err;
    }
  }, []);

  
  const setAuthSession = useCallback((authData) => {
    if (authData?.token) {
      localStorage.setItem('omniai_user_token', authData.token);
      setToken(authData.token);
    }
    if (authData?.user) {
      setUser(authData.user);
    }
    return authData?.user;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await fetchCurrentUser();
      setUser(userData);
      return userData;
    } catch (_) {
      return null;
    }
  }, []);

  return {
    user,
    token,
    isGuest: !user,
    isLoading,
    error,
    login,
    register,
    logout,
    deleteAccount,
    setAuthSession,
    refreshUser,
  };
}

