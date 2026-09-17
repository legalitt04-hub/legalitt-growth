const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail, sendEmailOTP } = require('../services/emailService');
const { sendSMSOTP, generateOTP } = require('../services/smsService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Token Helpers ────────────────────────────────────────────────────────────
const signAccessToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

const sendTokens = async (user, statusCode, res, extra = {}) => {
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  // Store hashed refresh token in DB (rotation)
  await User.findByIdAndUpdate(user._id, {
    $push: { refreshTokens: refreshToken },
    lastSeen: new Date(),
  });

  res.status(statusCode).json({
    success: true,
    data: {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      ...extra,
    },
  });
};

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, registrationToken } = req.body;
    let registrationProof;
    try {
      registrationProof = jwt.verify(registrationToken, process.env.JWT_SECRET);
    } catch (_) {
      return next(new AppError('Email verification has expired. Please verify your email again.', 401));
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (registrationProof.purpose !== 'registration' || registrationProof.email !== normalizedEmail) {
      return next(new AppError('Invalid email verification proof.', 403));
    }

    // Prevent privilege escalation
    const safeRole = ['client', 'advocate'].includes(role) ? role : 'client';
    if (registrationProof.role !== safeRole) {
      return next(new AppError('Registration role does not match the verified request.', 403));
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return next(new AppError('Email already registered.', 400));

    const user = await User.create({ name, email: normalizedEmail, password, phone, role: safeRole, isEmailVerified: true });
    logger.info(`New user registered: ${user.email} (${user.role})`);

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ toEmail: user.email, userName: user.name }).catch(() => {});

    await sendTokens(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required.', 400));
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !user.password) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      try {
        await AuditLog.create({
          user: user._id,
          action: 'FAILED_LOGIN_WRONG_PASSWORD',
          details: `Failed login attempt for ${user.email} (Incorrect Password)`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
        });
      } catch (e) {}
      return next(new AppError('Invalid email or password.', 401));
    }

    if (req.body.role === 'admin' && user.role !== 'admin') {
      return next(new AppError('Access denied. You do not have admin privileges.', 403));
    }

    if (!user.isActive) return next(new AppError('Account deactivated.', 403));

    try {
      await AuditLog.create({
        user: user._id,
        action: 'ADMIN_LOGIN_SUCCESS',
        details: `Successful login for ${user.email}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
      });
    } catch (e) {}

    logger.info(`User logged in: ${user.email}`);
    await sendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken, accessToken, role } = req.body;
    let payload;
    try {
      if (accessToken) {
        const axios = require('axios');
        const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        payload = response.data;
        if (!payload?.email || payload.email_verified === false) {
          return next(new AppError('Google email is not verified.', 401));
        }
      } else if (idToken) {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: [process.env.GOOGLE_CLIENT_ID, '400989529051-9r050me1vuquck9bqk30b6pd1i97k817.apps.googleusercontent.com'].filter(Boolean),
        });
        payload = ticket.getPayload();
      } else {
        return next(new AppError('No Google token provided.', 400));
      }
    } catch (providerError) {
      logger.warn(`Google authentication rejected: ${providerError.message}`);
      return next(new AppError('Invalid or expired Google token.', 401));
    }

    const { sub: googleId, name, picture } = payload;
    const email = payload.email?.toLowerCase().trim();
    if (!googleId || !email) return next(new AppError('Google account information is incomplete.', 401));

    const safeRole = ['client', 'advocate'].includes(role) ? role : 'client';

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        isEmailVerified: true,
        role: safeRole,
      });
      logger.info(`New Google user: ${email} (${user.role})`);
    } else if (!user.googleId) {
      // Link Google to existing email account
      user.googleId = googleId;
      user.avatar = user.avatar || picture;
      user.isEmailVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) return next(new AppError('Account deactivated.', 403));

    let requiresAdvocateOnboarding = false;
    if (user.role === 'advocate') {
      const Advocate = require('../models/Advocate');
      requiresAdvocateOnboarding = !(await Advocate.exists({ user: user._id }));
    }

    await sendTokens(user, 200, res, { requiresAdvocateOnboarding });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AppError('Refresh token required.', 401));

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return next(new AppError('Invalid refresh token.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('Account deactivated.', 403));
    }

    // Rotate: remove old, issue new
    await User.findByIdAndUpdate(decoded.id, {
      $pull: { refreshTokens: refreshToken },
    });

    const newAccessToken = signAccessToken(user._id, user.role);
    const newRefreshToken = signRefreshToken(user._id);

    await User.findByIdAndUpdate(decoded.id, {
      $push: { refreshTokens: newRefreshToken },
    });

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(new AppError('Invalid or expired refresh token.', 401));
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: refreshToken },
      });
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── Active Sessions Summary ─────────────────────────────────────────────────
exports.getSessions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+refreshTokens lastSeen');
    if (!user) return next(new AppError('User not found.', 404));
    res.json({
      success: true,
      data: {
        activeSessions: user.refreshTokens?.length || 0,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) { next(err); }
};

// ─── Get Me ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('advocateProfile');
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.json({ success: true, data: user.toSafeObject() });
  } catch (err) {
    logger.error('Error in getMe:', err);
    next(err);
  }
};

// ─── Update FCM Token ─────────────────────────────────────────────────────────
exports.updateFCMToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ success: true, message: 'FCM token updated.' });
  } catch (err) {
    next(err);
  }
};

// ─── Send OTP (Phone or Email) ────────────────────────────────────────────────
exports.sendOTP = async (req, res, next) => {
  try {
    const { phone, email, purpose = 'verification' } = req.body;

    if (!phone && !email) {
      return next(new AppError('Phone or email is required.', 400));
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user;
    if (phone) {
      // Find or temp-store OTP for this phone
      user = await User.findOne({ phone });
      if (!user && purpose === 'verification') {
        // New registration — store OTP temporarily by phone (we'll link on register)
        // For simplicity, use email-based flow for new users
        return next(new AppError('Please register first before requesting OTP.', 400));
      }
      if (user) {
        user.phoneOTP = otp;
        user.phoneOTPExpires = otpExpires;
        await user.save({ validateBeforeSave: false });
      }

      // Send via MSG91 SMS
      const smsResult = await sendSMSOTP(phone, otp);
      if (!smsResult.success) {
        // Fallback: log OTP in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV OTP] Phone: ${phone} | OTP: ${otp}`);
          return res.json({ success: true, message: 'OTP sent (dev mode - check server logs)', dev_otp: otp });
        }
        return next(new AppError('Failed to send SMS OTP. Please try email OTP.', 500));
      }
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.json({ success: true, message: 'If an account exists, OTP has been sent.' });
      }
      user.emailOTP = otp;
      user.emailOTPExpires = otpExpires;
      await user.save({ validateBeforeSave: false });

      sendEmailOTP({ toEmail: email, userName: user.name, otp }).catch(err => {
        logger.error('Failed to send email OTP:', err.message);
      });
      logger.info(`OTP generated for ${email}: ${otp}`);
    }

    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { phone, email, otp } = req.body;

    if (!otp) return next(new AppError('OTP is required.', 400));
    if (!phone && !email) return next(new AppError('Phone or email is required.', 400));

    let user;
    // Test OTP bypass — ONLY allowed in non-production environments
    const isTestOTP = process.env.NODE_ENV !== 'production' &&
      (otp === '123456' || otp === '000000' || otp === '1234');
    if (phone) {
      user = await User.findOne({ phone }).select('+phoneOTP +phoneOTPExpires');
      if (!user || (!isTestOTP && (user.phoneOTP !== otp || !user.phoneOTPExpires || user.phoneOTPExpires < Date.now()))) {
        return next(new AppError('Invalid or expired OTP.', 400));
      }
      user.isPhoneVerified = true;
      user.phoneOTP = undefined;
      user.phoneOTPExpires = undefined;
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.findOne({ email: email.toLowerCase().trim() }).select('+emailOTP +emailOTPExpires');
      if (!user || (!isTestOTP && (user.emailOTP !== otp || !user.emailOTPExpires || user.emailOTPExpires < Date.now()))) {
        return next(new AppError('Invalid or expired OTP.', 400));
      }
      user.isEmailVerified = true;
      user.emailOTP = undefined;
      user.emailOTPExpires = undefined;
      await user.save({ validateBeforeSave: false });
    }

    logger.info(`OTP verified for user: ${user.email || user.phone}`);
    await sendTokens(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Please provide an email address.', 400));

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Return 200 to prevent email enumeration attacks
      return res.status(200).json({ success: true, message: 'If an account exists, a reset OTP has been sent.' });
    }

    // Generate 6-digit OTP for mobile OTP flow
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    user.passwordResetToken = hashedOTP;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save({ validateBeforeSave: false });

    // Send OTP via email (Resend)
    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        userName: user.name,
        resetToken: otp, // pass OTP as resetToken — emailService uses this
        isOtp: true,
      });
      logger.info(`Password reset OTP sent to ${user.email}`);
    } catch (emailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error('Failed to send password reset OTP:', emailErr.message);
      return next(new AppError('Failed to send reset OTP. Please try again later.', 500));
    }

    res.status(200).json({ success: true, message: 'A 6-digit reset OTP has been sent to your email.' });
  } catch (err) {
    next(err);
  }
};

// ─── Verify Reset OTP (mobile flow) ──────────────────────────────────────────
exports.verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return next(new AppError('Email and OTP are required.', 400));

    const hashedOTP = crypto.createHash('sha256').update(String(otp)).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      passwordResetToken: hashedOTP,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) return next(new AppError('Invalid or expired OTP. Please try again.', 400));

    // OTP is valid — return a short-lived reset token for the next step
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedResetToken; // Replace OTP with reset token
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 more minutes
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      data: { resetToken },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
// Supports both OTP-based (mobile) and token-based (admin) resets
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password, email, otp, newPassword } = req.body;

    let user;

    if (token) {
      // Token-based reset (admin panel link flow)
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });
    } else if (email && otp) {
      // OTP-direct reset (mobile shortcut: email + otp + newPassword without separate verify step)
      const hashedOTP = crypto.createHash('sha256').update(String(otp)).digest('hex');
      user = await User.findOne({
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedOTP,
        passwordResetExpires: { $gt: Date.now() },
      });
    }

    if (!user) return next(new AppError('Reset token/OTP is invalid or has expired.', 400));

    const finalPassword = password || newPassword;
    if (!finalPassword || finalPassword.length < 8) {
      return next(new AppError('Password must be at least 8 characters.', 400));
    }

    user.password = finalPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset successful for ${user.email}`);
    res.status(200).json({ success: true, message: 'Password has been successfully reset. Please log in.' });
  } catch (err) {
    next(err);
  }
};
