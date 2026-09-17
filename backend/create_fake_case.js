require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const Advocate = require('./src/models/Advocate');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB for fake case generation');
    
    // Find a client
    const client = await User.findOne({ role: 'client' });
    if (!client) {
      console.log('No client found!');
      process.exit(1);
    }

    // Find an advocate
    const advocate = await Advocate.findOne();
    if (!advocate) {
      console.log('No advocate found!');
      process.exit(1);
    }

    const fakeCase = new Case({
      title: "Property Dispute Resolution - Verma Family",
      description: "A long standing dispute regarding ancestral property division between siblings.",
      caseNumber: "PRP-2026-0801",
      courtName: "High Court of Mumbai",
      client: client._id,
      advocate: advocate._id,
      status: "active",
      timeline: [
        {
          title: "Initial Hearing",
          description: "First hearing to present preliminary arguments.",
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          status: "completed"
        },
        {
          title: "Evidence Submission",
          description: "Submission of property deeds and wills.",
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days later
          status: "scheduled"
        }
      ],
      notes: [
        { note: "Client has provided all required documents." }
      ]
    });

    await fakeCase.save();
    console.log('Fake case created successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
