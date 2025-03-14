const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of Birth is required'],
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required'],
  },
  passportPhoto: {
    type: String,
    required: [true, 'Passport Photo is required'],
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'Nigeria',
    },
    zipCode: String,
  },
  nextOfKin: {
    name: String,
    relationship: String,
    email: String,
    phone: String,
  },
  
  work: {
    name: String,
    address: String,
  },
  
  upline: {
    name: { type: String },
    phone: { type: String },
    email: { type: String },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Client', ClientSchema);