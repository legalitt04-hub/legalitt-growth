// src/services/zegoService.js
// ZEGOCLOUD Video/Voice/Chat Token Generation
// Docs: https://docs.zegocloud.com/article/15070
// Free tier: 10,000 participant-minutes/month

const crypto = require('crypto');
const logger = require('../utils/logger');

const ZEGO_APP_ID  = parseInt(process.env.ZEGO_APP_ID  || '0', 10);
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET || '';

/**
 * Generate ZEGOCLOUD Token04 (server-side token for secure auth).
 * Format required by ZEGO:
 *   "04" + base64(expire:int64be + ivLength:uint16be + iv + cipherLength:uint16be + cipher)
 * The JSON body is encrypted with AES-256-CBC using the full 32-byte ServerSecret.
 */
const generateZegoToken = (userId, roomId, expirySeconds = 7200) => {
  if (!ZEGO_APP_ID) {
    throw new Error('ZEGO_APP_ID is not configured.');
  }
  if (!ZEGO_SERVER_SECRET || ZEGO_SERVER_SECRET.length < 32) {
    throw new Error('ZEGO_SERVER_SECRET must be 32 characters. Get it from ZEGOCLOUD console.');
  }

  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + expirySeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  const permissionPayload = process.env.ZEGO_ENABLE_ROOM_PRIVILEGE === 'true'
    ? JSON.stringify({
        room_id: String(roomId || ''),
        privilege: { 1: 1, 2: 1 },
        stream_id_list: [],
      })
    : '';
  const body = JSON.stringify({
    app_id:  ZEGO_APP_ID,
    user_id: String(userId),
    nonce,
    ctime:   createTime,
    expire:  expireTime,
    payload: permissionPayload,
  });

  try {
    const key = Buffer.from(ZEGO_SERVER_SECRET, 'utf8');
    if (key.length !== 32) throw new Error('ZEGO_SERVER_SECRET must be exactly 32 bytes.');
    const iv  = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
    if (encrypted.length > 0xffff) throw new Error('ZEGO token payload is too large.');

    const expireBuffer = Buffer.alloc(8);
    expireBuffer.writeBigInt64BE(BigInt(expireTime));
    const ivLength = Buffer.alloc(2);
    ivLength.writeUInt16BE(iv.length);
    const cipherLength = Buffer.alloc(2);
    cipherLength.writeUInt16BE(encrypted.length);
    const token = '04' + Buffer.concat([
      expireBuffer,
      ivLength,
      iv,
      cipherLength,
      encrypted,
    ]).toString('base64');
    return token;
  } catch (err) {
    logger.error('[ZEGO] Token generation failed:', err.message);
    throw err;
  }
};

/**
 * Setup ZEGOCLOUD call credentials for a booking.
 * Returns roomID, userID tokens for both client and advocate.
 * Called when admin assigns an advocate.
 */
const setupZegoCall = ({ bookingId, clientId, advocateId }) => {
  if (!ZEGO_APP_ID) {
    return { success: false, error: 'ZEGO_APP_ID is not configured.' };
  }

  try {
    const roomId = `legalitt-${bookingId}`;

    const clientToken   = generateZegoToken(String(clientId),   roomId, 7200); // 2h
    const advocateToken = generateZegoToken(String(advocateId), roomId, 7200);

    logger.info(`[ZEGO] Tokens generated for room: ${roomId}`);
    return {
      success: true,
      roomId,
      appId: ZEGO_APP_ID,
      clientToken,
      advocateToken,
    };
  } catch (err) {
    logger.error('[ZEGO] setupZegoCall failed:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { setupZegoCall, generateZegoToken };
