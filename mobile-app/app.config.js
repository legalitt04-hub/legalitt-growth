const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

export default ({ config }) => ({
  ...config,
  expo: {
    name: "Legalitt",
        slug: "legalitt",
    version: "1.0.3",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },

    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.legalitt.app",
      buildNumber: "1",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Legalitt uses your location to find advocates near you.",
        NSLocationAlwaysUsageDescription: "Legalitt uses your location to find advocates near you.",
        NSCameraUsageDescription: "Upload profile photo, documents, and participate in video calls.",
        NSMicrophoneUsageDescription: "Legalitt needs microphone access for voice and video consultations.",
        NSPhotoLibraryUsageDescription: "Upload profile photo or documents.",
        UIBackgroundModes: ["audio", "voip"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      },
      package: "com.legalitt.app",
      permissions: [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.INTERNET",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.READ_PHONE_STATE",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE",
        "android.permission.FOREGROUND_SERVICE_CAMERA",
        "android.permission.FOREGROUND_SERVICE_PHONE_CALL"
      ],
      ...(fs.existsSync(path.resolve(__dirname, 'google-services.json'))
        ? { googleServicesFile: './google-services.json' }
        : {}),
    },
    plugins: [
      "expo-font",
      "expo-location",
      "expo-image-picker",
      "expo-document-picker",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#0d9488"
        }
      ],
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: '53a94562-25bc-4f1c-af15-ec4c792696dc'
      },
      API_URL: process.env.API_URL || 'https://legalitt-growth.onrender.com/api/v1',
      SOCKET_URL: process.env.SOCKET_URL || 'https://legalitt-growth.onrender.com',
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
    }
  }
});
