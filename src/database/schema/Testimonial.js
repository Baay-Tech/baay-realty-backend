// models/Testimonial.js
const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
  realtorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  realtorName: { type: String, required: true },
  realtorEmail: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  dateSubmitted: { type: Date, required: true },
  dateAccepted: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Testimonial', TestimonialSchema);