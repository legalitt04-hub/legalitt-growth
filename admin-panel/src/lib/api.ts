import axios from 'axios';

// Create a customized axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://legalitt-growth.onrender.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAuthAttempt = ['/auth/login', '/auth/google', '/auth/send-otp', '/auth/verify-otp', '/auth/forgot-password', '/auth/reset-password']
      .some(path => requestUrl.includes(path));
    const hasAdminSession = Boolean(localStorage.getItem('adminToken'));
    if (error.response?.status === 401 && hasAdminSession && !isAuthAttempt) {
      // A protected request explicitly rejected the current token.
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
