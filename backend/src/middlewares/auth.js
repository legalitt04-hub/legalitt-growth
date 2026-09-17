const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');
const { getPlatformSettings } = require('./platformSettings');

// Verify access token
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query?.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(new AppError('Not authenticated. Please log in.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('This account has been deactivated.', 403));
    }
    if (user.passwordChangedAfter?.(decoded.iat)) {
      return next(new AppError('Password was changed. Please log in again.', 401));
    }

    req.user = user;
    const adminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
    if (!adminRoles.includes(user.role)) {
      const settings = await getPlatformSettings();
      if (settings.maintenanceMode) return next(new AppError('Legalitt is temporarily under maintenance. Please try again shortly.', 503));
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    next(err);
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

// Optional auth (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshTokens');
      if (user && user.isActive) req.user = user;
    }
  } catch (err) {
    // Silently ignore auth errors for optional auth
    logger.debug('Optional auth failed silently:', err.message);
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
