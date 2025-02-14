const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  type: { type: String, enum: ['direct', 'indirect'], required: true },
  amount: { type: Number, required: true },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
  consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultUser', required: true },
  clientDetails: {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    phone: { type: String }
  },
  propertyDetails: {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    propertyName: { type: String },
    amountPaid: { type: Number }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Commission', CommissionSchema);