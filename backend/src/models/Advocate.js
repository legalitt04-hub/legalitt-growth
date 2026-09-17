const mongoose = require('mongoose');

const advocateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  barCouncilNumber: {
    type: String,
    required: [true, 'Bar council number is required'],
    unique: true,
    trim: true,
  },
  specializations: [{
    type: String,
    enum: [
      'Criminal Law', 'Civil Law', 'Family Law', 'Property Law', 'Corporate Law',
      'Labour Law', 'Constitutional Law', 'Tax Law', 'Consumer Law', 'Cyber Law',
      'Intellectual Property', 'Banking Law', 'Environmental Law', 'Human Rights',
      'Immigration Law',
    ],
  }],
  experience: {
    type: Number,
    required: [true, 'Experience is required'],
    min: [0, 'Experience cannot be negative'],
  },
  consultationFee: {
    type: Number,
    required: [true, 'Consultation fee is required'],
    min: [0, 'Fee cannot be negative'],
  },
  followUpFee: {
    type: Number,
    default: 0,
  },
  followUpDays: {
    type: Number,
    default: 7,
    comment: 'Days after first consultation for follow-up pricing',
  },
  bio: {
    type: String,
    default: '',
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      street: String,
      city: { type: String, required: true },
      state: String,
      pincode: String,
    },
  },
  about: {
    type: String,
    maxlength: [1000, 'About cannot exceed 1000 characters'],
  },
  education: [{
    degree: String,
    institution: String,
    year: Number,
  }],
  languages: [String],
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    slots: [{
      startTime: String, // HH:MM
      endTime: String,
      isBooked: { type: Boolean, default: false },
    }],
  }],
  courtHearings: [{
    courtType: { type: String, trim: true },
    courtName: { type: String, required: true, trim: true },
    courtLocation: { type: String, trim: true },
    courtroom: { type: String, trim: true },
    caseTitle: { type: String, required: true, trim: true },
    caseNumber: { type: String, required: true, trim: true },
    hearingDate: { type: Date, required: true },
    hearingTime: { type: String, trim: true },
    advocateRole: { type: String, trim: true },
    status: { type: String, enum: ['Upcoming', 'Completed', 'Adjourned', 'Cancelled'], default: 'Upcoming' },
    notes: { type: String, maxlength: 2000 },
    reminders: [String],
  }],
  documents: {
    barCouncilCertificate: String,
    degreeDocument: String,
    idProof: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'],
    default: 'pending',
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
  },
  totalConsultations: {
    type: Number,
    default: 0,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  appPreferences: {
    bookingRequest: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true },
    clientMessages: { type: Boolean, default: true },
    paymentNotifications: { type: Boolean, default: true },
    videoConsultation: { type: Boolean, default: true },
    voiceConsultation: { type: Boolean, default: true },
  },
  // Earnings wallet — credited on each consultation payment
  wallet: {
    balance:            { type: Number, default: 0, min: 0 }, // Available for withdrawal
    totalEarned:        { type: Number, default: 0 },         // All-time earnings
    pendingWithdrawal:  { type: Number, default: 0 },         // Requested but not yet paid
    totalWithdrawn:     { type: Number, default: 0 },         // Paid out
    // Per-booking earning log (shown in Earnings History tab)
    earningTransactions: [{
      bookingId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      clientName:     { type: String, default: 'Client' },
      serviceType:    { type: String, default: 'legal_advice' },
      consultationMode:{ type: String, default: 'chat' },    // chat | voice | video
      grossAmount:    { type: Number },                      // Total client paid
      platformFee:    { type: Number },                      // Legalitt commission
      netAmount:      { type: Number },                      // Advocate received
      commissionRate: { type: Number },                      // % taken by platform
      creditedAt:     { type: Date, default: Date.now },
    }],
  },
  // Saved bank details for withdrawals
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode:      String,
    bankName:      String,
    upiId:         String,
  },
  verificationRejectionReason: { type: String }, // Admin's reason if rejected
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Geospatial index for nearby search
advocateSchema.index({ location: '2dsphere' });
advocateSchema.index({ 'location.address.city': 1 });
advocateSchema.index({ specializations: 1 });
advocateSchema.index({ isVerified: 1, verificationStatus: 1 });
advocateSchema.index({ 'rating.average': -1 });
advocateSchema.index({ consultationFee: 1 });

module.exports = mongoose.model('Advocate', advocateSchema);
