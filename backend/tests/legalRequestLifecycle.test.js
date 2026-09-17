jest.mock('../src/models/Booking', () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/ServicePricing', () => ({ findOne: jest.fn(() => ({ lean: async () => ({ basePrice: 1199 }) })) }));
jest.mock('../src/utils/notificationHelper', () => ({ createNotification: jest.fn() }));
const Booking = require('../src/models/Booking');
const { createNotification } = require('../src/utils/notificationHelper');
const ctrl = require('../src/controllers/legalAdviceController');
const crypto = require('crypto');
const response = () => { const res = { json: jest.fn() }; res.status = jest.fn(() => res); return res; };
const request = body => ({ body, user: { _id: 'client', email: 'client@example.com' }, app: { get: jest.fn() } });
beforeEach(() => jest.clearAllMocks());
test('unpaid checkout stays a draft without notifications', async () => {
  Booking.create.mockImplementation(async data => ({ ...data, _id: 'booking' }));
  const next = jest.fn();
  await ctrl.createLegalRequest(request({ consultationMode: 'video', serviceType: 'legal_advice', issueDescription: 'A valid legal concern' }), response(), next);
  expect(next).not.toHaveBeenCalled();
  expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_payment', assignmentDeadline: null }));
  expect(createNotification).not.toHaveBeenCalled();
});
test.each([false, true])('only valid payment activates assignment: %s', async valid => {
  process.env.RAZORPAY_KEY_SECRET = 'test-only-secret';
  const booking = { _id: 'booking', client: 'client', payment: { status: 'pending', amount: 1199, razorpayOrderId: 'order' }, save: jest.fn() };
  Booking.findById.mockResolvedValue(booking);
  const signature = valid ? crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order|payment').digest('hex') : 'invalid';
  const next = jest.fn();
  await ctrl.confirmLegalPayment(request({ bookingId: 'booking', razorpayOrderId: 'order', razorpayPaymentId: 'payment', razorpaySignature: signature }), response(), next);
  if (valid) { expect(next).not.toHaveBeenCalled(); expect(booking.status).toBe('pending_assignment'); expect(booking.payment.status).toBe('paid'); expect(booking.assignmentDeadline).toBeInstanceOf(Date); }
  else { expect(next).toHaveBeenCalled(); expect(booking.save).not.toHaveBeenCalled(); }
});
