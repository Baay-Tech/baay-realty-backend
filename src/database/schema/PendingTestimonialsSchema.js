const mongoose = require('mongoose');

const PendingTestimonialsSchema = new mongoose.Schema({
  realtorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  realtorName: { type: String, required: true },
  realtorEmail: { type: String, required: true },
  propertypurchased: { type: String, required: true },
  content: { type: String, required: true },
  dateSubmitted: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PendingTestimonials', PendingTestimonialsSchema);