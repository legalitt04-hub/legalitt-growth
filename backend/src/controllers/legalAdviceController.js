// src/controllers/legalAdviceController.js
// Handles Legal Advice + Legal Notice booking requests
// Both go through Admin assignment flow (24-hour SLA)

const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { createNotification } = require('../utils/notificationHelper');
const { Chat, Message } = require('../models/Chat');

/**
 * POST /api/v1/legal-advice/request
 * Creates a Legal Advice OR Legal Notice booking (no advocate needed — admin assigns within 24h)
 * Supports: Chat / Voice / Video consultation modes
 * Supports: document URLs (uploaded via Cloudinary beforehand)
 */
exports.createLegalRequest = async (req, res, next) => {
  try {
    const {
      consultationMode,   // 'chat' | 'voice' | 'video'
      serviceType,        // 'legal_advice' | 'legal_notice' | 'property_research' | 'fir_draft' | 'document_forensic'
      issueCategory,      // 'property', 'family', 'criminal', etc.
      issueDescription,   // Client's problem description
      preferredSlot,      // e.g. "Tomorrow, 10:30 AM"
      documents,          // Array of { url, name, type } — uploaded via /api/upload
      clientCity,
      clientState,
      clientCoords,       // { lat, lng }
      amount,             // Payment amount
      // ─── Property Research specific fields ───
      propertyData,       // Full property form object
      propertyAddress,
      propertyType,
      surveyNumber,
      registrationNumber,
      district,
      state,
      purpose,
      // ─── Document Forensic specific fields ───
      documentName,
      documentType,
    } = req.body;

    // Merge propertyData fields if passed as an object
    const propAddress    = propertyAddress    || propertyData?.propertyAddress    || '';
    const propType       = propertyType       || propertyData?.propertyType       || '';
    const propSurvey     = surveyNumber       || propertyData?.surveyNumber       || '';
    const propRegNo      = registrationNumber || propertyData?.registrationNumber || '';
    const propDistrict   = district           || propertyData?.district           || clientCity || '';
    const propState      = state              || propertyData?.state              || clientState || '';
    const propPurpose    = purpose            || propertyData?.purpose            || '';

    // Validate required fields
    if (!consultationMode || !['chat', 'voice', 'video'].includes(consultationMode)) {
      return next(new AppError('Consultation mode must be chat, voice, or video.', 400));
    }
    if (!serviceType || !['legal_advice', 'legal_notice', 'property_research', 'fir_draft', 'consultation', 'document_forensic'].includes(serviceType)) {
      return next(new AppError('Invalid service type.', 400));
    }
    if (!issueDescription || issueDescription.trim().length < 10) {
      return next(new AppError('Please provide at least 10 characters describing your legal concern.', 400));
    }

    // Price is always resolved server-side. Client totals are display-only.
    const ServicePricing = require('../models/ServicePricing');
    const serviceKey = ['legal_notice', 'property_research', 'fir_draft', 'document_forensic'].includes(serviceType)
      ? serviceType
      : `${consultationMode}_consultation`;
    const fallbackPrices = {
      chat_consultation: 499,
      voice_consultation: 799,
      video_consultation: 1199,
      legal_notice: 1199,
      property_research: 2999,
      document_forensic: 2999,
      fir_draft: 499,
    };
    const sp = await ServicePricing.findOne({ serviceId: serviceKey, isActive: true }).lean();
    const bookingAmount = Number(sp?.basePrice ?? fallbackPrices[serviceKey]);
    if (!Number.isFinite(bookingAmount) || bookingAmount <= 0) {
      return next(new AppError('This service is not currently available for payment.', 503));
    }

    const formattedDocs = Array.isArray(documents)
      ? documents.map((doc, idx) => {
          if (typeof doc === 'string') {
            return { url: doc, name: `Document_${idx + 1}`, type: doc.endsWith('.pdf') ? 'pdf' : 'image' };
          }
          return {
            url: doc?.url || doc?.uri || (typeof doc === 'string' ? doc : ''),
            name: doc?.name || `Document_${idx + 1}`,
            type: doc?.type || 'document',
          };
        }).filter(d => d.url)
      : [];

    let schedule = {};
    if (req.body.scheduledDate || req.body.scheduledTime) {
      const day = String(req.body.scheduledDate || '');
      const match = String(req.body.scheduledTime || '').match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59) return next(new AppError('Choose a valid consultation date and time.', 400));
      const hour = (+match[1] % 12) + (match[3] === 'PM' ? 12 : 0);
      const startTime = `${String(hour).padStart(2, '0')}:${match[2]}`;
      const date = new Date(`${day}T${startTime}:00+05:30`);
      if (!Number.isFinite(date.getTime()) || date <= new Date()) return next(new AppError('Choose a future consultation slot.', 400));
      schedule = { date, timeSlot: { startTime, endTime: `${String((hour + 1) % 24).padStart(2, '0')}:${match[2]}` } };
    }

    const booking = await Booking.create({
      ...schedule,
      client: req.user._id,
      consultationMode,
      serviceType,
      type: consultationMode === 'video' ? 'video' : consultationMode === 'voice' ? 'phone' : 'chat',
      issue: `[${issueCategory || 'General'}] ${issueDescription.trim()}`,
      documents: formattedDocs,
      payment: {
        amount: bookingAmount,
        currency: 'INR',
        status: 'pending',
      },
      status: 'pending_payment',
      assignmentDeadline: null,
      clientCity: propDistrict || clientCity || req.user?.address?.city || '',
      clientState: propState || clientState || req.user?.address?.state || '',
      clientCoords: clientCoords || undefined,
      notes: preferredSlot ? `Preferred slot: ${preferredSlot}` : undefined,
      // ─── Property Research fields ────────────────────────────────────
      ...(serviceType === 'property_research' && {
        propertyAddress:    propAddress,
        propertyType:       propType,
        surveyNumber:       propSurvey,
        registrationNumber: propRegNo,
        district:           propDistrict,
        state:              propState,
        purpose:            propPurpose,
      }),
      // ─── Document Forensic fields ─────────────────────────────────────
      ...(serviceType === 'document_forensic' && {
        documentName: documentName || '',
        documentType: documentType || '',
      }),
    });

    logger.info(`Legal ${serviceType} request created: ${booking._id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id,
        amount: bookingAmount,
        currency: 'INR',
        status: booking.status,
        assignmentDeadline: booking.assignmentDeadline,
        message: 'Complete payment to submit your request.',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/legal-advice/confirm-payment
 * Confirm Razorpay payment for a legal advice/notice booking
 */
exports.confirmLegalPayment = async (req, res, next) => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return next(new AppError('Missing payment verification fields.', 400));
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized.', 403));
    }

    if (booking.payment?.status === 'paid') {
      return res.json({
        success: true,
        data: { bookingId: booking._id, status: booking.status, paymentStatus: 'paid' },
      });
    }
    if (booking.payment?.razorpayOrderId !== razorpayOrderId) {
      return next(new AppError('Order ID mismatch.', 400));
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return next(new AppError('Payment service is not configured.', 503));
    }
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSig !== razorpaySignature) {
      return next(new AppError('Payment verification failed. Please contact support.', 400));
    }

    // Update payment status
    booking.payment.status = 'paid';
    booking.payment.razorpayOrderId = razorpayOrderId;
    booking.payment.razorpayPaymentId = razorpayPaymentId;
    booking.payment.razorpaySignature = razorpaySignature;
    booking.payment.paidAt = new Date();
    booking.status = 'pending_assignment';
    booking.assignmentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await booking.save();

    logger.info(`Legal request payment confirmed: ${booking._id} — ₹${booking.payment.amount}`);

    // Send instant in-app notification to client for payment
    await createNotification({
      recipientId: req.user._id,
      senderId: req.user._id,
      title: 'Payment Confirmed! 💳',
      message: `Payment of ₹${booking.payment.amount} confirmed for case #LEG-${booking._id.toString().slice(-6).toUpperCase()}. Advocate assignment in progress.`,
      type: 'payment_success',
      relatedId: booking._id,
    });

    // Notify admin via socket that payment is confirmed
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('admin:payment_confirmed', {
        bookingId: booking._id,
        amount: booking.payment.amount,
        clientName: req.user.name,
      });
    }

    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        status: booking.status,
        paymentStatus: booking.payment.status,
        assignmentDeadline: booking.assignmentDeadline,
        message: 'Payment confirmed! We are assigning an advocate to your request.',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/legal-advice/my-requests
 * Get all legal advice/notice requests for the logged-in client
 */
exports.getMyRequests = async (req, res, next) => {
  try {
    const { status, serviceType } = req.query;
    const filter = { client: req.user._id };
    if (status) filter.status = status;
    if (serviceType) filter.serviceType = serviceType;

    const bookings = await Booking.find(filter).lean()
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar phone' } })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/legal-advice/request/:id
 * Get a single legal advice/notice request with full details including video room tokens
 */
exports.getRequestDetail = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar phone' } })
      .populate('client', 'name avatar phone email')
      .lean();

    if (!booking) return next(new AppError('Request not found.', 404));

    // Only the client or their assigned advocate can view full details
    const isClient = booking.client._id.toString() === req.user._id.toString();
    const isAdvocate = booking.advocate?.user?._id?.toString() === req.user._id.toString();

    if (!isClient && !isAdvocate && req.user.role !== 'admin') {
      return next(new AppError('Not authorized to view this request.', 403));
    }

    // Return advocate-specific token or client token based on who's requesting
    const response = { ...booking };
    if (isAdvocate) {
      response.myVideoToken = booking.advocateVideoToken;
      delete response.videoRoomToken;
    } else {
      response.myVideoToken = booking.videoRoomToken;
      delete response.advocateVideoToken;
    }
    if (req.user.role !== 'admin') {
      delete response.adminNotes;
      delete response.internalNotes;
      delete response.archivedBy;
      delete response.assignedBy;
      if (response.payment) {
        response.payment = {
          amount: response.payment.amount,
          currency: response.payment.currency,
          status: response.payment.status,
          paidAt: response.payment.paidAt,
        };
      }
    }

    res.json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
};

const getAssignedLegalService = async (bookingId, userId) => {
  const booking = await Booking.findOne({ _id: bookingId, serviceType: { $in: ['legal_notice', 'legal_advice'] } })
    .populate({ path: 'advocate', select: 'user', populate: { path: 'user', select: 'name' } })
    .populate('client', 'name');
  if (!booking) throw new AppError('Legal service booking not found.', 404);
  if (booking.advocate?.user?._id?.toString() !== userId.toString()) {
    throw new AppError('Only the assigned advocate can update this legal service.', 403);
  }
  if (booking.payment?.status !== 'paid') {
    throw new AppError('This legal service has not been paid.', 409);
  }
  return booking;
};

exports.generateAdvocateLegalNoticeDraft = async (req, res, next) => {
  try {
    const booking = await getAssignedLegalService(req.params.id, req.user._id);
    const { callAI } = require('../services/aiService');
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const isNotice = booking.serviceType === 'legal_notice';
    const prompt = `You are a senior Indian advocate drafting ${isNotice ? 'a formal response to a legal notice' : 'a clear written legal advice memorandum'}.
Client: ${booking.client?.name || 'Client'}
Matter: ${booking.issue || booking.issueDescription || 'Legal matter'}
Date: ${today}
Additional instructions: ${String(req.body.instructions || '').slice(0, 1000)}

${isNotice
  ? 'Draft a professional response in Indian legal format with a heading, addressee placeholders, subject, numbered paragraphs, reservation of rights, and professional closing.'
  : 'Draft a professional advice note with facts provided, issues, applicable legal principles, practical options, risks, recommended next steps, and a professional disclaimer.'}
Do not invent facts; mark missing facts with clear placeholders.`;
    const draft = await callAI([{ role: 'user', content: prompt }]);
    booking.aiDraft = draft;
    if (booking.status === 'confirmed' || booking.status === 'pending') booking.status = 'in_progress';
    await booking.save();
    res.json({ success: true, data: { draft: booking.aiDraft } });
  } catch (err) { next(err); }
};

exports.saveAdvocateLegalNoticeDraft = async (req, res, next) => {
  try {
    const draft = String(req.body.draft || '').trim();
    if (draft.length < 20 || draft.length > 20000) {
      return next(new AppError('Draft must be between 20 and 20,000 characters.', 400));
    }
    const booking = await getAssignedLegalService(req.params.id, req.user._id);
    booking.aiDraft = draft;
    if (booking.status === 'confirmed' || booking.status === 'pending') booking.status = 'in_progress';
    await booking.save();
    res.json({ success: true, data: { draft: booking.aiDraft }, message: 'Draft saved.' });
  } catch (err) { next(err); }
};

exports.submitAdvocateLegalNoticeDocument = async (req, res, next) => {
  try {
    const { name, url, type } = req.body;
    if (!name || !url || !/^https:\/\//i.test(url)) {
      return next(new AppError('A valid uploaded document is required.', 400));
    }
    let uploadedUrl;
    try { uploadedUrl = new URL(url); } catch (_) {
      return next(new AppError('The uploaded document URL is invalid.', 400));
    }
    const allowedUploadHosts = new Set([
      'res.cloudinary.com',
      ...(process.env.CLOUDINARY_DELIVERY_HOST ? [process.env.CLOUDINARY_DELIVERY_HOST] : []),
    ]);
    if (!allowedUploadHosts.has(uploadedUrl.hostname)) {
      return next(new AppError('Document must be uploaded through the secure Legalitt upload service.', 400));
    }
    const booking = await getAssignedLegalService(req.params.id, req.user._id);
    const document = {
      name: String(name).slice(0, 255),
      url: uploadedUrl.toString(),
      type: type || 'document',
      uploadedAt: new Date(),
      uploadedBy: req.user._id,
      reviewStatus: 'shared_with_client',
    };
    booking.advocateDocuments.push(document);
    booking.status = 'completed';

    let chat = booking.chat ? await Chat.findById(booking.chat) : null;
    if (!chat) {
      chat = await Chat.findOne({ booking: booking._id });
    }
    if (!chat) {
      chat = await Chat.create({
        participants: [booking.client._id || booking.client, req.user._id],
        booking: booking._id,
        isActive: true,
      });
      booking.chat = chat._id;
    }

    const message = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      content: booking.serviceType === 'legal_notice' ? 'Legal notice response document' : 'Legal advice document',
      messageType: 'file',
      fileUrl: document.url,
      fileName: document.name,
    });
    chat.lastMessage = message._id;
    chat.hiddenFor = [];
    await chat.save();
    await booking.save();

    const populatedMessage = await message.populate('sender', 'name avatar role');
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`chat:${chat._id}`).emit('new_message', populatedMessage);
      io.to(`user:${booking.client._id || booking.client}`).emit('conversation_updated', {
        chatId: chat._id,
        lastMessage: { content: `📎 ${document.name}`, sender: populatedMessage.sender?.name },
      });
      io.to(`user:${booking.client._id || booking.client}`).emit('booking_status_updated', {
        bookingId: booking._id,
        status: 'completed',
        message: booking.serviceType === 'legal_notice' ? 'Your legal notice response is ready.' : 'Your legal advice document is ready.',
      });
      io.to('admin_room').emit('admin:document_uploaded', { bookingId: booking._id, document });
    } catch (_) {}

    createNotification({
      recipientId: booking.client._id || booking.client,
      senderId: req.user._id,
      title: booking.serviceType === 'legal_notice' ? 'Legal Notice Response Ready' : 'Legal Advice Document Ready',
      message: `${document.name} is available in your consultation chat.`,
      type: 'document_shared',
      relatedId: booking._id,
    }).catch(() => {});

    res.json({ success: true, data: { document, message: populatedMessage, chatId: chat._id }, message: 'Document shared with the client and visible to admin.' });
  } catch (err) { next(err); }
};
