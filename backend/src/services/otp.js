const logger = require('../utils/logger');
const crypto = require('crypto');
const EmailOTP = require('../models/EmailOTP');

// 6-digit OTP for production security
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── Email sender: SMTP (primary) or Resend (fallback) ────────────────────────
const sendEmail = async ({ to, subject, text, html }) => {
  const sendTask = async () => {
    // 1️⃣ Try SMTP first (works for ALL email addresses, no domain needed)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const from = process.env.SMTP_FROM || '"Legalitt" <no-reply@legalitt.com>';
      const info = await transporter.sendMail({ from, to, subject, text, html });
      return { provider: 'smtp', id: info.messageId };
    }

    // 2️⃣ Fall back to Resend
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM || 'Legalitt <onboarding@resend.dev>';
      const result = await resend.emails.send({ from, to, subject, text, html });
      if (result.error) throw new Error(result.error.message);
      return { provider: 'resend', id: result.data?.id };
    }

    // 3️⃣ No email provider configured
    throw new Error('No email provider configured (SMTP_* or RESEND_API_KEY)');
  };

  return Promise.race([
    sendTask(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Email provider connection timed out')), 12000))
  ]);
};

/**
 * Send OTP via Email.
 */
const hashOTP = (email, otp) => crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(`${email}:${otp}`)
  .digest('hex');

exports.sendOTP = async (email, requestedRole = 'client') => {
  const otp = generateOTP(); // 6-digit now
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  const normalizedEmail = email.trim().toLowerCase();
  const role = requestedRole === 'advocate' ? 'advocate' : 'client';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;padding:32px;background:#f4f6f8;">
      <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#14B8A6,#0D9488);padding:28px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">⚖️ Legalitt</h1>
        </div>
        <div style="padding:36px;text-align:center;">
          <h2 style="color:#1F2937;font-size:20px;margin:0 0 8px;">Verification Code</h2>
          <p style="color:#6B7280;font-size:14px;margin:0 0 28px;">Use this code to verify your Legalitt account:</p>
          <div style="background:#F0FDFA;border:2px dashed #14B8A6;border-radius:16px;padding:24px;display:inline-block;">
            <span style="font-size:48px;font-weight:700;color:#0D9488;letter-spacing:12px;">${otp}</span>
          </div>
          <p style="color:#9CA3AF;font-size:13px;margin:24px 0 0;">Expires in <strong>10 minutes</strong>. Do not share this code.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const result = await sendEmail({
      to: normalizedEmail,
      subject: `${otp} is your Legalitt verification code`,
      text: `Your Legalitt OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`,
      html,
    });
    logger.info(`OTP sent via ${result.provider} to ${normalizedEmail}`);
    await EmailOTP.findOneAndUpdate(
      { email: normalizedEmail },
      { role, otpHash: hashOTP(normalizedEmail, otp), attempts: 0, expiresAt: new Date(expiresAt) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { success: true, emailSent: true };
  } catch (err) {
    logger.error(`Failed to send OTP to ${normalizedEmail}: ${err.message}`);
    // In development only, expose OTP so testing is not blocked
    if (process.env.NODE_ENV !== 'production') {
      await EmailOTP.findOneAndUpdate(
        { email: normalizedEmail },
        { role, otpHash: hashOTP(normalizedEmail, otp), attempts: 0, expiresAt: new Date(expiresAt) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      logger.info(`[DEV FALLBACK] OTP for ${normalizedEmail}: ${otp}`);
      return { success: true, fallback: true, dev: true, otp };
    }
    return { success: false, message: 'Failed to send OTP. Please try again.' };
  }
};

/**
 * Verify OTP entered by user.
 */
exports.verifyOTP = async (email, enteredOTP, requestedRole = 'client') => {
  const key = email.trim().toLowerCase();
  const role = requestedRole === 'advocate' ? 'advocate' : 'client';

  // Only allow master bypass in dev via DEV_MASTER_OTP env variable (not '1234' hardcoded)
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_MASTER_OTP && String(enteredOTP) === process.env.DEV_MASTER_OTP) {
    logger.info(`[DEV MASTER OTP] Accepted for ${key}`);
    return { success: true, role };
  }

  const stored = await EmailOTP.findOne({ email: key }).select('+otpHash');
  if (!stored) return { success: false, message: 'OTP expired or not found. Please request a new one.' };

  if (Date.now() > stored.expiresAt.getTime()) {
    await EmailOTP.deleteOne({ _id: stored._id });
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (stored.role !== role) {
    return { success: false, message: 'OTP role does not match this registration.' };
  }

  stored.attempts += 1;
  if (stored.attempts > 5) {
    await EmailOTP.deleteOne({ _id: stored._id });
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  const expected = Buffer.from(stored.otpHash, 'hex');
  const received = Buffer.from(hashOTP(key, String(enteredOTP)), 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    await stored.save();
    return { success: false, message: `Incorrect OTP. ${5 - stored.attempts} attempts remaining.` };
  }

  await EmailOTP.deleteOne({ _id: stored._id });
  return { success: true, role };
};
