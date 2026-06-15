const Agenda = require('agenda');

/**
 * Purpose: Setup and export the Agenda scheduler instance.
 * Inputs: process.env.MONGO_URI (environment variable).
 * Outputs: Agenda scheduler instance.
 * Side Effects: Connects Agenda to MongoDB for persistent job queueing.
 */
const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync',
    collection: 'agendaJobs'
  },
  defaultLockLifetime: 600000, // 10 minutes
  processEvery: '30 seconds',
  defaultConcurrency: 5,
  maxConcurrency: 10
});

module.exports = agenda;
