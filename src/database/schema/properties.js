// Property Schema (models/Property.js)
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  featuredImage: { type: String, required: true },
  galleryImages: [{ type: String }],
  subscriptionForm: { type: String, required: true },
  propertyName: { type: String, required: true },
  amount: { type: Number, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  propertyType: { type: String, required: true },
  propertyStatus: { type: String, required: true },
  bedrooms: { type: Number, required: true },
  bathrooms: { type: Number, required: true },
  landSize: { type: Number, required: true },
  description: { type: String, required: true },
  commission: { type: Number, required: true },
  indirectcommission: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', propertySchema);