import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { chatAPI } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 30;

/**
 * Full-featured chat hook using the shared global socket.
 * Uses getSocket() so incoming_call, call history (new_message on user room),
 * and chat messages all go through ONE socket connection.
 */
export const useChat = (chatId, userId) => {
  const focused = useIsFocused();
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [connected, setConnected]     = useState(false);
  const [isTyping, setIsTyping]       = useState(false);
  const [error, setError]             = useState(null);
  const pageRef                       = useRef(1);
  const typingTimerRef                = useRef(null);
  const offlineQueueRef               = useRef([]);
  const joinedRef                     = useRef(false);

  // ── Load message history from REST API ──────────────────────────
  const loadMessages = useCallback(async (page = 1) => {
    if (!chatId) { setLoading(false); return; }
    try {
      const { data } = await chatAPI.getMessages(chatId, { page, limit: PAGE_SIZE });
      const incoming = data.data || [];
      await chatAPI.markRead(chatId);
      if (page === 1) {
        setMessages(incoming);
      } else {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m._id));
          const newOnes = incoming.filter(m => !existingIds.has(m._id));
          return [...newOnes, ...prev];
        });
      }
      setHasMore(incoming.length === PAGE_SIZE);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [chatId]);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    pageRef.current += 1;
    await loadMessages(pageRef.current);
  }, [loadingMore, hasMore, loadMessages]);

  // ── Flush queued messages when socket reconnects ─────────────────
  const flushOfflineQueue = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected) return;
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    queue.forEach(msg => socket.emit('send_message', msg));
  }, []);

  // ── Attach socket listeners using the GLOBAL socket ─────────────
  useEffect(() => {
    if (!chatId || !focused) { setLoading(false); return; }

    pageRef.current = 1;
    loadMessages(1);

    // Ensure global socket is connected
    const ensureAndJoin = async () => {
      let socket = getSocket();
      if (!socket) {
        socket = await connectSocket();
      }
      if (!socket) return;

      const doJoin = () => {
        if (joinedRef.current) return;
        joinedRef.current = true;
        socket.emit('join_chat', { chatId });
        socket.emit('mark_read', { chatId });
        setConnected(true);
        flushOfflineQueue();
      };

      if (socket.connected) {
        doJoin();
      } else {
        socket.once('connect', doJoin);
      }

      // ── Incoming message (from chat room OR user personal room) ──
      const onNewMessage = (msg) => {
        // Accept messages for this chat only
        const msgChatId = msg.chat?._id || msg.chat;
        if (msgChatId && msgChatId.toString() !== chatId.toString()) return;

        setMessages(prev => {
          if (prev.some(m => m._id?.toString() === msg._id?.toString())) return prev;
          return [...prev, msg];
        });
        socket.emit('mark_read', { chatId });
        chatAPI.markRead(chatId).catch(() => {});
      };

      const onRead = ({ chatId: cid, readAt }) => {
        if (cid !== chatId) return;
        setMessages(prev => prev.map(m => m.readAt ? m : { ...m, readAt }));
      };

      const onTyping      = () => { setIsTyping(true);  clearTimeout(typingTimerRef.current); typingTimerRef.current = setTimeout(() => setIsTyping(false), 2500); };
      const onStopTyping  = () => setIsTyping(false);
      const onDisconnect  = () => { setConnected(false); joinedRef.current = false; };
      const onReconnect   = () => { doJoin(); flushOfflineQueue(); };

      socket.on('new_message',        onNewMessage);
      socket.on('messages_read',      onRead);
      socket.on('user_typing',        onTyping);
      socket.on('user_stopped_typing', onStopTyping);
      socket.on('disconnect',         onDisconnect);
      socket.on('connect',            onReconnect);

      return () => {
        socket.emit('leave_chat', { chatId });
        socket.off('new_message',        onNewMessage);
        socket.off('messages_read',      onRead);
        socket.off('user_typing',        onTyping);
        socket.off('user_stopped_typing', onStopTyping);
        socket.off('disconnect',         onDisconnect);
        socket.off('connect',            onReconnect);
        joinedRef.current = false;
      };
    };

    let cleanup;
    let disposed = false;
    ensureAndJoin().then(fn => { if (disposed) fn?.(); else cleanup = fn; });

    return () => {
      disposed = true;
      clearTimeout(typingTimerRef.current);
      joinedRef.current = false;
      if (cleanup) cleanup();
    };
  }, [chatId, focused, loadMessages, flushOfflineQueue]);

  useFocusEffect(useCallback(() => {
    if (chatId) chatAPI.markRead(chatId).catch(() => {});
  }, [chatId]));

  // ── Send a message ────────────────────────────────────────────────
  const sendMessage = useCallback((content, messageType = 'text', fileUrl, fileName) => {
    const payload = { chatId, content, messageType, fileUrl, fileName };
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('send_message', payload);
      return true;
    } else {
      offlineQueueRef.current.push(payload);
      const optimistic = {
        _id:         `offline-${Date.now()}`,
        chat:        chatId,
        sender:      userId,
        content,
        messageType,
        fileUrl,
        fileName,
        createdAt:   new Date().toISOString(),
        pending:     true,
      };
      setMessages(prev => [...prev, optimistic]);
      return false;
    }
  }, [chatId, userId]);

  const sendTyping     = useCallback(() => getSocket()?.emit('typing',      { chatId }), [chatId]);
  const sendStopTyping = useCallback(() => getSocket()?.emit('stop_typing', { chatId }), [chatId]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    connected,
    isTyping,
    error,
    sendMessage,
    sendTyping,
    sendStopTyping,
    loadMoreMessages,
  };
};

/**
 * Hook for the chat list screen.
 * Uses the global socket for conversation_updated events.
 */
export const useChatList = () => {
  const { user }       = useAuth();
  const navigation     = useNavigation();
  const [chats, setChats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await chatAPI.getMyChats();
      setChats(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on screen focus
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', fetchChats);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (unsubscribe?.remove) unsubscribe.remove();
    };
  }, [navigation, fetchChats]);

  // Initial fetch + global socket listener for real-time updates
  useEffect(() => {
    fetchChats();

    const setupListener = async () => {
      let socket = getSocket();
      if (!socket) socket = await connectSocket();
      if (!socket) return;

      const onUpdated = ({ chatId, lastMessage, updatedAt }) => {
        setChats(prev => {
          const exists = prev.some(c => c._id === chatId);
          if (!exists) { fetchChats(); return prev; }
          const myId = user?._id?.toString() || user?.id?.toString();
          const isMyMsg = lastMessage?.senderId && myId && lastMessage.senderId.toString() === myId;
          return prev.map(c => {
            if (c._id !== chatId) return c;
            return {
              ...c,
              lastMessage: { content: lastMessage.content },
              updatedAt,
              unreadCount: isMyMsg ? (c.unreadCount || 0) : (c.unreadCount || 0) + 1,
            };
          });
        });
      };

      // Also refresh list when a new_message arrives (for call history bubbles)
      const onNewMsg = (msg) => {
        setChats(prev => {
          const chatId = msg.chat?._id || msg.chat;
          if (!chatId) return prev;
          return prev.map(c => {
            if (c._id?.toString() !== chatId?.toString()) return c;
            const myId = user?._id?.toString() || user?.id?.toString();
            const isMe = msg.sender?._id?.toString() === myId;
            return {
              ...c,
              lastMessage: { content: msg.content },
              updatedAt:   msg.createdAt || new Date().toISOString(),
              unreadCount: isMe ? (c.unreadCount || 0) : (c.unreadCount || 0) + 1,
            };
          });
        });
      };

      socket.on('conversation_updated', fetchChats);
      socket.on('new_message', fetchChats);
      socket.on('messages_read', fetchChats);

      return () => {
        socket.off('conversation_updated', fetchChats);
        socket.off('new_message', fetchChats);
        socket.off('messages_read', fetchChats);
      };
    };

    let cleanup;
    setupListener().then(fn => { cleanup = fn; });
    return () => { if (cleanup) cleanup(); };
  }, [fetchChats, user]);

  return { chats, loading, error, refetch: fetchChats };
};
