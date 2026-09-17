require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const User = require('./src/models/User');
const Advocate = require('./src/models/Advocate');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB to create 2nd Pending Advocate...');

    const email = 'advocate.ananya.indore@legalitt.com';
    await User.deleteOne({ email });
    await Advocate.deleteMany({ 'user.email': email });

    const user = await User.create({
      name: 'Adv. Ananya Deshmukh',
      email,
      phone: '9827099887',
      password: 'Password123!',
      role: 'advocate',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      address: {
        street: 'A-14 Commercial Complex, Vijay Nagar',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452010'
      }
    });

    const advocate = await Advocate.create({
      user: user._id,
      barCouncilNumber: 'MP/91204/2024',
      specializations: ['Corporate Law', 'Cyber Law', 'Intellectual Property'],
      experience: 6,
      consultationFee: 1200,
      verificationStatus: 'pending',
      isVerified: false,
      rating: { average: 5.0, count: 8 },
      location: {
        type: 'Point',
        coordinates: [75.8937, 22.7533], // Vijay Nagar Indore
        address: {
          street: 'A-14 Commercial Complex, Vijay Nagar',
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452010'
        }
      },
      documents: {
        barCouncilCertificate: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        degreeDocument: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        idProof: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    });

    console.log('✅ Second Pending Advocate Created Successfully!');
    console.log('User ID:', user._id);
    console.log('Advocate ID:', advocate._id);
    console.log('Name:', user.name);
    console.log('Bar Council No:', advocate.barCouncilNumber);
    console.log('Status:', advocate.verificationStatus);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating pending advocate:', err);
    process.exit(1);
  });
