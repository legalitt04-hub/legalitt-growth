const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middlewares/auth');
const razorpay = require('../services/razorpay');
const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const Settings = require('../models/Settings');
const { Chat } = require('../models/Chat');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { setupZegoCall } = require('../services/zegoService');
const { createNotification } = require('../utils/notificationHelper');

// ─── POST /api/v1/payments/create-order ────────────────────────────────────────────────
router.post('/create-order', protect, authorize('client'), async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));
    if (booking.payment.status === 'paid')
      return next(new AppError('This booking has already been paid.', 400));

    // Check Razorpay config before making the call
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      logger.error('Razorpay env vars missing: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set');
      return next(new AppError('Payment service is not configured. Please contact support.', 503));
    }

    const bookingAmount = booking.payment.amount || 499;

    let order;
    try {
      order = await razorpay.createOrder(bookingAmount, `Booking ${bookingId}`);
    } catch (razorpayErr) {
      // Log full error details for debugging
      logger.error(`Razorpay order creation failed for booking ${bookingId}:`, {
        message: razorpayErr.message,
        statusCode: razorpayErr.statusCode,
        error: razorpayErr.error,
      });
      const errMsg = razorpayErr?.error?.description || razorpayErr.message || 'Unknown error';
      return next(new AppError(`Payment provider error: ${errMsg}. Please try again.`, 503));
    }

    await Booking.findByIdAndUpdate(bookingId, { 'payment.razorpayOrderId': order.id });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) { next(err); }
});


// ─── POST /api/v1/payments/verify-payment ─────────────────────────────────────
// Called by mobile after Razorpay payment sheet succeeds.
// Verifies HMAC SHA256 signature, then marks booking paid & confirmed.
router.post('/verify-payment', protect, authorize('client'), async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return next(new AppError('Missing payment verification fields.', 400));
    }

    // ── 1. HMAC SHA256 signature verification ───────────────────────────────────
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return next(new AppError('Payment service is not configured.', 503));
    }
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      logger.warn(`Payment signature mismatch for booking ${bookingId}`, {
        userId: req.user._id,
        orderId: razorpay_order_id,
      });
      return next(new AppError('Payment verification failed. Invalid signature.', 400));
    }

    // ── 2. Confirm booking is owned by this client ─────────────────────────
    // Fetch booking and verify ownership in a single query
    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));

    // Check order ID — allow null/undefined on booking side (for race conditions on cold starts)
    // If it was saved, it must match. If null/undefined, trust the HMAC signature above.
    const savedOrderId = booking.payment?.razorpayOrderId;
    if (savedOrderId && savedOrderId !== razorpay_order_id) {
      logger.warn(`Order ID mismatch for booking ${bookingId}: saved=${savedOrderId}, incoming=${razorpay_order_id}`);
      return next(new AppError('Order ID mismatch. Please contact support.', 400));
    }

    // If already paid (duplicate webhook / retry), return success idempotently
    if (booking.payment.status === 'paid') {
      logger.info(`Booking ${bookingId} already paid — returning idempotent success`);
      return res.json({ success: true, message: 'Already paid.', data: { booking } });
    }

    // ── 3. Create Chat Room ───────────────────────────────────────────────
    let chatId = booking.chat;
    if (!chatId && booking.advocate) {
      const advocate = await Advocate.findById(booking.advocate);
      if (advocate) {
        const chat = await Chat.create({
          participants: [booking.client, advocate.user],
          booking: booking._id,
        });
        chatId = chat._id;
        booking.chat = chatId;
      }
    }

    // ── 4. Generate Zego tokens ───────────────────────────────────────────
    if (!booking.videoRoomId && booking.advocate) {
      try {
        const advocate = await Advocate.findById(booking.advocate);
        if (advocate) {
          const zegoResult = setupZegoCall({
            bookingId: booking._id.toString(),
            clientId:   req.user._id.toString(),
            advocateId: advocate.user.toString(),
          });
          if (zegoResult.success) {
            booking.videoRoomId        = zegoResult.roomId;
            booking.videoRoomToken     = zegoResult.clientToken;
            booking.advocateVideoToken = zegoResult.advocateToken;
            booking.zegoAppId          = zegoResult.appId;
          }
        }
      } catch (zegoErr) {
        logger.warn(`[Zego] Token gen failed for booking ${booking._id}: ${zegoErr.message}`);
      }
    }

    // ── 5. Mark booking as paid & confirmed ────────────────────
    booking.status = booking.advocate ? 'confirmed' : 'pending_assignment';
    if (!booking.advocate) booking.assignmentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    booking.payment.status           = 'paid';
    booking.payment.razorpayOrderId   = razorpay_order_id;
    booking.payment.razorpayPaymentId = razorpay_payment_id;
    booking.payment.razorpaySignature = razorpay_signature; // audit trail
    booking.payment.paidAt = new Date();

    // ── 6. Set sessionExpiresAt from admin Settings ────────────────
    // This controls when client's chat/voice/video access expires
    try {
      const settings = await Settings.findOne().lean();
      const mode = booking.consultationMode || 'chat'; // 'chat' | 'voice' | 'video'
      const durationHours = settings?.sessionDuration?.[mode] ?? (mode === 'chat' ? 24 : 1);
      booking.sessionExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      logger.info(`[Session] booking=${bookingId} mode=${mode} expires in ${durationHours}h at ${booking.sessionExpiresAt.toISOString()}`);
    } catch (settingsErr) {
      // Fallback: chat=24h, voice/video=1h
      const mode = booking.consultationMode || 'chat';
      const fallbackHours = mode === 'chat' ? 24 : 1;
      booking.sessionExpiresAt = new Date(Date.now() + fallbackHours * 60 * 60 * 1000);
      logger.warn(`[Session] Settings fetch failed, using fallback ${fallbackHours}h: ${settingsErr.message}`);
    }

    await booking.save();

    logger.info(`Payment verified: booking=${bookingId}, payment=${razorpay_payment_id}`);

    // ── 7. Socket emit — real-time update to both client & advocate ─────────
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      const socketPayload = {
        bookingId: booking._id.toString(),
        status:    booking.status,
        chatId:    booking.chat?.toString() || null,
        zegoRoomId: booking.videoRoomId    || null,
        sessionExpiresAt: booking.sessionExpiresAt?.toISOString() || null,
      };
      // Notify client
      io.to(`user:${booking.client.toString()}`).emit('payment_confirmed', socketPayload);
      // Notify advocate (if already assigned)
      if (booking.advocate) {
        const advocate = await Advocate.findById(booking.advocate).select('user').lean();
        if (advocate?.user) {
          io.to(`user:${advocate.user.toString()}`).emit('new_booking', {
            bookingId: booking._id.toString(),
            serviceType: booking.serviceType,
            consultationMode: booking.consultationMode,
          });
        }
      }
    } catch (socketErr) {
      logger.warn(`[Socket] payment_confirmed emit failed: ${socketErr.message}`);
    }

    // ── 8. Notifications ─────────────────────────────────────────────────────
    try {
      // Notify client
      await createNotification({
        recipientId: booking.client,
        title: '✅ Booking Confirmed!',
        message: `Your ${booking.serviceType?.replace(/_/g,' ') || 'consultation'} has been booked successfully. You can now chat with your advocate.`,
        type: 'booking',
        data: { bookingId: booking._id },
      });
      // Notify advocate if assigned
      if (booking.advocate) {
        const adv = await Advocate.findById(booking.advocate).select('user').lean();
        if (adv?.user) {
          await createNotification({
            recipientId: adv.user,
            title: '📋 New Consultation Request!',
            message: `You have a new paid ${booking.consultationMode || 'chat'} consultation booking. Check your dashboard.`,
            type: 'booking',
            data: { bookingId: booking._id },
          });
        }
      }
    } catch (notifErr) {
      logger.warn(`[Notif] Post-payment notification failed: ${notifErr.message}`);
    }

    // ── 9. Immediately credit advocate wallet (if advocate assigned) ─────────
    // Double-credit is prevented by earningTransactions.bookingId uniqueness guard
    if (booking.advocate && booking.payment.amount > 0 && !booking.walletCredited) {
      setImmediate(async () => {
        try {
          const { creditAdvocateWallet } = require('../controllers/walletController');
          const result = await creditAdvocateWallet({
            advocateId:    booking.advocate,
            bookingAmount: booking.payment.amount,
            bookingId:     booking._id,
          });
          if (result && !result.alreadyCredited) {
            await Booking.findByIdAndUpdate(booking._id, { walletCredited: true });
            logger.info(`[Wallet] Advocate credited ₹${result.advocateEarning} on payment for booking ${booking._id}`);
          }
        } catch (walletErr) {
          logger.error('[Wallet] Immediate credit failed:', walletErr.message);
        }
      });
    }

    res.json({
      success: true,
      message: 'Payment verified. Booking confirmed.',
      data: {
        booking,
        chatId:           booking.chat           || null,
        zegoRoomId:       booking.videoRoomId    || null,
        zegoToken:        booking.videoRoomToken || null,
        zegoAppId:        booking.zegoAppId      || 0,
        sessionExpiresAt: booking.sessionExpiresAt || null, // ← for countdown timer
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
