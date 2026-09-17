const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Global singleton ID
  singletonId: {
    type: String,
    default: 'global',
    unique: true,
  },
  
  // Financial
  commissionRate: {
    type: Number,
    default: 15, // 15%
  },
  minFee: {
    type: Number,
    default: 200,
  },
  
  // Booking Rules
  maxAdvanceBookingDays: {
    type: Number,
    default: 30,
  },

  branding: {
    primaryColor: { type: String, default: '#f59e0b' },
    logoUrl: { type: String, default: '/logo.png' },
    faviconUrl: { type: String, default: '/logo.png' },
  },
  
  // Feature Flags
  features: {
    aiEnabled:             { type: Boolean, default: true },
    pushEnabled:           { type: Boolean, default: true },
    registrationsEnabled:  { type: Boolean, default: true },
    googleEnabled:         { type: Boolean, default: true },
  },

  // ─── Consultation Session Duration Limits ───────────────────────────────────
  // Duration in HOURS — admin can customise per mode
  sessionDuration: {
    chat:  { type: Number, default: 24 },   // 24 hours
    voice: { type: Number, default: 1  },   // 1 hour
    video: { type: Number, default: 1  },   // 1 hour
  },
  // Allow clients/advocates to request extension?
  sessionExtensionEnabled: { type: Boolean, default: true },
  // Max extension per session in hours
  maxExtensionHours: { type: Number, default: 24 },
  
  // Post-Consultation Reconnect Window (How long room stays open after scheduled end)
  postConsultationBufferHours: { type: Number, default: 24 },

  // Maintenance Mode
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  
  // Announcement Banner
  announcement: {
    text: { type: String, default: '' },
    type: { type: String, enum: ['', 'info', 'warning', 'success'], default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
