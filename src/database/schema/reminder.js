const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
  },
  Clientemail: {
    type: String,
    required: true,
  },
  propertyName: {
    type: String,
    required: true,
  },
  propertyActualPrice: {
    type: Number,
    required: true,
  },
  reminders: [
    {
      amountRemaining: {
        type: Number,
        required: true,
      },
      nextPaymentDate: {
        type: Date,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Reminder', ReminderSchema);