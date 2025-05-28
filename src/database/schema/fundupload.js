const mongoose = require("mongoose");

const FundSchema = new mongoose.Schema({
  // Realtor who submitted the payment
  realtor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "realtorUser",
    required: true
  },
  // Client for whom the payment was made
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },
  // Property being purchased
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true
  },
  // Payment details
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    enum: ["NGN", "USD", "EUR", "GBP", "CAD"]
  },
  currencySymbol: {
    type: String,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  proofImage: {
    type: String,
    required: true
  },
  // Status tracking
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  // Additional metadata
  notes: {
    type: String,
    default: ""
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Admin who processed the payment
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  processingDate: {
    type: Date
  }
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Add text index for search functionality
FundSchema.index({
  'realtor': 'text',
  'client': 'text',
  'property': 'text',
  'status': 'text'
});

module.exports = mongoose.model("Fund", FundSchema);