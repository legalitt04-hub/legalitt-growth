const otpService = require('../services/otp');
const User = require('../models/User');
const { AppError } = require('../middlewares/errorHandler');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// POST /api/auth/send-otp
exports.sendOTP = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    if (!email) return next(new AppError('Email address is required.', 400));

    const result = await otpService.sendOTP(email, role);
    if (!result.success) return next(new AppError(result.message || 'Failed to send OTP.', 500));

    const response = { success: true, message: 'OTP sent successfully.' };
    if (result.dev) response.otp = result.otp; // Expose in dev only

    res.json(response);
  } catch (err) { next(err); }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp, name, role } = req.body;
    if (!email || !otp) return next(new AppError('Email and OTP are required.', 400));

    const result = await otpService.verifyOTP(email, otp, role);
    if (!result.success) return next(new AppError(result.message, 400));

    const safeRole = ['client', 'advocate'].includes(role) ? role : 'client';

    // Find or create user by email
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const registrationToken = jwt.sign(
        { purpose: 'registration', email: email.trim().toLowerCase(), role: safeRole },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({
        success: true,
        message: 'OTP verified successfully. Please proceed to complete registration.',
        registrationToken,
      });
    }

    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    // Issue tokens
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });

    res.json({
      success: true,
      data: { user: user.toSafeObject(), accessToken, refreshToken },
    });
  } catch (err) { next(err); }
};
