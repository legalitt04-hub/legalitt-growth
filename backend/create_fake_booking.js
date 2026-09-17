require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB for fake booking generation');
    
    // Find a client
    const client = await User.findOne({ role: 'client' });
    if (!client) {
      console.log('No client found!');
      process.exit(1);
    }

    const fakeBooking = new Booking({
      client: client._id,
      consultationMode: 'video',
      serviceType: 'legal_advice',
      issue: 'I need legal advice regarding a tenant who refuses to vacate my property despite the lease agreement expiring 3 months ago. Need to understand the eviction process.',
      status: 'pending_assignment', // This makes it show up in "Needs Assignment"
      clientCity: 'Delhi',
      payment: {
        amount: 499,
        status: 'paid', // Show as paid so admin knows they need to assign an advocate
      },
    });

    await fakeBooking.save();
    console.log('Fake booking created successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
