const mongoose = require('mongoose');

const Commsionactivation = new mongoose.Schema({
IndirectCommission: {
    type: Number,
    required: true
  },
  DirectCommission: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('commsionactivation', Commsionactivation);