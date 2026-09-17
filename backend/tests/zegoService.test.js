const crypto = require('crypto');

describe('ZEGOCLOUD Token04 generation', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...previousEnv };
  });

  test('creates the official framed AES-256-CBC token for the requested user', () => {
    process.env.ZEGO_APP_ID = '123456789';
    process.env.ZEGO_SERVER_SECRET = '12345678901234567890123456789012';
    delete process.env.ZEGO_ENABLE_ROOM_PRIVILEGE;
    const { generateZegoToken } = require('../src/services/zegoService');

    const token = generateZegoToken('user-42', 'room-42', 7200);
    expect(token.startsWith('04')).toBe(true);

    const framed = Buffer.from(token.slice(2), 'base64');
    const expires = Number(framed.readBigInt64BE(0));
    const ivLength = framed.readUInt16BE(8);
    const iv = framed.subarray(10, 10 + ivLength);
    const cipherLengthOffset = 10 + ivLength;
    const cipherLength = framed.readUInt16BE(cipherLengthOffset);
    const encrypted = framed.subarray(cipherLengthOffset + 2);

    expect(ivLength).toBe(16);
    expect(encrypted.length).toBe(cipherLength);

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ZEGO_SERVER_SECRET),
      iv
    );
    const body = JSON.parse(Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8'));

    expect(body.app_id).toBe(123456789);
    expect(body.user_id).toBe('user-42');
    expect(body.expire).toBe(expires);
    expect(body.expire - body.ctime).toBe(7200);
    expect(body.payload).toBe('');
  });

  test('rejects an incorrectly sized server secret', () => {
    process.env.ZEGO_APP_ID = '123456789';
    process.env.ZEGO_SERVER_SECRET = 'too-short';
    const { generateZegoToken } = require('../src/services/zegoService');
    expect(() => generateZegoToken('user-42', 'room-42')).toThrow('32 characters');
  });
});
