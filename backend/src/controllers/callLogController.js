// src/controllers/callLogController.js
// Handles: logging calls, fetching call history for advocate + admin

const CallLog = require('../models/CallLog');
const { Chat, Message } = require('../models/Chat');
const User = require('../models/User');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const STAFF_ROLES = new Set([
  'admin', 'super_admin', 'superadmin', 'support_executive', 'support',
  'accounts', 'forensic_expert', 'property_verification',
]);

const canAccessCall = (callLog, user) => {
  if (STAFF_ROLES.has(user.role)) return true;
  const userId = user._id.toString();
  return callLog.client?.toString() === userId || callLog.advocateUser?.toString() === userId;
};

// ─── POST /api/v1/calls/log ────────────────────────────────────────────────────
// Called from mobile app on hangup to save the call record
exports.logCall = async (req, res, next) => {
  try {
    const {
      bookingId, advocateUserId, clientUserId,
      mode, status = 'completed', endReason,
      startedAt, endedAt, duration, zegoRoomId,
      recordingConsent = false,
    } = req.body;

    if (!mode || !['video', 'voice'].includes(mode)) {
      return next(new AppError('mode must be video or voice.', 400));
    }

    // Determine client & advocate from request + body
    const callerId = req.user._id.toString();
    const isAdvocate = req.user.role === 'advocate';

    let clientId   = clientUserId   || (!isAdvocate ? callerId : null);
    let advocateId = advocateUserId || ( isAdvocate ? callerId : null);

    let verifiedBooking = null;
    if (bookingId) {
      const Booking = require('../models/Booking');
      const Advocate = require('../models/Advocate');
      verifiedBooking = await Booking.findById(bookingId);
      if (!verifiedBooking) return next(new AppError('Booking not found.', 404));
      const assignedAdvocate = verifiedBooking.advocate
        ? await Advocate.findById(verifiedBooking.advocate).select('user').lean()
        : null;
      clientId = verifiedBooking.client?.toString();
      advocateId = assignedAdvocate?.user?.toString();
      if (![clientId, advocateId].includes(callerId)) {
        return next(new AppError('Not authorized for this booking.', 403));
      }
    } else if (![clientId, advocateId].includes(callerId)) {
      return next(new AppError('Not authorized for these participants.', 403));
    }

    if (!clientId || !advocateId) {
      return next(new AppError('clientUserId and advocateUserId are required.', 400));
    }

    // Calculate duration from timestamps if not provided
    let callDuration = duration || 0;
    if (!callDuration && startedAt && endedAt) {
      callDuration = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000));
    }

    if (verifiedBooking && status === 'completed' && verifiedBooking.payment?.status !== 'paid') {
      return next(new AppError('Only paid bookings can be completed.', 409));
    }

    const resolvedEndReason = endReason || (status ? status.toUpperCase() : 'COMPLETED');

    const callLog = await CallLog.create({
      booking: bookingId || undefined,
      client: clientId,
      advocateUser: advocateId,
      mode,
      status,
      endReason: resolvedEndReason,
      duration: callDuration,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      endedAt:   endedAt   ? new Date(endedAt)   : undefined,
      initiatedBy: callerId,
      zegoRoomId: zegoRoomId || undefined,
      recordingConsent: Boolean(recordingConsent),
    });

    // Auto-complete the booking if the call was successful and credit the advocate
    if (bookingId && status === 'completed' && callDuration > 0) {
      try {
        const booking = verifiedBooking;
        if (booking && booking.status !== 'completed') {
          booking.status = 'completed';
          
          // ─── Credit Advocate Wallet automatically on post-consultation ─────────
          if (booking.advocate && !booking.walletCredited) {
            try {
              const { creditAdvocateWallet } = require('./walletController');
              const bookingAmount = booking.payment?.amount || booking.amount || 500;
              await creditAdvocateWallet({
                advocateId: booking.advocate,
                bookingAmount,
                bookingId: booking._id,
              });
              booking.walletCredited = true;
            } catch (wErr) {
              logger.error(`[Wallet] Failed to credit wallet in logCall for booking ${bookingId}: ${wErr.message}`);
            }
          }
          await booking.save();
          logger.info(`[CallLog] Auto-completed booking ${bookingId} and credited wallet after successful ${mode} call.`);
        }
      } catch (err) {
        logger.error(`[CallLog] Failed to auto-complete booking ${bookingId}: ${err.message}`);
      }
    }

    logger.info(`[CallLog] ${mode} call saved: ${clientId} ↔ ${advocateId} | ${callDuration}s | status: ${status} | reason: ${resolvedEndReason}`);
    res.status(201).json({ success: true, data: callLog });
  } catch (err) { next(err); }
};

// ─── GET /api/v1/calls/history ─────────────────────────────────────────────────
// Advocate or Client fetches their own call history
exports.getMyCallHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, mode, status } = req.query;
    const userId = req.user._id;
    const isAdvocate = req.user.role === 'advocate';

    const filter = isAdvocate
      ? { advocateUser: userId }
      : { client: userId };

    if (mode)   filter.mode   = mode;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [calls, total] = await Promise.all([
      CallLog.find(filter).lean()
        .populate('client',       'name avatar')
        .populate('advocateUser', 'name avatar')
        .populate('booking',      'type')
        .sort({ createdAt: -1 })
        .skip(skip).limit(Number(limit)).lean(),
      CallLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: calls,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/v1/admin/call-history ────────────────────────────────────────────
// Admin views all calls across the platform
exports.getAdminCallHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, mode, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (mode)   filter.mode   = mode;
    if (status) filter.status = status;

    let calls = await CallLog.find(filter).lean()
      .populate('client',       'name avatar email phone')
      .populate('advocateUser', 'name avatar email phone')
      .populate('booking',      'type status consultationMode')
      .sort({ createdAt: -1 })
      .skip(skip).limit(Number(limit)).lean();

    // Filter by name search after populate
    if (search) {
      const q = search.toLowerCase();
      calls = calls.filter(c =>
        c.client?.name?.toLowerCase().includes(q) ||
        c.advocateUser?.name?.toLowerCase().includes(q)
      );
    }

    const total = await CallLog.countDocuments(filter);

    // Summary stats
    const [totalToday, missedCount, avgDurationResult] = await Promise.all([
      CallLog.countDocuments({
        ...filter,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      CallLog.countDocuments({ ...filter, status: 'missed' }),
      CallLog.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: calls,
      stats: {
        totalToday,
        missedCount,
        avgDuration: Math.round(avgDurationResult[0]?.avg || 0),
      },
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/v1/admin/chat-history ────────────────────────────────────────────
// Admin views all chat sessions with message counts
exports.getAdminChatHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [chats, total] = await Promise.all([
      Chat.find({ isActive: true }).lean()
        .populate('participants', 'name avatar role email')
        .populate('lastMessage')
        .populate('booking', 'type status consultationMode createdAt')
        .sort({ updatedAt: -1 })
        .skip(skip).limit(Number(limit)).lean(),
      Chat.countDocuments({ isActive: true }),
    ]);

    // Attach message count to each chat
    const chatsWithCount = await Promise.all(chats.map(async (chat) => {
      const [msgCount, unreadCount] = await Promise.all([
        Message.countDocuments({ chat: chat._id }),
        Message.countDocuments({ chat: chat._id, readAt: null }),
      ]);
      return { ...chat, messageCount: msgCount, unreadCount };
    }));

    // Filter by name search
    const filtered = search
      ? chatsWithCount.filter(c =>
          c.participants?.some(p =>
            p.name?.toLowerCase().includes(search.toLowerCase())
          )
        )
      : chatsWithCount;

    res.json({ success: true, data: filtered, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};

// ─── GET /api/v1/admin/chat-history/:chatId/messages ───────────────────────────
// Admin views actual messages of a specific chat
exports.getAdminChatMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({ chat: req.params.chatId }).lean()
      .populate('sender', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip).limit(Number(limit)).lean();

    res.json({ success: true, data: messages.reverse() });
  } catch (err) { next(err); }
};

// ─── POST /api/v1/calls/:id/notes ──────────────────────────────────────────────
// Advocate adds consultation notes, next steps & requested documents
exports.addCallNotes = async (req, res, next) => {
  try {
    const { summary, nextSteps, documentsRequired } = req.body;
    const callLog = await CallLog.findById(req.params.id);

    if (!callLog) return next(new AppError('Call log not found.', 404));
    if (callLog.advocateUser.toString() !== req.user._id.toString() && !STAFF_ROLES.has(req.user.role)) {
      return next(new AppError('Not authorized to add notes for this call.', 403));
    }

    callLog.postConsultationNotes = {
      summary: summary || '',
      nextSteps: nextSteps || '',
      documentsRequired: Array.isArray(documentsRequired) ? documentsRequired : [],
      addedAt: new Date(),
    };

    await callLog.save();
    res.json({ success: true, data: callLog, message: 'Consultation notes saved successfully.' });
  } catch (err) { next(err); }
};

// ─── POST /api/v1/calls/:id/report ─────────────────────────────────────────────
// User or Advocate reports a technical issue or conduct complaint
exports.reportCallIssue = async (req, res, next) => {
  try {
    const { category, description } = req.body;
    const callLog = await CallLog.findById(req.params.id);

    if (!callLog) return next(new AppError('Call log not found.', 404));
    if (!canAccessCall(callLog, req.user)) {
      return next(new AppError('Not authorized for this call.', 403));
    }

    callLog.reportIssue = {
      reportedBy: req.user._id,
      category: category || 'Technical Issue',
      description: description || 'No description provided.',
      createdAt: new Date(),
    };

    await callLog.save();
    res.json({ success: true, data: callLog, message: 'Issue reported to support team.' });
  } catch (err) { next(err); }
};

// ─── POST /api/v1/calls/:id/events ─────────────────────────────────────────────
// Append technical state event (initiated -> ringing -> connected -> ended)
exports.logCallEvent = async (req, res, next) => {
  try {
    const { state, details } = req.body;
    const callLog = await CallLog.findById(req.params.id);

    if (!callLog) return next(new AppError('Call log not found.', 404));
    if (!canAccessCall(callLog, req.user)) {
      return next(new AppError('Not authorized for this call.', 403));
    }

    callLog.events.push({
      state,
      timestamp: new Date(),
      details: details || '',
    });

    await callLog.save();
    res.json({ success: true, message: 'Technical state event logged.' });
  } catch (err) { next(err); }
};
