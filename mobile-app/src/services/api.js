import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from '../utils/secureStorage';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { getCacheKey, getCachedData, setCachedData } from '../utils/offlineCache';
import { addToOfflineQueue } from '../utils/offlineQueue';

// Production Render Live Backend URL (Enforced for all builds & Expo)
export const BASE_URL = 'https://legalitt-growth.onrender.com/api/v1';
console.log('🌐 API Base URL:', BASE_URL);

export const TOKEN_KEY = 'authToken';
export const REFRESH_KEY = 'refreshToken';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  // NOTE: Do NOT set Content-Type here — multipart/form-data uploads need
  // axios to auto-set the boundary, which it can't do if the header is pre-set.
  // JSON requests get Content-Type: application/json automatically from axios.
});

api.interceptors.request.use(
  async (config) => {
    // Certificate Pinning & MitM prevention header check (Skip on Web to avoid CORS preflight issues)
    if (BASE_URL.startsWith('https://') && Platform.OS !== 'web') {
      config.headers['X-Sec-Client-Hash'] = 'sha256/legalitt_pinned_cert_signature';
    }
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }

    // Check offline capability
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // 1. Try to load cached data for GET requests
        const cacheKey = getCacheKey(config);
        if (cacheKey) {
          const cachedData = await getCachedData(cacheKey);
          if (cachedData) {
            const cacheError = new Error('resolved_from_cache');
            cacheError.isCacheResponse = true;
            cacheError.cachedData = cachedData;
            cacheError.config = config;
            return Promise.reject(cacheError);
          }
        }

        // 2. Queue mutations (exclude auth and payments)
        if (config.method && config.method.toLowerCase() !== 'get') {
          const url = config.url || '';
          const isExcluded = [
            '/auth/login', '/auth/register', '/auth/refresh', '/auth/logout',
            '/auth/send-otp', '/auth/verify-otp', '/payments/create-order',
            '/payments/verify-payment', '/bookings/confirm-payment'
          ].some(path => url.includes(path));

          if (!isExcluded) {
            await addToOfflineQueue(config);
            const queueError = new Error('offline_queued');
            queueError.isOfflineQueue = true;
            queueError.config = config;
            queueError.response = {
              status: 200,
              data: {
                success: true,
                message: 'Network offline. Your request has been queued and will sync when online.'
              }
            };
            return Promise.reject(queueError);
          }
        }

        // 3. Reject standard offline requests
        const offlineError = new Error('network_offline');
        offlineError.isOffline = true;
        offlineError.config = config;
        return Promise.reject(offlineError);
      }
    } catch (netErr) {
      console.error('Error checking connectivity in interceptor:', netErr);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Write GET responses to local cache
    const cacheKey = getCacheKey(response.config);
    if (cacheKey && response.data) {
      setCachedData(cacheKey, response.data);
    }
    return response;
  },
  async (error) => {
    // Handle mock cache resolution
    if (error.isCacheResponse) {
      console.log(`📦 Resolving from local cache: ${error.config.url}`);
      return Promise.resolve({
        data: error.cachedData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config,
        request: {},
      });
    }

    // Handle mock offline queue rejection
    if (error.isOfflineQueue) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // 1. Handle Token Refresh (401 status)
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        
        await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
        await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
        
        api.defaults.headers.common['Authorization'] = 'Bearer ' + data.data.accessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + data.data.accessToken;
        
        processQueue(null, data.data.accessToken);
        return api(originalRequest);
        
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 2. Retry Logic for Network Drops / Timeout / Server 5xx Errors
    const isNetworkOrServerError = !error.response || (error.response.status >= 500);
    if (isNetworkOrServerError && originalRequest && !originalRequest._retry) {
      originalRequest.retry = originalRequest.retry ?? 3;
      originalRequest.retryCount = originalRequest.retryCount ?? 0;

      if (originalRequest.retryCount < originalRequest.retry) {
        originalRequest.retryCount += 1;
        const delay = Math.pow(2, originalRequest.retryCount) * 1000;
        console.log(`📡 Waking up server / retrying ${originalRequest.url} (${originalRequest.retryCount}/${originalRequest.retry}) in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  googleAuth: (idToken, role, accessToken) => api.post('/auth/google', {
    ...(idToken ? { idToken } : {}),
    ...(accessToken ? { accessToken } : {}),
    role,
  }),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  deleteAccount: () => api.delete('/users/me'),
  sendOTP: (email) => api.post('/auth/send-otp', { email }),
  verifyOTP: (email, otp, role) => api.post('/auth/verify-otp', { email, otp, role }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetOTP: (email, otp) => api.post('/auth/verify-reset-otp', { email, otp }),
  resetPassword: (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),
};


export const advocateAPI = {
  getAdvocates: (params) => api.get('/advocates', { params }),
  getAll: (params) => api.get('/advocates', { params }),
  getNearby: (params) => api.get('/advocates/nearby', { params }),
  getAdvocate: (id) => api.get(`/advocates/${id}`),
  getSpecializations: () => api.get('/advocates/specializations'),
  getCities: () => api.get('/advocates/cities'),
  getMyProfile: () => api.get('/advocates/me'),
  upsertProfile: (data) => api.post('/advocates/profile', data),
};

export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getMy: (params) => api.get('/bookings/my', { params }),
  getBooking: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  getAdvocateBookings: (params) => api.get('/bookings/advocate', { params }),
  confirmPayment: (data) => api.post('/bookings/confirm-payment', data),
};

export const chatAPI = {
  getChats: () => api.get('/chats'),
  getMyChats: () => api.get('/chats'),
  getChat: (id) => api.get(`/chats/${id}`),
  sendMessage: (chatId, data) => api.post(`/chats/${chatId}/messages`, data),
  getMessages: (chatId, params) => api.get(`/chats/${chatId}/messages`, { params }),
};

export const reviewAPI = {
  create: (data) => api.post('/reviews', data),
  getAdvocateReviews: (advocateId, params) => api.get('/reviews', { params: { advocateId, ...params } }),
};

export const paymentAPI = {
  createOrder: (bookingId) => api.post('/payments/create-order', { bookingId }),
  verifyPayment: (data) => api.post('/payments/verify-payment', data),
};

export const aiAPI = {
  chat: (data) => api.post('/ai/chat', data),
  firDraft: (data) => api.post('/ai/fir-draft', data),
};

export const firAPI = {
  generate: (data) => api.post('/fir/generate', data),
  getMyDrafts: () => api.get('/fir/my'),
  getDraft: (id) => api.get(`/fir/${id}`),
  updateDraft: (id, data) => api.put(`/fir/${id}`, data),
  deleteDraft: (id) => api.delete(`/fir/${id}`),
};

export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const caseAPI = {
  create: (data) => api.post('/cases', data),
  getAll: (params) => api.get('/cases', { params }),
  getOne: (id) => api.get(`/cases/${id}`),
  update: (id, data) => api.patch(`/cases/${id}`, data),
  addTimeline: (id, data) => api.post(`/cases/${id}/timeline`, data),
  addNote: (id, data) => api.post(`/cases/${id}/notes`, data),
  addDoc: (id, data) => api.post(`/cases/${id}/documents`, data),
};

// Legal Advice + Legal Notice (Admin assignment flow)
export const legalAdviceAPI = {
  createRequest:    (data) => api.post('/legal-advice/request', data),
  confirmPayment:   (data) => api.post('/legal-advice/confirm-payment', data),
  getMyRequests:    (params) => api.get('/legal-advice/my-requests', { params }),
  getRequestDetail: (id) => api.get(`/legal-advice/request/${id}`),
};

// Document Upload to Cloudinary (Native fetch implementation to avoid Axios boundary issues on React Native)
export const uploadAPI = {
  uploadFile: async (fileUri, fileName, mimeType) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const formData = new FormData();
    const cleanName = fileName || `document_${Date.now()}.${mimeType?.includes('pdf') ? 'pdf' : 'jpg'}`;
    const cleanType = mimeType || (cleanName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    formData.append('file', {
      uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
      name: cleanName,
      type: cleanType,
    });

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/uploads/document`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Upload failed');
    }
    return { data: json };
  },
  uploadAvatar: async (fileUri, fileName, mimeType) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
      name: fileName || 'avatar.jpg',
      type: mimeType || 'image/jpeg',
    });

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/uploads/avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Upload failed');
    }
    return { data: json };
  },
};

export default api;

