require('dotenv').config();
const mongoose = require('mongoose');
const adminController = require('./src/controllers/adminController');

const mockReq = {
  file: {
    originalname: 'advocates_sample.csv',
    path: '../advocates_sample.csv'
  }
};
const mockRes = {
  status: function(s) { this.statusCode = s; return this; },
  json: function(j) { console.log('Response:', this.statusCode, j); }
};

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'legalitt' });
  // Actually, I can mock User and Advocate
}
run();
