const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  message: { type: String, required: true },
  generatedByAI: { type: Boolean, default: false },
  sentAt: { type: Number, required: true } // Unix timestamp
});

module.exports = mongoose.model('Chat', chatSchema);