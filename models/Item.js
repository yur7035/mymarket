const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  image: { type: String },
  document: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);