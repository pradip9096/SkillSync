const mongoose = require('mongoose');

const processedWebhookSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Document automatically deleted after 30 days
  }
});

processedWebhookSchema.index({ eventId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
