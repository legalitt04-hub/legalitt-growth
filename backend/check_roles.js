require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected');
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({ role: { $nin: ['client', 'advocate'] } }).toArray();
    console.log(users.map(u => ({ email: u.email, role: u.role, name: u.name })));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
