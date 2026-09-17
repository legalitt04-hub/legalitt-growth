require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const Advocate = require('./src/models/Advocate');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB to add 2nd Fake Case...');
    
    let client = await User.findOne({ role: 'client' });
    if (!client) {
      client = await User.create({
        name: 'Amit Vikram Malhotra',
        email: 'amit.malhotra.indore@gmail.com',
        phone: '9893011223',
        role: 'client'
      });
    }

    let advocate = await Advocate.findOne();

    const newCase = await Case.create({
      caseNumber: 'IND/2026/CB/' + Math.floor(1000 + Math.random() * 9000),
      title: 'Cheque Bounce Recovery (Sec 138) - Capital Logistics vs Synapse Tech',
      client: client._id,
      advocate: advocate ? advocate._id : client._id,
      status: 'active',
      courtName: 'District Court, Indore (Room No. 4)',
      description: 'Dishonour of cheque worth ₹4,50,000 issued towards commercial transport services. Statutory legal notice delivered, complaint filed under Section 138 of Negotiable Instruments Act.',
      notes: [{ note: 'Summons issued to accused director. Next evidence hearing scheduled for cross-examination.' }],
      timeline: [
        { title: 'Cognizance Taken', description: 'First hearing: Cognizance taken & summons issued', date: new Date('2026-07-15') },
        { title: 'Evidence Hearing', description: 'Evidence & accused statement recording', date: new Date('2026-08-28') }
      ]
    });

    console.log('✅ Second Fake Case Created Successfully!');
    console.log('Case ID:', newCase._id);
    console.log('Title:', newCase.title);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating fake case:', err);
    process.exit(1);
  });
