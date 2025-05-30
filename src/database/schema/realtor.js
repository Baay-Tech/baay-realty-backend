const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const RealtorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  upline: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  Clientreferrals: [
    {
      name: { type: String },
      phone: { type: String },
      email: { type: String }
    }
  ],
  Realtorreferrals: [
    {
      username: { type: String },
      phone: { type: String },
      email: { type: String }
    }
  ],
  referrerIdNumber: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true },
  address: { type: String, },
  country: { type: String, },
  state: { type: String,  },
  accountName: { type: String, },
  accountNumber: { type: String,  },
  bank: { type: String, },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  profileimage: { type: String },
  balance: { type: Number, default: 0 }, // Changed to Number for calculations
  funding: { type: Number, default: 0 }, // Changed to Number for calculations
  directCommission: [
    {
      amount: { type: Number },
      purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
      date: { type: Date, default: Date.now }
    }
  ],
  indirectCommission: [
    {
      amount: { type: Number },
      purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
      date: { type: Date, default: Date.now }
    }
  ],
  otp: { type: String },
  otpExpires: { type: Date },
});

// Middleware to update balance whenever funding, directCommission, or indirectCommission changes
RealtorSchema.pre('save', function (next) {
  const totalDirectCommission = this.directCommission.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIndirectCommission = this.indirectCommission.reduce((acc, curr) => acc + curr.amount, 0);
  this.balance = totalDirectCommission + totalIndirectCommission;
  next();
});

module.exports = mongoose.model('realtorUser', RealtorSchema);