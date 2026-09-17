// src/controllers/bookingAssignController.js
// Admin controller for managing Legal Advice booking assignments

const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const User = require('../models/User');
const { Chat } = require('../models/Chat');
const Case = require('../models/Case');
const { createNotification } = require('../utils/notificationHelper');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { setupZegoCall } = require('../services/zegoService');

// GET /api/v1/admin/bookings?status=pending_assignment
exports.getPendingBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, serviceType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { 'payment.status': { $in: ['paid', 'not_required'] } };
    if (status) {
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    } else {
      filter.status = { $in: ['pending_assignment', 'pending', 'confirmed', 'in_progress'] };
    }
    if (serviceType) filter.serviceType = serviceType;

    const [bookings, total, pendingCount, activeCount, completedCount, totalCount, paidPayments] = await Promise.all([
      Booking.find(filter).lean()
        .populate('client', 'name email phone avatar address')
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar phone' } })
        .populate('assignedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Booking.countDocuments(filter),
      Booking.countDocuments({ status: 'pending_assignment', 'payment.status': { $in: ['paid', 'not_required'] } }),
      Booking.countDocuments({ status: { $in: ['confirmed', 'in_progress'] } }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({}),
      Booking.aggregate([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$payment.amount' } } },
      ]),
    ]);

    // Add SLA info to each booking safely
    const bookingsWithSLA = bookings.map(b => {
      const deadlineDate = b.assignmentDeadline ? new Date(b.assignmentDeadline) : new Date(b.createdAt || Date.now());
      const deadline = isNaN(deadlineDate.getTime()) ? new Date() : deadlineDate;
      const now = new Date();
      const hoursRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
      return {
        ...b,
        sla: {
          deadline: deadline.toISOString(),
          hoursRemaining: Math.round(hoursRemaining * 10) / 10,
          isOverdue: now > deadline,
          isUrgent: hoursRemaining < 4 && hoursRemaining > 0,
        },
      };
    });

    res.json({
      success: true,
      data: bookingsWithSLA,
      summary: {
        pending: pendingCount,
        active: activeCount,
        completed: completedCount,
        total: totalCount,
        revenue: paidPayments[0]?.totalRevenue || 0,
      },
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/admin/bookings/:id
exports.getBookingDetail = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('client', 'name email phone avatar address')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar phone' } })
      .populate('assignedBy', 'name email')
      .lean();

    if (!booking) return next(new AppError('Booking not found.', 404));

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/admin/bookings/:id/nearby-advocates
// Returns advocates in the same city as the client who made this booking
exports.getNearbyAdvocatesForBooking = async (req, res, next) => {
  try {
    const { specialization, search, limit: qLimit = 20, page: qPage = 1 } = req.query;
    const pageLimit = Math.min(Number(qLimit), 100); // max 100 per page
    const skip = (Number(qPage) - 1) * pageLimit;

    const booking = await Booking.findById(req.params.id)
      .populate('client', 'name address')
      .lean();

    // For FIR Drafts (not in Booking collection), skip city filter and return all advocates
    const city = booking?.clientCity || booking?.client?.address?.city;

    let cityFilter = { verificationStatus: { $ne: 'rejected' } };
    if (city) {
      cityFilter['location.address.city'] = new RegExp(city, 'i');
    }
    if (specialization) {
      cityFilter.specializations = specialization;
    }

    let allFilter = { verificationStatus: { $ne: 'rejected' } };
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      }).select('_id').lean();

      const matchingUserIds = matchingUsers.map(u => u._id);

      allFilter.$or = [
        { user: { $in: matchingUserIds } },
        { 'location.address.city': searchRegex },
        { specializations: searchRegex },
        { barCouncilNumber: searchRegex },
      ];
    }

    // Server-side paginated fetch
    const [nearbyAdvocates, allAdvocates, totalNearbyCount, totalAdvocatesCount] = await Promise.all([
      Advocate.find(cityFilter).lean()
        .select('user specializations rating consultationFee location experience verificationStatus isVerified')
        .populate('user', 'name avatar phone email')
        .sort({ 'rating.average': -1, createdAt: -1 })
        .skip(search ? 0 : skip)   // skip only when not searching
        .limit(pageLimit)
        .lean(),
      Advocate.find(allFilter).lean()
        .select('user specializations rating consultationFee location experience verificationStatus isVerified')
        .populate('user', 'name avatar phone email')
        .sort({ 'rating.average': -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Advocate.countDocuments(cityFilter),
      Advocate.countDocuments({ verificationStatus: { $ne: 'rejected' } }),
    ]);


    res.json({
      success: true,
      data: {
        nearbyAdvocates,
        allAdvocates,
        bookingCity: city || 'Unknown',
        totalNearby: totalNearbyCount,
        totalAdvocates: totalAdvocatesCount,
        page: Number(qPage),
        limit: pageLimit,
        pages: Math.ceil(totalAdvocatesCount / pageLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/admin/bookings/:id/assign
// Admin assigns an advocate to a pending booking
exports.assignAdvocate = async (req, res, next) => {
  try {
    const { advocateId, sendWhatsApp = true } = req.body;
    if (!advocateId) return next(new AppError('Advocate ID is required.', 400));

    const booking = await Booking.findById(req.params.id)
      .populate('client', 'name email phone fcmToken');

    if (!booking) return next(new AppError('Booking not found.', 404));
    if (!['paid', 'not_required'].includes(booking.payment?.status)) return next(new AppError('Payment must be completed before assignment.', 409));
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return next(new AppError('Cannot assign to a completed or cancelled booking.', 400));
    }

    const advocate = await Advocate.findById(advocateId).populate('user', 'name email phone fcmToken avatar');
    if (!advocate) return next(new AppError('Advocate not found.', 404));
    if (advocate.verificationStatus !== 'approved') {
      return next(new AppError('Only verified advocates can be assigned.', 400));
    }

    // Set to 'pending' so advocate sees it as a new Pending Request
    // Advocate must accept → status becomes 'confirmed' (via /bookings/:id/status)
    booking.advocate = advocateId;
    booking.status = 'pending';
    booking.assignedAt = new Date();
    booking.assignedBy = req.user._id;

    // Find or create chat room (prevent duplicates between same client-advocate pair)
    let chat;
    try {
      chat = await Chat.findOne({
        participants: { $all: [booking.client._id, advocate.user._id], $size: 2 },
        isActive: true,
      });
      if (!chat) {
        chat = await Chat.create({
          participants: [booking.client._id, advocate.user._id],
          booking: booking._id,
        });
      }
      booking.chat = chat._id;
    } catch (chatErr) {
      logger.error('Failed to find/create chat room:', chatErr.message);
    }

    // Create Case portfolio entry
    try {
      await Case.create({
        title: booking.issue?.substring(0, 80) || 'Legal Advice Case',
        description: booking.issue,
        caseNumber: `LGT-${booking._id.toString().substring(18).toUpperCase()}`,
        client: booking.client._id,
        advocate: advocateId,
        status: 'active',
      });
    } catch (caseErr) {
      logger.error('Failed to create case:', caseErr.message);
    }

    // ─── ZEGOCLOUD: Generate room + tokens for video/voice ──────────────────
    // Works for ALL modes: chat gets zegoRoomId for in-app messaging too
    try {
      const zegoSetup = setupZegoCall({
        bookingId: booking._id.toString(),
        clientId:  booking.client._id.toString(),
        advocateId: advocate.user._id.toString(),
      });

      if (zegoSetup.success) {
        booking.videoRoomId    = zegoSetup.roomId;
        booking.videoRoomToken = zegoSetup.clientToken;   // Client's ZEGO token
        booking.advocateVideoToken = zegoSetup.advocateToken; // Advocate's ZEGO token
        booking.zegoAppId      = zegoSetup.appId;
        logger.info(`[ZEGO] Room ${zegoSetup.roomId} created for booking ${booking._id}`);
      }
    } catch (zegoErr) {
      logger.error('ZEGOCLOUD setup failed:', zegoErr.message);
    }

    await booking.save();

    // ─── Credit advocate wallet if payment already done ────────────────────────
    if (booking.payment?.status === 'paid') {
      setImmediate(async () => {
        try {
          const { creditAdvocateWallet } = require('./walletController');
          await creditAdvocateWallet({
            advocateId: advocate._id,
            bookingAmount: booking.payment.amount,
            bookingId: booking._id,
          });
          // Mark as credited to prevent double-credit on completion
          await Booking.findByIdAndUpdate(booking._id, { $set: { walletCredited: true } });
        } catch (walletErr) {
          logger.error('[Wallet] Credit failed on assignment:', walletErr.message);
        }
      });
    }

    // ─── Real-time notifications ───────────────────────────────────────────────

    // Emit Socket.io to client — room: user:${id} (matches socket.js join)
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${booking.client._id}`).emit('booking_assigned', {
        bookingId: booking._id,
        advocate: {
          id: advocate._id,
          name: advocate.user.name,
          avatar: advocate.user.avatar,
          specializations: advocate.specializations,
          rating: advocate.rating,
          consultationFee: advocate.consultationFee,
        },
        chatId: chat?._id,
        consultationMode: booking.consultationMode,
        // ZEGOCLOUD room credentials
        zegoRoomId:    booking.videoRoomId,
        zegoToken:     booking.videoRoomToken,
        zegoAppId:     booking.zegoAppId,
        status: 'pending',
      });

      // Emit to advocate — room: user:${id} (matches socket.js join)
      io.to(`user:${advocate.user._id}`).emit('new_booking_assigned', {
        bookingId: booking._id,
        client: { name: booking.client.name, avatar: booking.client.avatar },
        consultationMode: booking.consultationMode,
        issue: booking.issue,
        chatId: chat?._id,
        zegoRoomId:  booking.videoRoomId,
        zegoToken:   booking.advocateVideoToken,
        zegoAppId:   booking.zegoAppId,
        status: 'pending',
      });

      io.to(`user:${advocate.user._id}`).emit('new_case_request', {
        bookingId: booking._id,
        status: 'pending',
      });
    }

    // In-app push notifications
    await createNotification({
      recipientId: booking.client._id,
      senderId: advocate.user._id,
      title: 'Advocate Assigned! ⚖️',
      message: `${advocate.user.name} has been assigned to your legal advice request. You can now start chatting.`,
      type: 'booking_accepted',
      relatedId: booking._id,
    });

    await createNotification({
      recipientId: advocate.user._id,
      senderId: booking.client._id,
      title: 'New Consultation Assigned 📋',
      message: `You have been assigned to handle ${booking.client.name}'s legal advice request.`,
      type: 'booking_created',
      relatedId: booking._id,
    });

    // WhatsApp to assigned advocate (if sendWhatsApp = true)
    if (sendWhatsApp && advocate.user.phone) {
      try {
        const { notifyAdvocateAssigned } = require('../services/whatsappService');
        await notifyAdvocateAssigned({
          phone: advocate.user.phone,
          advocateName: advocate.user.name,
          clientName: booking.client.name,
          consultationMode: booking.consultationMode,
          bookingId: booking._id.toString(),
        });
        booking.whatsappSentToAdvocate = true;
        await booking.save();
      } catch (waErr) {
        logger.error('WhatsApp notification failed:', waErr.message);
      }
    }

    logger.info(`Admin ${req.user.email} assigned booking ${booking._id} to advocate ${advocate.user.name}`);

    const updatedBooking = await Booking.findById(booking._id)
      .populate('client', 'name email phone avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar phone' } })
      .lean();

    res.json({
      success: true,
      message: `Booking assigned to ${advocate.user.name} successfully.`,
      data: updatedBooking,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/admin/bookings/:id/status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('advocate', '_id user consultationFee')
      .populate('client', 'name');
    if (!booking) return next(new AppError('Booking not found.', 404));

    const prevStatus = booking.status;
    booking.status = status;
    if (cancellationReason) {
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = 'admin';
    }
    await booking.save();

    // ─── Credit advocate wallet when marking as COMPLETED ─────────────────────
    // Only credit if: moving TO completed, payment was made, advocate exists
    // Guard: only credit if not already credited (check walletCredited flag)
    if (
      status === 'completed' &&
      prevStatus !== 'completed' &&
      booking.payment?.status === 'paid' &&
      booking.advocate &&
      !booking.walletCredited
    ) {
      setImmediate(async () => {
        try {
          const { creditAdvocateWallet } = require('./walletController');
          await creditAdvocateWallet({
            advocateId:    booking.advocate._id,
            bookingAmount: booking.payment.amount,
            bookingId:     booking._id,
          });
          // Mark as credited to prevent double-crediting
          await Booking.findByIdAndUpdate(booking._id, { $set: { walletCredited: true } });
          logger.info(`[Wallet] Credited advocate on booking completion: ${booking._id}`);
        } catch (walletErr) {
          logger.error('[Wallet] Credit failed on completion:', walletErr.message);
        }
      });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};
