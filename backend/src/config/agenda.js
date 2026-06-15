const Agenda = require('agenda');

/**
 * Purpose: Setup and export the Agenda scheduler instance.
 * Inputs: process.env.MONGO_URI (environment variable).
 * Outputs: Agenda scheduler instance.
 * Side Effects: Connects Agenda to MongoDB for persistent job queueing.
 */
const config = {
  defaultLockLifetime: 10000, // 10 seconds
  processEvery: '30 seconds',
  defaultConcurrency: 5,
  maxConcurrency: 20
};

// Only configure the DB connection if we are not in a test environment,
// to prevent ECONNREFUSED hangs during Jest teardown.
if (process.env.NODE_ENV !== 'test') {
  config.db = {
    address: process.env.MONGO_URI || 'mongodb://localhost:27017/skillsync',
    collection: 'agendaJobs'
  };
}

const agenda = new Agenda(config);

module.exports = agenda;
