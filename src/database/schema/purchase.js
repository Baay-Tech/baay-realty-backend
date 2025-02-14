const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  ClientfirstName: {
    type: String,
    required: true,
  },
  ClientlastName: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },
  Clientphone: {
    type: String,
    required: true,
  },
  Clientemail: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property', // Reference to the Property model
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  proofOfPayment: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },
  referralName: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  referralPhone: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  referralEmail: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  propertyActualPrice: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  propertyName: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  paymentMethod: {
    type: String, // This can store a URL or file path to the proof of payment document/image
    required: true,
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
