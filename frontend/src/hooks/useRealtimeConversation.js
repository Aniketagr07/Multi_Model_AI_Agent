import { useState, useEffect, useRef, useCallback } from 'react';

const rawApiUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = rawApiUrl !== undefined ? rawApiUrl : 'http://127.0.0.1:8000';

export function useRealtimeConversation({
  conversationId,
  token,
  onMessageReceived,
  onAssistantChunk,
  onAssistantDone,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]); // Array of strings (display names)

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const userTypingTimersRef = useRef({});

  const connect = useCallback(() => {
    if (!conversationId) return;

    try {
      const parsed = new URL(API_BASE_URL.replace(/\/+$/, ''));
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${parsed.host}/api/conversations/ws/${encodeURIComponent(conversationId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.type) return;

          switch (data.type) {
            case 'presence_update':
              if (Array.isArray(data.presence)) {
                setPresence(data.presence);
              }
              break;

            case 'user_typing':
              if (data.name) {
                const userName = data.name;
                if (data.is_typing) {
                  setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));

                  // Auto-clear typing after 3.5 seconds
                  if (userTypingTimersRef.current[userName]) {
                    clearTimeout(userTypingTimersRef.current[userName]);
                  }
                  userTypingTimersRef.current[userName] = setTimeout(() => {
                    setTypingUsers((prev) => prev.filter((u) => u !== userName));
                    delete userTypingTimersRef.current[userName];
                  }, 3500);
                } else {
                  setTypingUsers((prev) => prev.filter((u) => u !== userName));
                  if (userTypingTimersRef.current[userName]) {
                    clearTimeout(userTypingTimersRef.current[userName]);
                    delete userTypingTimersRef.current[userName];
                  }
                }
              }
              break;

            case 'new_message':
              if (data.message && onMessageReceived) {
                onMessageReceived(data.message);
              }
              break;

            case 'assistant_chunk':
              if (data.token && onAssistantChunk) {
                onAssistantChunk(data);
              }
              break;

            case 'assistant_done':
              if (data.message && onAssistantDone) {
                onAssistantDone(data.message);
              }
              break;

            case 'pong':
              break;

            default:
              break;
          }
        } catch (err) {
          // Ignore parse errors on malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      setIsConnected(false);
    }
  }, [conversationId, token, onMessageReceived, onAssistantChunk, onAssistantDone]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      setPresence([]);
      setTypingUsers([]);
      Object.values(userTypingTimersRef.current).forEach(clearTimeout);
      userTypingTimersRef.current = {};
    };
  }, [connect]);

  // Send typing indicator (debounced)
  const sendTyping = useCallback(
    (isTyping = true) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

      socketRef.current.send(
        JSON.stringify({
          type: 'user_typing',
          is_typing: isTyping,
        })
      );

      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: 'user_typing',
                is_typing: false,
              })
            );
          }
        }, 3000);
      }
    },
    []
  );

  return {
    isConnected,
    presence,
    typingUsers,
    sendTyping,
  };
}

