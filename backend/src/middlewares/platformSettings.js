const Settings = require('../models/Settings');
const { AppError } = require('./errorHandler');

let cachedSettings = null;
let cacheExpiresAt = 0;

const DEFAULT_SETTINGS = Object.freeze({
  commissionRate: 15,
  minFee: 200,
  maxAdvanceBookingDays: 30,
  postConsultationBufferHours: 24,
  sessionDuration: { chat: 24, voice: 1, video: 1 },
  sessionExtensionEnabled: true,
  maxExtensionHours: 24,
  maintenanceMode: false,
  announcement: { text: '', type: '' },
  branding: { primaryColor: '#f59e0b', logoUrl: '/logo.png', faviconUrl: '/logo.png' },
  features: { aiEnabled: true, pushEnabled: true, registrationsEnabled: true, googleEnabled: true },
});

const getPlatformSettings = async () => {
  if (cachedSettings && Date.now() < cacheExpiresAt) return cachedSettings;
  // Feature checks must remain deterministic while Mongo is starting or temporarily unavailable.
  // Business operations still fail at their own database call; this avoids converting auth validation
  // into an unrelated settings lookup error.
  if (Settings.db.readyState !== 1) return DEFAULT_SETTINGS;
  cachedSettings = await Settings.findOne({ singletonId: 'global' }).lean() || await Settings.create({});
  cacheExpiresAt = Date.now() + 5000;
  return cachedSettings;
};

const invalidatePlatformSettings = () => { cachedSettings = null; cacheExpiresAt = 0; };

const requireFeature = feature => async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    if (settings.features?.[feature] === false) return next(new AppError(`${feature.replace(/Enabled$/, '')} is currently disabled by the administrator.`, 503));
    next();
  } catch (error) { next(error); }
};

module.exports = { getPlatformSettings, invalidatePlatformSettings, requireFeature };
