const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const Case = require('../models/Case');
const { Chat } = require('../models/Chat');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { createNotification } = require('../utils/notificationHelper');
const { setupZegoCall, generateZegoToken } = require('../services/zegoService');

const STAFF_ROLES = new Set([
  'admin', 'super_admin', 'superadmin', 'support_executive', 'support',
  'accounts', 'forensic_expert', 'property_verification',
]);

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  try {
    const { advocateId, date, timeSlot, type, issue, isFollowUp, parentBookingId } = req.body;

    const mongoose = require('mongoose');
    if (!advocateId || !mongoose.Types.ObjectId.isValid(advocateId)) {
      return next(new AppError('A valid Advocate ID is required.', 400));
    }
    if (!date || isNaN(Date.parse(date))) {
      return next(new AppError('A valid booking date is required.', 400));
    }
    if (!timeSlot || !timeSlot.startTime) {
      return next(new AppError('A valid preferred time slot is required.', 400));
    }
    const platformSettings = await require('../middlewares/platformSettings').getPlatformSettings();
    const bookingDate = new Date(date);
    const latestAllowedDate = new Date(Date.now() + Number(platformSettings.maxAdvanceBookingDays || 30) * 86400000);
    if (bookingDate > latestAllowedDate) return next(new AppError(`Bookings can only be made up to ${platformSettings.maxAdvanceBookingDays || 30} days in advance.`, 400));

    const advocate = await Advocate.findById(advocateId).populate('user', 'name fcmToken');
    if (!advocate) return next(new AppError('Advocate not found.', 404));
    if (advocate.verificationStatus !== 'approved') return next(new AppError('Advocate is not verified.', 400));

    // Determine fee
    let amount = Math.max(Number(advocate.consultationFee || 0), Number(platformSettings.minFee || 0));
    if (isFollowUp && parentBookingId) {
      const parent = await Booking.findById(parentBookingId);
      if (parent && parent.client.toString() === req.user._id.toString()) {
        const daysDiff = Math.floor((Date.now() - parent.createdAt) / 86400000);
        if (daysDiff <= advocate.followUpDays) amount = advocate.followUpFee;
      }
    }

    // Check conflict
    const conflict = await Booking.findOne({
      advocate: advocateId,
      date: new Date(date),
      'timeSlot.startTime': timeSlot.startTime,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (conflict) return next(new AppError('This time slot is already booked.', 409));

    const booking = await Booking.create({
      client: req.user._id,
      advocate: advocateId,
      date: new Date(date),
      timeSlot,
      type: type || 'in_person',
      issue,
      isFollowUp: !!isFollowUp,
      parentBooking: parentBookingId || undefined,
      payment: { amount, currency: 'INR', status: 'pending' },
    });

    logger.info(`Booking created: ${booking._id} by ${req.user._id}`);
    
    // Notify Advocate in real-time
    const adv = await Advocate.findById(advocateId);
    if (adv) {
      await createNotification({
        recipientId: adv.user,
        senderId: req.user._id,
        title: 'New Consultation Request ⚖️',
        message: `${req.user.name} has requested a consultation with you.`,
        type: 'booking_created',
        relatedId: booking._id,
      });
    }

    res.status(201).json({ success: true, data: booking });
  } catch (err) { next(err); }
};

// Confirm payment and unlock chat
exports.confirmPayment = async (req, res, next) => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));

    // Verify signature (bypassed in development mode for offline testing)
    if (process.env.NODE_ENV !== 'development') {
      const crypto = require('crypto');
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSig !== razorpaySignature)
        return next(new AppError('Payment verification failed.', 400));
    }

    // Find or create chat room (prevent duplicates between same client-advocate pair)
    const advocateUser = (await Advocate.findById(booking.advocate))?.user;
    let chat = await Chat.findOne({
      participants: { $all: [booking.client, advocateUser], $size: 2 },
      isActive: true,
    });
    if (!chat) {
      chat = await Chat.create({
        participants: [booking.client, advocateUser],
        booking: booking._id,
      });
    }

    // Create Case portfolio entry
    await Case.create({
      title: booking.issue || 'Consultation Case',
      description: `Consultation booked on ${new Date(booking.date).toLocaleDateString()}`,
      caseNumber: `LGT-${booking._id.toString().substring(18).toUpperCase()}`,
      courtName: booking.type === 'in_person' ? 'In-Person' : 'Online',
      client: booking.client,
      advocate: booking.advocate,
      status: 'active'
    });

    booking.status = 'confirmed';
    booking.payment.status = 'paid';
    booking.payment.razorpayOrderId = razorpayOrderId;
    booking.payment.razorpayPaymentId = razorpayPaymentId;
    booking.payment.paidAt = new Date();
    booking.chat = chat._id;

    // (Wallet credit logic has been moved to callLogController to ensure payment is released only AFTER successful consultation)

    // ─── Generate ZEGOCLOUD tokens for video/voice calls ────────────────────
    try {
      const advocate = await Advocate.findById(booking.advocate);
      if (advocate) {
        const zegoResult = setupZegoCall({
          bookingId: booking._id.toString(),
          clientId:   req.user._id.toString(),
          advocateId: advocate.user.toString(),
        });
        if (zegoResult.success) {
          booking.videoRoomId     = zegoResult.roomId;
          booking.videoRoomToken  = zegoResult.clientToken;   // Client token
          booking.advocateVideoToken = zegoResult.advocateToken; // Advocate token
          booking.zegoAppId       = zegoResult.appId;
          logger.info(`[Zego] Room ${zegoResult.roomId} created for booking ${booking._id}`);
        }
      }
    } catch (zegoErr) {
      // Non-fatal — chat still works, just no call
      logger.warn(`[Zego] Token generation failed for booking ${booking._id}: ${zegoErr.message}`);
    }

    await booking.save();

    // Notify Advocate in real-time
    const adv = await Advocate.findById(booking.advocate).populate('user', 'name');
    if (adv) {
      await createNotification({
        recipientId: adv.user._id || adv.user,
        senderId: req.user._id,
        title: 'New Consultation Booking 💳',
        message: `${req.user.name} has paid and confirmed a consultation with you.`,
        type: 'booking_accepted',
        relatedId: booking._id,
      });
    }

    // Notify Client in real-time
    await createNotification({
      recipientId: req.user._id,
      senderId: adv ? (adv.user._id || adv.user) : null,
      title: 'Booking Confirmed ✅',
      message: `Your consultation with ${adv?.user?.name || 'the advocate'} has been successfully booked.`,
      type: 'booking_accepted',
      relatedId: booking._id,
    });

    res.json({
      success: true,
      data: {
        booking,
        chatId: chat._id,
        zegoRoomId:  booking.videoRoomId   || null,
        zegoToken:   booking.videoRoomToken || null,
        zegoAppId:   booking.zegoAppId     || 0,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/bookings/my
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, advocateId, advocate, page = 1, limit = 10 } = req.query;
    const filter = { client: req.user._id };
    if (status) filter.status = status;
    const advId = advocateId || advocate;
    if (advId) filter.advocate = advId;

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).lean()
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } })
        .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, data: bookings, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};

// GET /api/bookings/advocate
exports.getAdvocateBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const advocate = await Advocate.findOne({ user: req.user._id });
    if (!advocate) return next(new AppError('Advocate profile not found.', 404));

    const filter = { advocate: advocate._id };
    if (status) filter.status = status;

    if (req.query.today === 'true') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      filter.$or = [
        { date: { $gte: startOfToday, $lte: endOfToday } },
        { createdAt: { $gte: startOfToday, $lte: endOfToday } },
        { date: { $exists: false } },
        { date: null },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).lean()
        .populate('client', 'name avatar phone email isEmailVerified isPhoneVerified isVerified city')
        .select('+videoRoomId +advocateVideoToken +zegoAppId +chat +payment +status +consultationMode +type')
        .sort({ date: -1 }).skip(skip).limit(Number(limit)).lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, data: bookings, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return next(new AppError('Booking not found.', 404));

    const advocate = await Advocate.findById(booking.advocate);
    const isClient = booking.client.toString() === req.user._id.toString();
    const isAdvocate = advocate?.user?.toString() === req.user._id.toString();

    const isStaff = STAFF_ROLES.has(req.user.role);
    if (!isClient && !isAdvocate && !isStaff)
      return next(new AppError('Not authorized.', 403));

    const allowedByActor = isStaff
      ? ['pending_assignment', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']
      : isAdvocate
        ? ['confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']
        : ['cancelled'];
    if (!allowedByActor.includes(status)) {
      return next(new AppError('This status change is not permitted.', 403));
    }
    if (['confirmed', 'in_progress', 'completed'].includes(status) && !['paid', 'not_required'].includes(booking.payment?.status)) {
      return next(new AppError('Payment must be confirmed before this status change.', 409));
    }

    booking.status = status;
    if (cancellationReason) {
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = isClient ? 'client' : isAdvocate ? 'advocate' : 'admin';
    }
    await booking.save();

    // Real-time Socket.io notifications
    const io = req.app.get('io');
    if (status === 'confirmed') {
      if (io) {
        io.to(`user:${booking.client}`).emit('booking_status_updated', {
          bookingId: booking._id,
          status: 'confirmed',
          message: 'Your consultation request has been accepted by the advocate.',
          chatId: booking.chat,
        });
        io.to(`user:${booking.client}`).emit('booking_assigned', {
          bookingId: booking._id,
          status: 'confirmed',
          chatId: booking.chat,
        });
      }
      await createNotification({
        recipientId: booking.client,
        senderId: req.user._id,
        title: 'Consultation Confirmed! 🎉',
        message: `Your consultation request has been accepted by Advocate ${req.user.name}.`,
        type: 'booking_accepted',
        relatedId: booking._id,
      });
    } else if (status === 'cancelled') {
      if (io) {
        io.to(`user:${booking.client}`).emit('booking_status_updated', {
          bookingId: booking._id,
          status: 'cancelled',
          message: `Your consultation request was cancelled.`,
        });
      }
      await createNotification({
        recipientId: booking.client,
        senderId: req.user._id,
        title: 'Consultation Cancelled ❌',
        message: `Your consultation request was cancelled: ${cancellationReason || 'No reason provided'}.`,
        type: 'booking_rejected',
        relatedId: booking._id,
      });
    }

    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } })
      .populate('client', 'name avatar phone');
    if (!booking) return next(new AppError('Booking not found.', 404));

    const requesterId = req.user._id.toString();
    const isClient = booking.client?._id?.toString() === requesterId;
    const isAdvocate = booking.advocate?.user?._id?.toString() === requesterId;
    const isStaff = STAFF_ROLES.has(req.user.role);
    if (!isClient && !isAdvocate && !isStaff) {
      return next(new AppError('Not authorized to view this booking.', 403));
    }

    // Never expose the other party's call token.
    if (isAdvocate) booking.videoRoomToken = undefined;
    else booking.advocateVideoToken = undefined;
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
};

// ─── PATCH /api/bookings/:id/schedule ─────────────────────────────────────────
// Client selects a preferred time slot for their confirmed booking
exports.scheduleSlot = async (req, res, next) => {
  try {
    const { scheduledAt } = req.body; // ISO datetime string
    if (!scheduledAt) return next(new AppError('scheduledAt datetime is required.', 400));

    const slotDate = new Date(scheduledAt);
    if (isNaN(slotDate.getTime())) return next(new AppError('Invalid datetime format.', 400));
    if (slotDate < new Date()) return next(new AppError('Scheduled time must be in the future.', 400));

    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name expoPushToken fcmToken' } })
      .populate('client', 'name');
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client._id.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));
    if (!['confirmed', 'pending'].includes(booking.status))
      return next(new AppError('Only confirmed or pending bookings can be scheduled.', 400));

    // Save scheduled slot
    booking.date = slotDate;
    booking.timeSlot = {
      startTime: slotDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(slotDate.getTime() + 60 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
    await booking.save();

    // Notify advocate via socket
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      if (booking.advocate?.user?._id) {
        io.to(`user:${booking.advocate.user._id}`).emit('slot_scheduled', {
          bookingId: booking._id,
          clientName: booking.client.name,
          scheduledAt: slotDate.toISOString(),
          mode: booking.consultationMode,
        });
      }
    } catch (_) { /* socket may not be initialized in test env */ }

    // Push notification to advocate
    await createNotification({
      recipientId: booking.advocate?.user?._id,
      senderId: req.user._id,
      title: '📅 Consultation Scheduled',
      message: `${booking.client.name} scheduled a ${booking.consultationMode} consultation for ${slotDate.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`,
      type: 'booking_confirmed',
      relatedId: booking._id,
    });

    res.json({ success: true, data: booking, message: 'Slot scheduled successfully.' });
  } catch (err) { next(err); }
};

// ─── GET /api/bookings/:id/can-join-call ───────────────────────────────────────
// Validates if appointment time window is valid for call joining
exports.canJoinCall = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } })
      .populate('client', 'name avatar');

    if (!booking) return next(new AppError('Booking not found.', 404));

    const userIdStr = req.user._id.toString();
    const clientIdStr = booking.client?._id?.toString() || booking.client?.toString();
    const advUserIdStr = booking.advocate?.user?._id?.toString() || booking.advocate?.user?.toString();

    if (userIdStr !== clientIdStr && userIdStr !== advUserIdStr && req.user.role !== 'admin') {
      return next(new AppError('Not authorized to join this call.', 403));
    }

    if (['cancelled', 'rejected'].includes(booking.status)) {
      return res.json({
        success: false,
        canJoin: false,
        reason: 'APPOINTMENT_CANCELLED',
        message: 'This consultation has been cancelled.',
      });
    }
    if (booking.payment?.status !== 'paid') {
      return next(new AppError('Payment is required before joining this call.', 409));
    }
    if (!['voice', 'video'].includes(booking.consultationMode)) {
      return next(new AppError('This consultation does not include calls.', 409));
    }

    // Appointment time window check (5-minute pre-buffer, 60-minute post-buffer)
    const now = Date.now();
    const scheduledStart = booking.date ? new Date(booking.date).getTime() : null;
    const scheduledEnd = scheduledStart ? scheduledStart + (60 * 60 * 1000) : null;

    let canJoin = true;
    let reason = 'ALLOWED';
    const { Settings } = require('../models/Settings') || {};
    let bufferHours = 24; // Default
    try {
      const SettingsModel = require('../models/Settings');
      const settings = await SettingsModel.findOne({ singletonId: 'global' });
      if (settings && settings.postConsultationBufferHours !== undefined) {
        bufferHours = settings.postConsultationBufferHours;
      }
    } catch (e) {}

    if (scheduledStart && scheduledEnd) {
      const preBuffer = 15 * 60 * 1000; // 15 mins before
      const postBuffer = bufferHours * 60 * 60 * 1000; // Dynamic hours after

      if (now < scheduledStart - preBuffer) {
        canJoin = false;
        reason = 'TOO_EARLY';
      } else if (now > scheduledEnd + postBuffer) {
        canJoin = false;
        reason = 'APPOINTMENT_EXPIRED';
      }
    }

    const roomId = booking.videoRoomId || `legalitt-${booking._id}`;
    let token = null;
    if (canJoin) {
      try {
        token = generateZegoToken(userIdStr, roomId, 7200);
      } catch (tokenErr) {
        logger.error(`[Zego] Fresh call token failed for booking ${booking._id}: ${tokenErr.message}`);
        return next(new AppError('Secure call service is unavailable.', 503));
      }
    }

    res.json({
      success: true,
      canJoin,
      reason,
      message: canJoin ? 'Call allowed' : reason === 'TOO_EARLY' ? 'Call window not open yet' : 'Appointment time window expired',
      data: {
        bookingId: booking._id,
        zegoRoomId: roomId,
        zegoToken: token || null,
        zegoAppId: Number(process.env.ZEGO_APP_ID || booking.zegoAppId || 0),
        clientName: booking.client?.name || 'Client',
        advocateName: booking.advocate?.user?.name || 'Advocate',
        myUserId: userIdStr,
        myUserName: req.user.name || (userIdStr === advUserIdStr ? 'Advocate' : 'Client'),
        targetRoute: userIdStr === advUserIdStr ? 'AdvocateCall' : 'VideoCall',
        scheduledStart: booking.date || null,
        bufferHours: bufferHours,
      },
    });
  } catch (err) { next(err); }
};
