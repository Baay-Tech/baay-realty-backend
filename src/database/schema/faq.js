const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
  property: { type: String, required: true }, // Property title or ID
  question: { type: String, required: true },
  answer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FAQ", faqSchema);