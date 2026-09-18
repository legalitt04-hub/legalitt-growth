// src/controllers/adminAdvocateController.js
// Admin: Pending advocate approvals, approve/reject, and withdrawal management

const Advocate = require('../models/Advocate');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Review = require('../models/Review');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { sendWelcomeEmail } = require('../services/emailService');
const { createNotification } = require('../utils/notificationHelper');

// ─── GET /api/v1/admin/advocates?status=pending ──────────────────────────────
exports.getAdvocates = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const status = req.query.status || req.query.verificationStatus || 'all';
    const skip = (Number(page) - 1) * Number(limit);

    let filter = {};
    if (status !== 'all') filter.verificationStatus = status;

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
        ],
        role: 'advocate',
      }).select('_id').lean();
      filter.$or = [
        { user: { $in: users.map(u => u._id) } },
        { barCouncilNumber: new RegExp(search, 'i') },
      ];
    }

    const [advocates, total, statusCounts] = await Promise.all([
      Advocate.find(filter).lean()
        .populate('user', 'name email phone avatar createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Advocate.countDocuments(filter),
      Advocate.aggregate([
        { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
      ]),
    ]);

    const advocateIds = advocates.map(advocate => advocate._id);
    const reviewStats = await Review.aggregate([
      { $match: { advocate: { $in: advocateIds }, isVerified: true } },
      { $group: { _id: '$advocate', average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const reviewMap = new Map(reviewStats.map(item => [String(item._id), { average: Math.round(item.average * 10) / 10, count: item.count }]));
    const data = advocates.map(advocate => ({ ...advocate, rating: reviewMap.get(String(advocate._id)) || { average: 0, count: 0 } }));
    const counts = statusCounts.reduce((result, item) => {
      result[item._id || 'pending'] = item.count;
      result.total += item.count;
      return result;
    }, { total: 0, pending: 0, under_review: 0, approved: 0, suspended: 0, rejected: 0 });

    res.json({
      success: true,
      data,
      counts,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/advocates/:id ─────────────────────────────────────────
exports.getAdvocateDetail = async (req, res, next) => {
  try {
    const advocate = await Advocate.findById(req.params.id)
      .populate('user', 'name email phone avatar createdAt')
      .lean();
    if (!advocate) return next(new AppError('Advocate not found.', 404));
    res.json({ success: true, data: advocate });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/advocates/:id/approve ───────────────────────────────
exports.approveAdvocate = async (req, res, next) => {
  try {
    const advocate = await Advocate.findById(req.params.id)
      .populate('user', 'name email phone');

    if (!advocate) return next(new AppError('Advocate not found.', 404));

    advocate.verificationStatus = 'approved';
    advocate.isVerified = true;
    advocate.verificationRejectionReason = undefined;
    await advocate.save();

    // Update user record
    await User.findByIdAndUpdate(advocate.user._id, { isVerified: true });

    // Send email notification to advocate
    try {
      await sendWelcomeEmail({
        toEmail: advocate.user.email,
        userName: advocate.user.name,
        subject: 'Congratulations! Your Legalitt Account is Approved ✅',
        customMessage: `Your advocate profile has been verified and approved. You can now log in to the Legalitt app and start accepting consultations from clients.`,
      });
    } catch (emailErr) {
      logger.error('Failed to send approval email:', emailErr.message);
    }

    // In-app notification
    await createNotification({
      recipientId: advocate.user._id,
      title: '✅ Account Approved!',
      message: 'Your advocate profile has been verified. You can now accept consultations.',
      type: 'system',
    });

    logger.info(`Admin ${req.user.email} approved advocate ${advocate.user.email}`);

    res.json({
      success: true,
      message: `${advocate.user.name}'s account has been approved. They will receive an email notification.`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/advocates/:id/reject ────────────────────────────────
exports.rejectAdvocate = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return next(new AppError('Rejection reason is required.', 400));

    const advocate = await Advocate.findById(req.params.id)
      .populate('user', 'name email');
    if (!advocate) return next(new AppError('Advocate not found.', 404));

    advocate.verificationStatus = 'rejected';
    advocate.isVerified = false;
    advocate.verificationRejectionReason = reason;
    await advocate.save();

    // In-app notification
    await createNotification({
      recipientId: advocate.user._id,
      title: '❌ Application Update',
      message: `Your advocate application was not approved. Reason: ${reason}. Please contact support.`,
      type: 'system',
    });

    logger.info(`Admin ${req.user.email} rejected advocate ${advocate.user.email}: ${reason}`);

    res.json({ success: true, message: `${advocate.user.name}'s application has been rejected.` });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/withdrawals ───────────────────────────────────────────
exports.getWithdrawals = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = status !== 'all' ? { status } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [withdrawals, total, statusCounts, pendingTotal, requestsToday] = await Promise.all([
      Withdrawal.find(filter).lean()
        .populate({ path: 'advocateUser', select: 'name email phone' })
        .populate({ path: 'advocate', select: 'wallet barCouncilNumber' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Withdrawal.countDocuments(filter),
      Withdrawal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
      Withdrawal.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Withdrawal.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

    const counts = Object.fromEntries(statusCounts.map(item => [item._id, item.count]));

    res.json({
      success: true,
      data: withdrawals,
      pendingTotal: pendingTotal[0]?.total || 0,
      stats: {
        pendingCount: counts.pending || 0,
        paidCount: counts.paid || 0,
        rejectedCount: counts.rejected || 0,
        requestsToday,
      },
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/withdrawals/:id/process ─────────────────────────────
exports.processWithdrawal = async (req, res, next) => {
  try {
    const { action, transactionId, adminNote } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return next(new AppError('Action must be "approve" or "reject".', 400));
    }

    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate('advocate')
      .populate('advocateUser', 'name email');

    if (!withdrawal) return next(new AppError('Withdrawal request not found.', 404));
    if (withdrawal.status !== 'pending') {
      return next(new AppError('This withdrawal has already been processed.', 400));
    }

    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = adminNote;

    if (action === 'approve') {
      withdrawal.status = 'paid';
      withdrawal.transactionId = transactionId || null; // optional — can add later

      // Update advocate wallet
      await Advocate.findByIdAndUpdate(withdrawal.advocate._id, {
        $inc: {
          'wallet.pendingWithdrawal': -withdrawal.amount,
          'wallet.totalWithdrawn':    withdrawal.amount,
        },
      });

      await createNotification({
        recipientId: withdrawal.advocateUser._id,
        title: '✅ Withdrawal Processed!',
        message: `₹${withdrawal.amount} has been transferred to your bank account. TXN: ${transactionId}`,
        type: 'payment',
      });
    } else {
      withdrawal.status = 'rejected';

      // Return amount to balance
      await Advocate.findByIdAndUpdate(withdrawal.advocate._id, {
        $inc: {
          'wallet.balance':           withdrawal.amount,
          'wallet.pendingWithdrawal': -withdrawal.amount,
        },
      });

      await createNotification({
        recipientId: withdrawal.advocateUser._id,
        title: '❌ Withdrawal Rejected',
        message: `Your withdrawal of ₹${withdrawal.amount} was rejected. Reason: ${adminNote || 'Contact support'}. Amount returned to wallet.`,
        type: 'payment',
      });
    }

    await withdrawal.save();
    logger.info(`Admin ${req.user.email} ${action}d withdrawal ${withdrawal._id} for ₹${withdrawal.amount}`);

    // ── Socket: real-time update to advocate ─────────────────────────────────
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      // Tell advocate their withdrawal was processed
      io.to(`user:${withdrawal.advocateUser._id.toString()}`).emit('withdrawal_processed', {
        withdrawalId: withdrawal._id.toString(),
        status:       withdrawal.status,   // 'paid' | 'rejected'
        amount:       withdrawal.amount,
        transactionId: withdrawal.transactionId || null,
        adminNote:    adminNote || null,
      });
      // Refresh withdrawal list for all admin tabs
      io.to('admin_room').emit('withdrawal_updated', {
        withdrawalId: withdrawal._id.toString(),
        status:       withdrawal.status,
      });
    } catch (socketErr) {
      logger.warn(`[Socket] withdrawal emit failed: ${socketErr.message}`);
    }

    res.json({
      success: true,
      message: `Withdrawal ${action === 'approve' ? 'approved and marked as paid' : 'rejected and amount returned to wallet'}.`,
      data: withdrawal,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/advocates/:id/rating ────────────────────────────────
exports.updateAdvocateRating = async (req, res, next) => {
  try {
    const { average, count = 1 } = req.body;
    if (average === undefined || average < 0 || average > 5) {
      return next(new AppError('Rating average must be between 0 and 5.', 400));
    }

    const advocate = await Advocate.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'rating.average': Number(average),
          'rating.count': Number(count),
        },
      },
      { new: true }
    ).populate('user', 'name email');

    if (!advocate) return next(new AppError('Advocate not found.', 404));

    logger.info(`Admin updated rating for ${advocate.user?.email} to ${average} stars`);

    res.json({
      success: true,
      message: `Updated rating for ${advocate.user?.name || 'Advocate'} to ${average} ⭐`,
      data: advocate,
    });
  } catch (err) {
    next(err);
  }
};
