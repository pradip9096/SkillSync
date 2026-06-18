/**
 * @file agenda.js
 * @description Initializes and exports the shared Agenda.js scheduler instance used for
 * persistent background job processing (session reminders, booking expiry, etc.).
 *
 * Side effects:
 *   - Connects Agenda to MongoDB (collection: `agendaJobs`) via `MONGO_URI` when
 *     `NODE_ENV` is not `test`. In test mode the DB connection is omitted to prevent
 *     ECONNREFUSED hangs during Jest teardown.
 *
 * Dependencies:
 *   - `agenda` — MongoDB-backed job scheduler.
 */

const Agenda = require('agenda');

/** @type {import('agenda').AgendaConfig} Base Agenda configuration shared across all environments. */
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
