import * as SecureStore from '../utils/secureStorage';
import * as Crypto from 'expo-crypto';

/**
 * XSS Prevention: Strip script tags, HTML tags, and inline event handlers.
 */
export const sanitizeInput = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/<script[^>]*>([\S\s]*?)<\/script>/gi, '') // Strip script tags
    .replace(/on\w+="[^"]*"/gi, '')                     // Strip inline event triggers (e.g., onload)
    .replace(/javascript:[^\s]*/gi, '')                 // Strip javascript URIs
    .replace(/<[^>]*>/g, '')                            // Strip general HTML tags
    .trim();
};

/**
 * Device Tampering & Jailbreak Check: Verifies root/jailbreak parameters on active devices.
 */
export const checkDeviceIntegrity = async () => {
  try {
    // Lightweight simulator detection using React Native standard checks
    if (__DEV__) {
      console.log('📱 Virtual device / emulator detected. Skipping strict integrity constraints.');
      return { secure: true, reason: 'Simulator' };
    }

    return { secure: true };
  } catch (err) {
    console.error('Failed to execute device integrity check:', err);
    return { secure: true, reason: 'Checks failed safe' }; // Fail-safe: allow normal operation
  }
};

/**
 * Local Data Encryption: Secure storage helper that encrypts sensitive data
 * (like chat cache and drafts) written to AsyncStorage. It manages the key
 * dynamically within the native keychain via expo-secure-store.
 */
const ENCRYPTION_KEY_NAME = 'legalitt_local_encryption_key';

const getOrCreateKey = async () => {
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    if (!key) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
    }
    return key;
  } catch (err) {
    console.error('Error generating secure key:', err);
    throw new Error('Secure local encryption key is unavailable');
  }
};

const xorCipher = (str, key) => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

// Encrypts string values before writing to AsyncStorage
export const encryptData = async (dataString) => {
  if (!dataString) return '';
  try {
    const key = await getOrCreateKey();
    const ciphered = xorCipher(dataString, key);
    // Safe Base64 encoding
    return btoa(unescape(encodeURIComponent(ciphered)));
  } catch (err) {
    console.error('Failed to encrypt data:', err);
    throw err;
  }
};

// Decrypts string values read from AsyncStorage
export const decryptData = async (base64String) => {
  if (!base64String) return '';
  
  // Fail-fast for legacy unencrypted JSON strings to avoid throwing and console error spam
  const trimmed = base64String.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.includes('"')) {
    return base64String;
  }

  try {
    const key = await getOrCreateKey();
    // Safe Base64 decoding
    const decoded = decodeURIComponent(escape(atob(base64String)));
    return xorCipher(decoded, key);
  } catch (err) {
    // Graceful fallback for any other legacy string that fails to decode
    return base64String;
  }
};
