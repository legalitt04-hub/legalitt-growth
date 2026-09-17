require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB to add Fake Consultation Request...');

    let client = await User.findOne({ role: 'client' });
    if (!client) {
      client = await User.create({
        name: 'Pooja Verma',
        email: 'pooja.verma.indore@gmail.com',
        phone: '9876543210',
        role: 'client'
      });
    }

    const newBooking = await Booking.create({
      client: client._id,
      serviceType: 'legal_advice',
      consultationMode: 'chat',
      status: 'pending_assignment',
      issue: 'Tenant eviction dispute in Palasia Indore. Tenant refusing to vacate premises despite 3 months lease expiry and notice.',
      clientCity: 'Indore',
      clientState: 'Madhya Pradesh',
      payment: {
        amount: 499,
        status: 'paid',
        paidAt: new Date(),
        razorpayPaymentId: 'pay_mock_' + Math.floor(100000 + Math.random() * 900000)
      },
      assignmentDeadline: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours remaining SLA
      documents: ['https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf']
    });

    console.log('✅ Fake Consultation Request Created Successfully!');
    console.log('Booking ID:', newBooking._id);
    console.log('Client City:', newBooking.clientCity);
    console.log('Issue:', newBooking.issue);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating fake consultation request:', err);
    process.exit(1);
  });
