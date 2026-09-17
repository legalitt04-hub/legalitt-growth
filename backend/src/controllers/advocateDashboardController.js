// src/controllers/advocateDashboardController.js
// Dashboard stats for advocate — uses real wallet.earningTransactions for earnings

const Booking  = require('../models/Booking');
const Advocate = require('../models/Advocate');
const { Chat, Message } = require('../models/Chat');
const Review   = require('../models/Review');

// ─── GET /api/v1/advocate-dashboard/stats ────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Resolve logged-in User → Advocate
    const advocate = await Advocate.findOne({ user: req.user._id }).populate('user');
    if (!advocate) {
      return res.status(404).json({
        success: false,
        message: 'Advocate profile not found for this user account.'
      });
    }

    const advocateId = advocate._id;
    const userId     = req.user._id;

    // 2. Date boundaries
    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek  = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const requestedYear = Number(req.query.year);
    const requestedMonth = Number(req.query.month);
    const anchorYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear : now.getFullYear();
    const anchorMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth - 1 : now.getMonth();
    const anchorStart = new Date(anchorYear, anchorMonth, 1);
    const anchorEnd = new Date(anchorYear, anchorMonth + 1, 0, 23, 59, 59, 999);
    const periodKey = ['this_month', 'last_month', 'last_3_months', 'last_6_months', 'all_time'].includes(req.query.period)
      ? req.query.period : 'this_month';
    const periodMonthCount = { this_month: 1, last_month: 1, last_3_months: 3, last_6_months: 6 };
    let selectedStart = new Date(anchorStart);
    let selectedEnd = new Date(anchorEnd);
    if (periodKey === 'last_month') {
      selectedStart = new Date(anchorYear, anchorMonth - 1, 1);
      selectedEnd = new Date(anchorYear, anchorMonth, 0, 23, 59, 59, 999);
    } else if (periodKey === 'last_3_months') {
      selectedStart = new Date(anchorYear, anchorMonth - 2, 1);
    } else if (periodKey === 'last_6_months') {
      selectedStart = new Date(anchorYear, anchorMonth - 5, 1);
    } else if (periodKey === 'all_time') {
      selectedStart = new Date(0);
    }

    // 3. Today's Appointments (pending or today-confirmed)
    const todayAppointments = await Booking.find({
      advocate: advocateId,
      $or: [
        { date: { $gte: startOfToday, $lte: endOfToday }, status: 'confirmed' },
        { status: 'pending' }
      ]
    }).lean()
    .populate('client', 'name email avatar phone')
    .sort({ 'timeSlot.startTime': 1 })
    .lean();

    // 4. Pending unread messages
    const advocateChats   = await Chat.find({ participants: userId }).lean().select('_id');
    const chatIds         = advocateChats.map(c => c._id);
    const pendingMessagesCount = await Message.countDocuments({
      chat:   { $in: chatIds },
      sender: { $ne: userId },
      readAt: { $exists: false }
    });

    // 5. Reviews & rating analytics
    const allAdvocateReviews = await Review.find({ advocate: advocateId }).lean()
      .populate('client', 'name avatar')
      .populate('booking', 'type issue')
      .sort({ createdAt: -1 })
      .lean();

    const totalReviewCount    = allAdvocateReviews.length;
    const ratingDistribution  = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum             = 0;
    let positiveReviewsCount  = 0;

    allAdvocateReviews.forEach(r => {
      const value = Number(r.rating);
      if (!Number.isFinite(value) || value < 1 || value > 5) return;
      const rounded = Math.round(value);
      ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
      ratingSum += value;
      if (value >= 4) positiveReviewsCount += 1;
    });

    const averageRating      = totalReviewCount > 0
      ? Math.round((ratingSum / totalReviewCount) * 10) / 10
      : (advocate.rating?.average || 0);
    const positivePercentage = totalReviewCount > 0
      ? Math.round((positiveReviewsCount / totalReviewCount) * 100)
      : 0;
    const recentReviews      = allAdvocateReviews.slice(0, 5);

    // 6. Earnings from active Bookings (confirmed/completed)
    const allBookings = await Booking.find({ advocate: advocateId })
      .select('payment status serviceType consultationMode type createdAt date').lean();
    const activeBookings = allBookings.filter(booking =>
      ['confirmed', 'completed'].includes(booking.status) && booking.payment?.status === 'paid'
    );

    let dailyEarnings   = 0;
    let weeklyEarnings  = 0;
    let monthlyEarnings = 0;

    activeBookings.forEach(booking => {
      const bDate = new Date(booking.createdAt || booking.date);
      const net = booking.payment?.amount || 0;
      if (bDate >= startOfToday && bDate <= endOfToday) dailyEarnings   += net;
      if (bDate >= startOfWeek)                         weeklyEarnings  += net;
      if (bDate >= startOfMonth)                        monthlyEarnings += net;
    });

    // 7. Profile completion %
    let completion = 0;
    if (advocate.barCouncilNumber)                    completion += 20;
    if (advocate.experience)                          completion += 15;
    if (advocate.consultationFee > 0)                 completion += 15;
    if (advocate.about && advocate.about.length > 20) completion += 15;
    if (advocate.specializations?.length > 0)         completion += 15;
    if (advocate.user?.avatar)                        completion += 20;

    // 8. Last 7 days trend (from bookings)
    const last7Days     = [];
    const caseTrend     = [];
    const earningsTrend = [];

    const graphEnd = selectedEnd > now ? now : selectedEnd;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(graphEnd);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

      const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayBookings = activeBookings.filter(b => {
        const td = new Date(b.createdAt || b.date);
        return td >= dStart && td <= dEnd;
      });
      caseTrend.push(dayBookings.length);
      earningsTrend.push(dayBookings.reduce((s, b) => s + (b.payment?.amount || 0), 0));
    }

    // 9. Last 6 months trend (from bookings)
    const last6Months          = [];
    const monthlyEarningsTrend = [];
    const monthlyConsultationTrend = [];
    const monthlyCompletedTrend = [];
    const monthlyAcceptanceTrend = [];
    const monthlyRatingTrend = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchorYear, anchorMonth - i, 1);
      last6Months.push(d.toLocaleDateString('en-US', { month: 'short' }));

      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthBookings = activeBookings.filter(b => {
        const td = new Date(b.createdAt || b.date);
        return td >= mStart && td <= mEnd;
      });
      monthlyEarningsTrend.push(monthBookings.reduce((s, b) => s + (b.payment?.amount || 0), 0));
      const allMonthBookings = allBookings.filter(b => {
        const td = new Date(b.date || b.createdAt);
        return td >= mStart && td <= mEnd;
      });
      const completedMonthBookings = allMonthBookings.filter(b => b.status === 'completed');
      const acceptedMonthBookings = allMonthBookings.filter(b => ['confirmed', 'in_progress', 'completed'].includes(b.status));
      const monthReviews = allAdvocateReviews.filter(r => r.createdAt >= mStart && r.createdAt <= mEnd);
      monthlyConsultationTrend.push(allMonthBookings.length);
      monthlyCompletedTrend.push(completedMonthBookings.length);
      monthlyAcceptanceTrend.push(allMonthBookings.length ? Math.round((acceptedMonthBookings.length / allMonthBookings.length) * 100) : 0);
      monthlyRatingTrend.push(monthReviews.length ? Math.round((monthReviews.reduce((sum, review) => sum + review.rating, 0) / monthReviews.length) * 10) / 10 : 0);
    }

    const bookingDate = booking => new Date(booking.date || booking.createdAt);
    const inRange = (booking, start, end) => {
      const value = bookingDate(booking);
      return !Number.isNaN(value.getTime()) && value >= start && value <= end;
    };
    const summarizePeriod = (start, end) => {
      const periodBookings = allBookings.filter(booking => inRange(booking, start, end));
      const paidBookings = periodBookings.filter(booking =>
        ['confirmed', 'completed'].includes(booking.status) && booking.payment?.status === 'paid'
      );
      const completed = periodBookings.filter(booking => booking.status === 'completed').length;
      const pending = periodBookings.filter(booking => ['pending', 'pending_assignment'].includes(booking.status)).length;
      const cancelled = periodBookings.filter(booking => booking.status === 'cancelled').length;
      const accepted = periodBookings.filter(booking => ['confirmed', 'in_progress', 'completed'].includes(booking.status)).length;
      const serviceCounts = periodBookings.reduce((counts, booking) => {
        const rawName = booking.serviceType || booking.consultationMode || booking.type || 'Legal Advice';
        const name = String(rawName).replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        counts[name] = (counts[name] || 0) + 1;
        return counts;
      }, {});
      const highestServiceCount = Math.max(...Object.values(serviceCounts), 1);
      return {
        earnings: paidBookings.reduce((sum, booking) => sum + (booking.payment?.amount || 0), 0),
        consultations: periodBookings.length,
        completed,
        pending,
        cancelled,
        acceptanceRate: periodBookings.length ? Math.round((accepted / periodBookings.length) * 100) : 0,
        servicePerformance: Object.entries(serviceCounts)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / highestServiceCount) * 100) }))
          .sort((a, b) => b.count - a.count),
      };
    };
    const selectedSummary = summarizePeriod(selectedStart, selectedEnd);
    const selectedMonthCount = periodMonthCount[periodKey];
    let previousSummary = null;
    if (selectedMonthCount) {
      const previousEnd = new Date(selectedStart.getTime() - 1);
      const previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth() - selectedMonthCount + 1, 1);
      previousSummary = summarizePeriod(previousStart, previousEnd);
    }
    const percentChange = (current, previous) => previous > 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : (current > 0 ? 100 : 0);
    selectedSummary.growth = {
      earnings: previousSummary ? percentChange(selectedSummary.earnings, previousSummary.earnings) : 0,
      consultations: previousSummary ? percentChange(selectedSummary.consultations, previousSummary.consultations) : 0,
      completed: previousSummary ? percentChange(selectedSummary.completed, previousSummary.completed) : 0,
      acceptance: previousSummary ? Math.round((selectedSummary.acceptanceRate - previousSummary.acceptanceRate) * 10) / 10 : 0,
    };

    res.status(200).json({
      success: true,
      data: {
        advocateId,
        todayAppointments,
        pendingMessagesCount,
        recentReviews,
        ratingStats: {
          totalReviews: totalReviewCount,
          averageRating: Number(averageRating),
          positivePercentage,
          distribution: ratingDistribution,
        },
        // Real wallet data (net after platform commission)
        earningsSummary: {
          daily:             dailyEarnings,
          weekly:            weeklyEarnings,
          monthly:           monthlyEarnings,
          totalEarned:       advocate.wallet?.totalEarned       || 0,
          availableBalance:  advocate.wallet?.balance           || 0,
          totalWithdrawn:    advocate.wallet?.totalWithdrawn    || 0,
          pendingWithdrawal: advocate.wallet?.pendingWithdrawal || 0,
        },
        totalConsultations: advocate.totalConsultations || 0,
        profileCompletion: completion,
        analytics: {
          labels:               last7Days,
          caseTrend,
          earningsTrend,
          labelsMonthly:        last6Months,
          monthlyEarningsTrend,
          monthlyConsultationTrend,
          monthlyCompletedTrend,
          monthlyAcceptanceTrend,
          monthlyRatingTrend,
          selectedPeriod: {
            key: periodKey,
            start: selectedStart,
            end: selectedEnd,
            ...selectedSummary,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to aggregate dashboard analytics.',
      error: error.message,
    });
  }
};

// ─── GET /api/v1/advocate-dashboard/bookings ─────────────────────────────────
exports.getAdvocateBookings = async (req, res) => {
  try {
    const advocate = await Advocate.findOne({ user: req.user._id });
    if (!advocate) {
      return res.status(404).json({ success: false, message: 'Advocate profile not found.' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { advocate: advocate._id };
    if (status) filter.status = status;

    const skip     = (Number(page) - 1) * Number(limit);
    const bookings = await Booking.find(filter).lean()
      .populate('client', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Booking.countDocuments(filter);

    res.json({
      success: true,
      data: bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings.', error: error.message });
  }
};
