const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const otpCtrl = require('../controllers/otpController');
const { protect } = require('../middlewares/auth');
const { validateBody } = require('../middlewares/validate');
const Joi = require('joi');
const { requireFeature } = require('../middlewares/platformSettings');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#?!@$%^&*-]).{8,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (#?!@$%^&*-)',
    }),
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).optional(),
  barCouncilId: Joi.string().max(100).optional(),
  role: Joi.string().valid('client', 'advocate').optional(),
  registrationToken: Joi.string().required(),
});

const loginSchema = Joi.object({
  email: Joi.string().required(), // Relax email validation to allow mobile number logins if desired, but still validate Joi requirements
  password: Joi.string().required(),
});

// Standard auth
router.post('/register', validateBody(registerSchema), requireFeature('registrationsEnabled'), ctrl.register);
router.post('/login', validateBody(loginSchema), ctrl.login);
router.post('/google', requireFeature('googleEnabled'), ctrl.googleAuth);
router.post('/refresh', ctrl.refreshToken);         // standard
router.post('/refresh-token', ctrl.refreshToken);   // mobile app alias

router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.getMe);
router.get('/sessions', protect, ctrl.getSessions);
router.post('/fcm-token', protect, ctrl.updateFCMToken);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/verify-reset-otp', ctrl.verifyResetOTP);
router.post('/reset-password', ctrl.resetPassword);


// Phone OTP (Indian market — MSG91 + Email OTP)
// send-otp: legacy email OTP handler
router.post('/send-otp', requireFeature('registrationsEnabled'), otpCtrl.sendOTP);
// verify-otp: unified handler supporting phone + email OTP (with test OTP bypass)
router.post('/verify-otp', otpCtrl.verifyOTP);

module.exports = router;
