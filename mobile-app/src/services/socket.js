// src/services/socket.js
// Singleton Socket.io client for real-time updates
// Used by MyBookingsScreen, ChatScreen, AdvocateDashboard, AuthContext

import { io } from 'socket.io-client';
import * as SecureStore from '../utils/secureStorage';
import { BASE_URL } from './api';

// Strip /api/v1 to get base server URL
const SOCKET_URL = BASE_URL.replace('/api/v1', '');

// MUST match TOKEN_KEY in api.js
const TOKEN_KEY = 'authToken';

let socket = null;
let connectionPromise = null; // Lock for concurrent connection attempts

/**
 * Connect to Socket.io server with JWT token.
 * Returns a Promise that resolves when actually connected (or rejects on error).
 */
export const connectSocket = (tokenOverride) => {
  // Already live — reuse
  if (socket && socket.connected) {
    return Promise.resolve(socket);
  }

  // If a connection is already in progress, return the same promise
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise(async (resolve) => {
    try {
      const token = tokenOverride || await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        console.log('[Socket] No auth token — not connecting');
        connectionPromise = null;
        return resolve(null);
      }

      // Disconnect stale socket before creating new one
      if (socket) { socket.disconnect(); socket = null; }

      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'], // websocket FIRST for low latency
        reconnectionAttempts: 15,             // More attempts for Render cold-starts
        reconnectionDelay: 2000,              // Start with 2s delay
        reconnectionDelayMax: 10000,          // Max 10s between attempts
        randomizationFactor: 0.3,            // Add jitter to avoid thundering herd
        timeout: 20000,                       // 20s timeout for Render cold-starts
      });

      socket.once('connect', () => {
        console.log('[Socket] ✅ Connected:', socket.id);
        connectionPromise = null;
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        console.log('[Socket] ❌ Error:', err.message);
      });

      socket.io.on('reconnect', (attempt) => {
        console.log('[Socket] 🔄 Reconnected after', attempt, 'attempts');
        connectionPromise = null;
        resolve(socket);
      });

      socket.io.on('reconnect_failed', () => {
        console.log('[Socket] ❌ All reconnection attempts failed');
        connectionPromise = null;
        resolve(null);
      });

      socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));

    } catch (err) {
      console.log('[Socket] Failed:', err.message);
      connectionPromise = null;
      resolve(null);
    }
  });

  return connectionPromise;
};

/**
 * Get current socket synchronously (already connected).
 * Returns null if not yet connected — use connectSocket() to ensure connection.
 */
export const getSocket = () => {
  if (socket && socket.connected) return socket;
  return null;
};

/**
 * Start a call only after the server has validated the paid booking, recipient,
 * busy state and secure call configuration. Prevents navigating into an empty
 * room when the backend rejected the call.
 */
export const initiateCall = async (payload, timeoutMs = 12000) => {
  const activeSocket = getSocket() || await Promise.race([
    connectSocket(),
    new Promise(resolve => setTimeout(() => resolve(null), 25000)),
  ]);
  if (!activeSocket?.connected) {
    throw new Error('Could not connect to the call server. Please try again.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Call server did not respond. Please try again.'));
    }, timeoutMs);

    activeSocket.emit('initiate_call', payload, (result = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result.success) resolve(result);
      else reject(new Error(result.message || 'The call could not be started.'));
    });
  });
};

/**
 * Disconnect and clear socket (call on logout)
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] Disconnected');
  }
  connectionPromise = null;
};

export default { connectSocket, getSocket, initiateCall, disconnectSocket };
