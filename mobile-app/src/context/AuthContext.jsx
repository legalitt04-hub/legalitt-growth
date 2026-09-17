import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { authAPI, TOKEN_KEY, REFRESH_KEY } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);
const CACHED_USER_KEY = 'legalitt_cached_user';

const cacheUser = async (user) => {
  if (user) await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
};

const initialState = {
  user: null,
  isLoading: false,
  isRestoring: true,
  isAuthenticated: false,
  error: null,
  consentAccepted: false,
  biometricsEnabled: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOADING': return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: true, 
        isLoading: false, 
        isRestoring: false, 
        error: null 
      };
    case 'LOGOUT':
      return { 
        ...initialState, 
        isRestoring: false, 
        consentAccepted: state.consentAccepted,
        biometricsEnabled: state.biometricsEnabled 
      };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'ERROR':
      return { ...state, isLoading: false, isRestoring: false, error: action.payload };
    case 'LOADED':
      return { ...state, isLoading: false, isRestoring: false };
    case 'SET_CONSENT':
      return { ...state, consentAccepted: action.payload };
    case 'SET_BIOMETRICS':
      return { ...state, biometricsEnabled: action.payload };
    default: return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initialize Google Sign-In on mount — configure with webClientId + androidClientId
  useEffect(() => {
    const webClientId = Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID
      || '145094326598-95qo14kskqa4ddr6k57rrs9ebp1so35t.apps.googleusercontent.com';
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
  }, []);

  // On app start — restore session
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Restore consent status first
        const consentVal = await AsyncStorage.getItem('legalitt_consent_accepted');
        dispatch({ type: 'SET_CONSENT', payload: consentVal === 'true' });

        // Restore biometrics status
        const bioVal = await AsyncStorage.getItem('legalitt_biometrics_enabled');
        dispatch({ type: 'SET_BIOMETRICS', payload: bioVal === 'true' });

        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) return dispatch({ type: 'LOADED' });

        const { data } = await authAPI.getMe();
        await cacheUser(data.data);
        dispatch({ type: 'LOGIN_SUCCESS', payload: data.data });
        // Connect socket immediately using the saved token
        connectSocket(token);
      } catch (err) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_KEY);
          await AsyncStorage.removeItem(CACHED_USER_KEY);
          dispatch({ type: 'LOADED' });
        } else {
          const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
          if (cached) {
            dispatch({ type: 'LOGIN_SUCCESS', payload: JSON.parse(cached) });
            connectSocket(token);
          } else {
            dispatch({ type: 'LOADED' });
          }
        }
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'LOADING' });
    try {
      const { data } = await authAPI.login({ email, password });
      await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
      await cacheUser(data.data.user);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.data.user });
      // Connect socket immediately with the fresh token — no delay needed
      connectSocket(data.data.accessToken);
      return { success: true, user: data.data.user };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'ERROR', payload: msg });
      return { success: false, message: msg };
    }
  }, []);

  const register = useCallback(async (userData) => {
    dispatch({ type: 'LOADING' });
    try {
      const { data } = await authAPI.register(userData);
      await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
      await cacheUser(data.data.user);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.data.user });
      return { success: true, user: data.data.user };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'ERROR', payload: msg });
      return { success: false, message: msg };
    }
  }, []);

  // Google Sign-In: sends idToken to backend for verification
  const googleLogin = useCallback(async (idToken, role, accessToken) => {
    dispatch({ type: 'LOADING' });
    try {
      const { data } = await authAPI.googleAuth(idToken, role, accessToken);
      const authenticatedUser = {
        ...data.data.user,
        requiresAdvocateOnboarding: !!data.data.requiresAdvocateOnboarding,
      };
      await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
      await cacheUser(authenticatedUser);
      connectSocket(data.data.accessToken);
      dispatch({ type: 'LOGIN_SUCCESS', payload: authenticatedUser });
      return { success: true, user: authenticatedUser, requiresAdvocateOnboarding: authenticatedUser.requiresAdvocateOnboarding };
    } catch (err) {
      const msg = err.response?.data?.message || 'Google login failed';
      dispatch({ type: 'ERROR', payload: msg });
      return { success: false, message: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    // Always dispatch LOGOUT regardless of any errors — never throw
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      await authAPI.logout(refreshToken);
    } catch { /* ignore — backend logout is best-effort */ }

    try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* ignore */ }
    try { await SecureStore.deleteItemAsync(REFRESH_KEY); } catch { /* ignore */ }
    try { await AsyncStorage.removeItem(CACHED_USER_KEY); } catch { /* ignore */ }
    try { disconnectSocket(); } catch { /* ignore */ }

    // This MUST always run — makes isAuthenticated false → AppNavigator → Onboarding
    dispatch({ type: 'LOGOUT' });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authAPI.getMe(); // Now calls unified endpoint
      dispatch({ type: 'UPDATE_USER', payload: data.data });
      await cacheUser(data.data);
      return data.data;
    } catch (err) {
      console.log('Refresh user error:', err);
    }
  }, []);

  const updateUser = useCallback((data) => {
    dispatch({ type: 'UPDATE_USER', payload: data });
    cacheUser({ ...state.user, ...data }).catch(() => {});
  }, [state.user]);

  const acceptConsent = useCallback(async () => {
    try {
      await AsyncStorage.setItem('legalitt_consent_accepted', 'true');
      dispatch({ type: 'SET_CONSENT', payload: true });
    } catch (err) {
      console.error('Error accepting consent:', err);
    }
  }, []);

  const clearConsent = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('legalitt_consent_accepted');
      dispatch({ type: 'SET_CONSENT', payload: false });
    } catch (err) {
      console.error('Error clearing consent:', err);
    }
  }, []);

  // ─── Session activity monitor & biometrics flow (Session timeout disabled) ─────────────────────────────
  const lastActiveTime = useRef(Date.now());

  const updateActivity = useCallback(() => {
    lastActiveTime.current = Date.now();
  }, []);

  const enableBiometrics = useCallback(async (email, password) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrics Unavailable',
          'Biometrics is not configured or available on this device.'
        );
        return { success: false };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric authentication',
      });

      if (result.success) {
        await SecureStore.setItemAsync('bio_email', email);
        await SecureStore.setItemAsync('bio_password', password);
        await AsyncStorage.setItem('legalitt_biometrics_enabled', 'true');
        dispatch({ type: 'SET_BIOMETRICS', payload: true });
        Alert.alert('Success', 'Biometric authentication has been enabled.');
        return { success: true };
      }
      return { success: false, message: 'Authentication failed.' };
    } catch (err) {
      console.error('Error enabling biometrics:', err);
      return { success: false, message: 'An error occurred. Please try again.' };
    }
  }, []);

  const disableBiometrics = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('bio_email');
      await SecureStore.deleteItemAsync('bio_password');
      await AsyncStorage.setItem('legalitt_biometrics_enabled', 'false');
      dispatch({ type: 'SET_BIOMETRICS', payload: false });
      Alert.alert('Disabled', 'Biometric authentication has been disabled.');
      return { success: true };
    } catch (err) {
      console.error('Error disabling biometrics:', err);
      return { success: false };
    }
  }, []);

  const biometricLogin = useCallback(async () => {
    try {
      const isBioActive = await AsyncStorage.getItem('legalitt_biometrics_enabled');
      if (isBioActive !== 'true') {
        return { success: false, message: 'Biometrics is not enabled in settings.' };
      }

      const bioEmail = await SecureStore.getItemAsync('bio_email');
      const bioPassword = await SecureStore.getItemAsync('bio_password');

      if (!bioEmail || !bioPassword) {
        return { success: false, message: 'Credentials missing. Please log in with password once.' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Legalitt using biometrics',
      });

      if (result.success) {
        const loginResult = await login(bioEmail, bioPassword);
        if (loginResult.success) {
          updateActivity();
        }
        return loginResult;
      }
      return { success: false, message: 'Biometrics verification failed.' };
    } catch (err) {
      console.error('Biometric login error:', err);
      return { success: false, message: 'An error occurred during biometric login.' };
    }
  }, [login, updateActivity]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      googleLogin,
      logout,
      updateUser,
      refreshUser,
      acceptConsent,
      clearConsent,
      updateActivity,
      enableBiometrics,
      disableBiometrics,
      biometricLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
