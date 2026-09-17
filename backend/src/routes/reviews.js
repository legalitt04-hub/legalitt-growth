const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

router.get('/', async (req, res, next) => {
  try {
    const { advocateId, page = 1, limit = 10 } = req.query;
    const filter = advocateId ? { advocate: advocateId } : {};
    const reviews = await Review.find(filter)
      .populate('client', 'name avatar')
      .populate('booking', 'type issue')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit)).lean();
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

router.post('/', protect, authorize('client'), async (req, res, next) => {
  try {
    let { bookingId, rating, comment } = req.body;
    
    if (!bookingId) return next(new AppError('A completed booking is required to submit a review.', 400));

    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));
    if (booking.client.toString() !== req.user._id.toString())
      return next(new AppError('Not authorized.', 403));
    if (booking.status !== 'completed')
      return next(new AppError('Can only review completed bookings.', 400));

    const review = await Review.create({
      client: req.user._id,
      advocate: booking.advocate,
      booking: bookingId,
      rating,
      comment,
    });
    res.status(201).json({ success: true, data: review });
  } catch (err) { next(err); }
});

module.exports = router;
