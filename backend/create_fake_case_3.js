require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const Advocate = require('./src/models/Advocate');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB to add 3rd Fake Case...');
    
    let client = await User.findOne({ role: 'client' });
    if (!client) {
      client = await User.create({
        name: 'Sunil Kumar Sharma',
        email: 'sunil.sharma.indore@gmail.com',
        phone: '9826012345',
        role: 'client'
      });
    }

    let advocate = await Advocate.findOne();

    const newCase = await Case.create({
      caseNumber: 'MP/HC/IND/' + Math.floor(1000 + Math.random() * 9000),
      title: 'Ancestral Property Partition & Permanent Injunction - Sharma Estate',
      client: client._id,
      advocate: advocate ? advocate._id : client._id,
      status: 'active',
      courtName: 'High Court of MP, Bench Indore (Court Hall No. 3)',
      description: 'Civil suit for declaration of title, partition of ancestral 12,000 sq ft commercial land in Vijay Nagar Indore, and permanent injunction against unauthorized construction.',
      notes: [
        { note: 'Ad-interim status quo order maintained by Honble High Court. Defendant filed counter claim.' }
      ],
      timeline: [
        { title: 'Injunction Granted', description: 'Ad-interim stay order granted preventing property sale', date: new Date('2026-06-10') },
        { title: 'Issues Framing', description: 'Framing of legal issues & admission of documents', date: new Date('2026-09-12') }
      ]
    });

    console.log('✅ Third Fake Case Created Successfully!');
    console.log('Case ID:', newCase._id);
    console.log('Case Number:', newCase.caseNumber);
    console.log('Title:', newCase.title);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating 3rd fake case:', err);
    process.exit(1);
  });
