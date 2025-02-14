
const mongoose = require('mongoose');

const birthdayMessageSchema = new mongoose.Schema({
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  });

module.exports = mongoose.model('BirthdayMessage', birthdayMessageSchema);