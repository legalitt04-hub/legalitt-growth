const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middlewares/auth');
const razorpay = require('../services/razorpay');
const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const { Chat } = require('../models/Chat');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { setupZegoCall } = require('../services/zegoService');
const { createNotification } = require('../utils/notificationHelper');

// ─── POST /api/v1/payments/create-order ──────────────────────────────────────
router.post('/create-order', protect, authorize('client'), async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));
    if (booking.payment.status === 'paid')
      return next(new AppError('This booking has already been paid.', 400));

    const amountInPaise = Math.round((booking.payment.amount || 499) * 100);

    // If Razorpay keys not configured in environment
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      const mockOrderId = `order_mock_${Date.now()}`;
      await Booking.findByIdAndUpdate(bookingId, { 'payment.razorpayOrderId': mockOrderId });
      return res.json({
        success: true,
        data: {
          orderId: mockOrderId,
          amount: amountInPaise,
          currency: 'INR',
          keyId: 'rzp_test_SeC9MGzYmAerqz',
        },
      });
    }

    let order;
    try {
      order = await razorpay.createOrder(booking.payment.amount || 499, `Booking ${bookingId}`);
    } catch (razorpayErr) {
      logger.warn(`Razorpay API call failed, using fallback order for booking ${bookingId}: ${razorpayErr.message}`);
      const mockOrderId = `order_mock_${Date.now()}`;
      await Booking.findByIdAndUpdate(bookingId, { 'payment.razorpayOrderId': mockOrderId });
      return res.json({
        success: true,
        data: {
          orderId: mockOrderId,
          amount: amountInPaise,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_SeC9MGzYmAerqz',
        },
      });
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
    const isDevMode = process.env.NODE_ENV !== 'production';
    const isDevBypass = isDevMode && (razorpay_signature === 'dev_bypass' || razorpay_order_id?.startsWith('order_mock'));

    if (!isDevBypass) {
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
    } else {
      logger.info(`[DEV] Payment signature bypass for booking ${bookingId}`);
    }

    // ── 2. Confirm booking is owned by this client ───────────────────────────
    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));
    if (!isDevBypass && booking.payment.razorpayOrderId !== razorpay_order_id)
      return next(new AppError('Order ID mismatch.', 400));
    if (booking.payment.status === 'paid')
      return res.json({ success: true, message: 'Already paid.', data: { booking } });

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

    // ── 5. Mark booking as paid & confirmed ────────────────────────────
    booking.status = 'confirmed';
    booking.payment.status = 'paid';
    booking.payment.razorpayOrderId   = razorpay_order_id;
    booking.payment.razorpayPaymentId = razorpay_payment_id;
    booking.payment.paidAt = new Date();
    await booking.save();

    logger.info(`Payment verified: booking=${bookingId}, payment=${razorpay_payment_id}`);

    res.json({
      success: true,
      message: 'Payment verified. Booking confirmed.',
      data: {
        booking,
        chatId:      booking.chat   || null,
        zegoRoomId:  booking.videoRoomId    || null,
        zegoToken:   booking.videoRoomToken || null,
        zegoAppId:   booking.zegoAppId      || 0,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;

