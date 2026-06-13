const mongoose = require('mongoose');

const processedWebhookSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Document automatically deleted after 30 days
  }
});

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
