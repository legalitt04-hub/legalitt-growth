// src/controllers/walletController.js
// Handles: advocate wallet, withdrawal requests, commission crediting, earnings history

const Advocate = require('../models/Advocate');
const Withdrawal = require('../models/Withdrawal');
const Settings = require('../models/Settings');
const Booking = require('../models/Booking');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// ─── GET /api/v1/wallet ───────────────────────────────────────────────────────
exports.getWallet = async (req, res, next) => {
  try {
    const advocate = await Advocate.findOne({ user: req.user._id })
      .select('wallet bankDetails totalConsultations')
      .lean();
    if (!advocate) return next(new AppError('Advocate profile not found.', 404));

    const recentWithdrawals = await Withdrawal.find({ advocateUser: req.user._id }).lean()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get per-booking earning transactions (newest first, last 50)
    const earningTransactions = (advocate.wallet?.earningTransactions || [])
      .slice()
      .sort((a, b) => new Date(b.creditedAt) - new Date(a.creditedAt))
      .slice(0, 50);

    // Pull real commission rate from Settings
    const settings = await Settings.findOne().lean();
    const commissionRate = settings?.commissionRate || 20;


    // Weekly breakdown (Last 4 weeks)
    const weeklyMap = {};
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    const now = new Date();
    // Pre-fill weeks
    for (let i = 4; i >= 1; i--) {
      weeklyMap[`W${i}`] = { label: `W${i}`, earnings: 0, count: 0 };
    }
    allTxns.forEach(txn => {
      const d = new Date(txn.creditedAt);
      const diffTime = now - d;
      const diffWeeks = Math.floor(diffTime / msInWeek);
      if (diffWeeks < 4 && diffWeeks >= 0) {
        const key = `W${4 - diffWeeks}`;
        weeklyMap[key].earnings += txn.netAmount || 0;
        weeklyMap[key].count += 1;
      }
    });

    // Calculate growth
    const currentMonthKey = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    
    const currentMonthEarnings = monthlyMap[currentMonthKey]?.earnings || 0;
    const lastMonthEarnings = monthlyMap[lastMonthKey]?.earnings || 0;
    let growth = 0;
    if (lastMonthEarnings === 0 && currentMonthEarnings > 0) growth = 100;
    else if (lastMonthEarnings > 0) growth = Math.round(((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100);

    res.json({
      success: true,
      data: {
        wallet: {
          balance:           advocate.wallet?.balance           ?? 0,
          totalEarned:       advocate.wallet?.totalEarned       ?? 0,
          pendingWithdrawal: advocate.wallet?.pendingWithdrawal ?? 0,
          totalWithdrawn:    advocate.wallet?.totalWithdrawn    ?? 0,
        },
        bankDetails: advocate.bankDetails || null,
        totalConsultations: advocate.totalConsultations || 0,
        recentWithdrawals,
        earningTransactions,
        commissionRate,   // Live from admin settings
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/wallet/bank-details ──────────────────────────────────────────
exports.saveBankDetails = async (req, res, next) => {
  try {
    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = req.body;
    if (!accountHolder || !accountNumber || !ifscCode || !bankName) {
      return next(new AppError('Account holder name, account number, IFSC, and bank name are required.', 400));
    }

    await Advocate.findOneAndUpdate(
      { user: req.user._id },
      { bankDetails: { accountHolder, accountNumber, ifscCode, bankName, upiId } }
    );

    res.json({ success: true, message: 'Bank details saved successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/wallet/withdraw ─────────────────────────────────────────────
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankDetails } = req.body;
    if (!amount || amount < 500) return next(new AppError('Minimum withdrawal amount is ₹500.', 400));

    const advocate = await Advocate.findOne({ user: req.user._id });
    if (!advocate) return next(new AppError('Advocate profile not found.', 404));

    const availableBalance = advocate.wallet?.balance || 0;
    if (amount > availableBalance) {
      return next(new AppError(`Insufficient balance. Available: ₹${availableBalance}.`, 400));
    }

    // Use saved bank details or ones provided in request
    const details = bankDetails || advocate.bankDetails;
    if (!details?.accountNumber || !details?.ifscCode) {
      return next(new AppError('Bank details are required for withdrawal. Please save them in your profile first.', 400));
    }

    // Check for pending withdrawal
    const pendingExists = await Withdrawal.findOne({ advocateUser: req.user._id, status: 'pending' });
    if (pendingExists) {
      return next(new AppError('You already have a pending withdrawal request. Please wait for it to be processed.', 400));
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      advocate: advocate._id,
      advocateUser: req.user._id,
      amount,
      bankDetails: details,
    });

    // Hold amount (deduct from balance, add to pending)
    advocate.wallet.balance -= amount;
    advocate.wallet.pendingWithdrawal = (advocate.wallet.pendingWithdrawal || 0) + amount;
    await advocate.save();

    // ── Real-time: notify admin panel via socket ───────────────────────────
    try {
      const { getIO } = require('../config/socket');
      getIO().to('admin_room').emit('new_withdrawal_request', {
        withdrawalId: withdrawal._id.toString(),
        amount,
        advocateName: req.user.name,
        requestedAt:  withdrawal.createdAt,
      });
    } catch (_) {}

    // ── In-app notification to super_admin ────────────────────────────────
    try {
      const User = require('../models/User');
      const { createNotification } = require('../utils/notificationHelper');
      const admins = await User.find({ role: { $in: ['super_admin', 'admin', 'superadmin', 'accounts'] } }).select('_id').lean();
      await Promise.all(admins.map(admin =>
        createNotification({
          recipientId: admin._id,
          title:       '💸 New Withdrawal Request',
          message:     `${req.user.name} has requested a withdrawal of ₹${amount}. Review in admin panel.`,
          type:        'payment',
          data:        { withdrawalId: withdrawal._id },
        })
      ));
    } catch (_) {}

    logger.info(`Withdrawal request ₹${amount} by advocate ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Withdrawal request of ₹${amount} submitted. Admin will process it within 2-3 business days.`,
      data: withdrawal,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Utility: Credit advocate wallet after payment ────────────────────────────
// Called by bookingAssignController after admin assigns advocate + payment is paid
exports.creditAdvocateWallet = async ({ advocateId, bookingAmount, bookingId }) => {
  try {
    // Get commission rate from settings
    const settings = await Settings.findOne();
    const commissionRate = settings?.commissionRate || 20;
    const platformFee = Math.round(bookingAmount * (commissionRate / 100));
    const advocateEarning = bookingAmount - platformFee;

    // Fetch booking details for the transaction log
    let clientName = 'Client';
    let serviceType = 'legal_advice';
    let consultationMode = 'chat';

    try {
      const booking = await Booking.findById(bookingId)
        .populate('client', 'name')
        .lean();
      if (booking) {
        clientName      = booking.client?.name || 'Client';
        serviceType     = booking.serviceType  || 'legal_advice';
        consultationMode= booking.consultationMode || 'chat';
      }
    } catch (bErr) {
      logger.warn('[Wallet] Could not fetch booking details for transaction log:', bErr.message);
    }

    // Update wallet balance + append earning transaction
    const credited = await Advocate.findOneAndUpdate({
      _id: advocateId,
      'wallet.earningTransactions.bookingId': { $ne: bookingId },
    }, {
      $inc: {
        'wallet.balance':     advocateEarning,
        'wallet.totalEarned': advocateEarning,
        totalConsultations: 1,
      },
      $push: {
        'wallet.earningTransactions': {
          bookingId,
          clientName,
          serviceType,
          consultationMode,
          grossAmount:    bookingAmount,
          platformFee,
          netAmount:      advocateEarning,
          commissionRate,
          creditedAt:     new Date(),
        },
      },
    }, { new: true });

    if (!credited) {
      logger.info(`[Wallet] Skipped duplicate credit for booking ${bookingId}`);
      return { advocateEarning: 0, platformFee: 0, commissionRate, alreadyCredited: true };
    }

    logger.info(`[Wallet] Advocate ${advocateId} credited ₹${advocateEarning} (${100 - commissionRate}% of ₹${bookingAmount}) for booking ${bookingId}`);
    return { advocateEarning, platformFee, commissionRate };
  } catch (err) {
    logger.error('[Wallet] Failed to credit advocate wallet:', err.message);
    return null;
  }
};

// ─── GET /api/v1/wallet/earnings ──────────────────────────────────────────────
// Returns paginated earning transaction history
exports.getEarnings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const advocate = await Advocate.findOne({ user: req.user._id })
      .select('wallet.earningTransactions wallet.balance wallet.totalEarned totalConsultations')
      .lean();
    if (!advocate) return next(new AppError('Advocate profile not found.', 404));

    const settings = await Settings.findOne().lean();
    const commissionRate = settings?.commissionRate || 20;

    const allTxns = (advocate.wallet?.earningTransactions || [])
      .slice()
      .map(tx => ({ ...tx, isExpected: false }));

    // Inject active (confirmed) bookings as pending expected earnings
    const activeBookings = await Booking.find({
      advocate: advocate._id, // use the actual advocate document ID, not the user ID
      status: 'confirmed'
    }).populate('client', 'name').lean();

    let pendingExpectedTotal = 0;
    activeBookings.forEach(booking => {
      const amount = booking.consultationFee || booking.amount || 0;
      const expectedNet = amount * (1 - commissionRate / 100);
      pendingExpectedTotal += expectedNet;
      
      allTxns.push({
        bookingId: booking._id,
        clientName: booking.client?.name || 'Client',
        serviceType: 'Consultation',
        consultationMode: booking.consultationMode,
        grossAmount: amount,
        platformFee: amount - expectedNet,
        netAmount: expectedNet,
        commissionRate,
        creditedAt: booking.createdAt,
        isExpected: true
      });
    });

    allTxns.sort((a, b) => new Date(b.creditedAt) - new Date(a.creditedAt));

    const pageNum  = Number(page);
    const limitNum = Number(limit);
    const paginated = allTxns.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Monthly breakdown
    const monthlyMap = {};
    allTxns.forEach(txn => {
      const key = new Date(txn.creditedAt).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, earnings: 0, count: 0 };
      monthlyMap[key].earnings += txn.netAmount || 0;
      monthlyMap[key].count   += 1;
    });

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total: allTxns.length,
        page: pageNum,
        pages: Math.ceil(allTxns.length / limitNum),
        hasMore: pageNum * limitNum < allTxns.length,
      },
      summary: {
        totalEarned:      (advocate.wallet?.totalEarned || 0) + pendingExpectedTotal,
        availableBalance: advocate.wallet?.balance        || 0,
        totalConsultations: advocate.totalConsultations   || 0,
      },
      monthlyBreakdown: Object.values(monthlyMap).slice(0, 6), // Last 6 months
      weeklyBreakdown: Object.values(weeklyMap),
      growth
    });
  } catch (err) {
    next(err);
  }
};
