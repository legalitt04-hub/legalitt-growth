require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const User = require('./src/models/User');
const Advocate = require('./src/models/Advocate');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB for creating pending advocate...');
    
    // Check if test user already exists
    const email = 'advocate.rajesh.indore@legalitt.com';
    await User.deleteMany({ email });
    await Advocate.deleteMany({ barCouncilNumber: 'MP/88492/2023' });

    // Step 1: Create Advocate User
    const user = await User.create({
      name: 'Adv. Rajesh Sharma',
      email: email,
      password: 'Password123!',
      phone: '9826098260',
      role: 'advocate',
      isVerified: false,
      isEmailVerified: true,
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
    });

    // Step 2: Create Advocate Profile
    const advocate = await Advocate.create({
      user: user._id,
      barCouncilNumber: 'MP/88492/2023',
      specializations: ['Property Law', 'Civil Law', 'Criminal Law'],
      experience: 8,
      consultationFee: 999,
      followUpFee: 499,
      location: {
        type: 'Point',
        coordinates: [75.8577, 22.7196],
        address: {
          street: 'MG Road, Regal Circle',
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001'
        }
      },
      about: 'Senior Advocate practicing at MP High Court Indore Bench. Specialized in Property Disputes, Civil Writs, and Land Verification.',
      education: [{ degree: 'LL.M (Civil)', institution: 'Devi Ahilya Vishwavidyalaya, Indore', year: 2016 }],
      languages: ['Hindi', 'English'],
      documents: {
        barCouncilCertificate: 'https://res.cloudinary.com/demo/image/upload/v1570979139/sample.jpg',
        degreeDocument: 'https://res.cloudinary.com/demo/image/upload/v1570979139/sample.jpg',
        idProof: 'https://res.cloudinary.com/demo/image/upload/v1570979139/sample.jpg'
      },
      isVerified: false,
      verificationStatus: 'pending'
    });

    console.log('✅ Pending Advocate Request created successfully!');
    console.log('Advocate ID:', advocate._id);
    console.log('User Email:', user.email);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating pending advocate:', err);
    process.exit(1);
  });
