const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: false, // Optional — admin assigns within 24 hours for Legal Advice flow
  },
  date: {
    type: Date,
  },
  timeSlot: {
    startTime: { type: String },
    endTime: { type: String },
  },
  // Consultation mode — how client wants to interact
  consultationMode: {
    type: String,
    enum: ['chat', 'voice', 'video', 'in_person'],
    default: 'chat',
  },
  // Service type — what the booking is for
  serviceType: {
    type: String,
    enum: ['legal_advice', 'legal_notice', 'property_research', 'fir_draft', 'consultation', 'document_forensic'],
    default: 'legal_advice',
  },
  type: {
    type: String,
    enum: ['in_person', 'video', 'phone', 'chat'],
    default: 'chat',
  },
  status: {
    type: String,
    enum: [
      'pending_assignment', // Waiting for admin to assign advocate (24h window)
      'pending',            // Assigned but not yet confirmed
      'confirmed',          // Advocate confirmed, ready to proceed
      'in_progress',        // Session started
      'completed',
      'cancelled',
      'rescheduled',
      'no_show',
    ],
    default: 'pending_assignment',
  },
  issue: {
    type: String,
    required: [true, 'Brief description of legal issue is required'],
    maxlength: [1000, 'Issue description cannot exceed 1000 characters'],
  },
  // Documents uploaded by client (Cloudinary URLs or Objects)
  documents: [mongoose.Schema.Types.Mixed],
  // Documents uploaded by advocate (or by admin on advocate's behalf)
  advocateDocuments: [mongoose.Schema.Types.Mixed],
  payment: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'not_required'],
      default: 'pending',
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
  },
  // 24-hour SLA for admin assignment
  assignmentDeadline: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  assignedAt: Date,
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin who assigned
  },
  // Client's city (stored for admin nearby advocate filtering)
  clientCity: String,
  clientState: String,
  clientCoords: {
    lat: Number,
    lng: Number,
  },
  // ─── Property Research Fields ────────────────────────────────────────────
  propertyAddress: String,
  propertyType: String,
  surveyNumber: String,
  registrationNumber: String,
  district: String,
  state: String,
  purpose: String,
  // ─── Document Forensic Fields ─────────────────────────────────────────────
  documentName: String,
  documentType: String,
  // Video/Voice call room (ZEGOCLOUD)
  videoRoomId: String,
  videoRoomUrl: String,
  videoRoomToken: String,      // Client token
  advocateVideoToken: String,  // Advocate token
  zegoAppId: Number,           // ZEGOCLOUD App ID (stored so client/advocate don't need .env)
  videoRoomExpiresAt: Date,
  // Chat
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
  },
  isFollowUp: {
    type: Boolean,
    default: false,
  },
  parentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  notes: String,
  internalNotes: [{
    note: { type: String, required: true },
    addedBy: { type: String, default: 'Admin' },
    addedAt: { type: Date, default: Date.now }
  }],
  advocatePayout: {
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: Date,
    commissionPercent: { type: Number, default: 20 },
  },
  createdByAdmin: { type: Boolean, default: false },
  cancellationReason: String,
  cancelledBy: { type: String, enum: ['client', 'advocate', 'admin'] },
  // WhatsApp notification tracking
  whatsappSentToNearby: { type: Boolean, default: false },
  whatsappSentToAdvocate: { type: Boolean, default: false },
}, {
  timestamps: true,
});

bookingSchema.index({ client: 1, status: 1 });
bookingSchema.index({ advocate: 1, date: 1, status: 1 });
bookingSchema.index({ status: 1, assignmentDeadline: 1 }); // For admin SLA monitoring
bookingSchema.index({ clientCity: 1, status: 1 });         // For nearby advocate filtering
bookingSchema.index({ 'payment.razorpayOrderId': 1 }, { sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);

