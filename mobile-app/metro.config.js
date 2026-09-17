const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Polyfill paths ───────────────────────────────────────────────────────────
const NOOP       = path.resolve(__dirname, 'src/utils/polyfills/noopPolyfill.js');
const RAZORPAY   = path.resolve(__dirname, 'src/utils/polyfills/razorpayPolyfill.js');
const KEEP_AWAKE = path.resolve(__dirname, 'src/utils/keepAwakePolyfill.js');

// ─── Size Optimization: exclude web-only packages from Android bundle ─────────
// These packages are only needed for web. Blocking them from Android/iOS
// bundle removes ~12MB from the final build.
const WEB_ONLY_MODULES = [
  'react-dom',
  'react-native-web',
  'react-native-vector-icons', // we use @expo/vector-icons instead
];

// ─── Transformer: SVG support + minification ──────────────────────────────────
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.transformer.minifierConfig = {
  keep_fnames: false,
  mangle: { keep_fnames: false },
  output: { comments: false, ascii_only: true },
  sourceMap: false,
};

// ─── Resolver ─────────────────────────────────────────────────────────────────
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [
  ...config.resolver.sourceExts, // keep all Expo defaults (includes mjs, cjs, etc.)
  'svg',                          // add svg as source (handled by transformer)
];

// ─── Platform-aware module resolver ──────────────────────────────────────────
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block web-only modules on native platforms
  if (platform !== 'web' && WEB_ONLY_MODULES.some(m => moduleName === m || moduleName.startsWith(m + '/'))) {
    return { type: 'sourceFile', filePath: NOOP };
  }

  // ─── EAS Production Build: use real native packages ──────────────────────
  if (process.env.EAS_BUILD === 'true') {
    if (moduleName === '@sayem314/react-native-keep-awake') {
      return { type: 'sourceFile', filePath: KEEP_AWAKE };
    }
    // In EAS builds: use real Google Sign-In, real Razorpay, real Zego
    return context.resolveRequest(context, moduleName, platform);
  }

  // ─── Expo Go / Dev: stub native TurboModules not present in Expo Go ──────

  // KeepAwake
  if (moduleName === '@sayem314/react-native-keep-awake') {
    return { type: 'sourceFile', filePath: KEEP_AWAKE };
  }

  // react-native-razorpay
  if (moduleName === 'react-native-razorpay') {
    return { type: 'sourceFile', filePath: RAZORPAY };
  }

  // Zego — native-only SDK (mock in Expo Go only)
  if (
    moduleName.includes('zego-express-engine') ||
    moduleName.includes('zego-zim') ||
    moduleName.includes('@zegocloud') ||
    moduleName.startsWith('zego')
  ) {
    return { type: 'sourceFile', filePath: NOOP };
  }

  return context.resolveRequest(context, moduleName, platform);
};


module.exports = config;
