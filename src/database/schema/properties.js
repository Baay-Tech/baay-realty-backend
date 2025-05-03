// Property Schema (models/Property.js)
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  featuredImage: { type: String },
  galleryImages: [{ type: String }],
  subscriptionForm: { type: String },
  propertyName: { type: String },
  amount: { type: Number },
  state: { type: String },
  city: { type: String },
  propertyType: { type: String },
  propertyStatus: { type: String },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  landSize: { type: Number },
  description: { type: String },
  commission: { type: Number },
  indirectcommission: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', propertySchema);
