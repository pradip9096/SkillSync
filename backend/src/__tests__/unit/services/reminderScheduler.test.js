/**
 * @file reminderScheduler.test.js
 * @description Unit tests for the Agenda-based scheduled reminder orchestration helpers
 * in `services/reminderScheduler.js`. Covers scheduling 24-hour and 2-hour pre-session
 * reminders, skipping past trigger times, and cancelling previously scheduled jobs by
 * their stored Agenda job IDs. The Agenda instance and MongoDB ObjectId are fully mocked.
 */

const { scheduleSessionReminders, cancelScheduledReminders } = require('../../../services/reminderScheduler');
const agenda = require('../../../config/agenda');
const { ObjectId } = require('mongodb');

jest.mock('../../../config/agenda', () => ({
  _collection: true,
  define: jest.fn(),
  schedule: jest.fn(),
  cancel: jest.fn()
}));

describe('Feature 1.9: Reminder Scheduler Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('scheduleSessionReminders', () => {
    it('TC-NOTIF-05: BVA (Time > 24h) - Should schedule both 24h and 2h jobs', async () => {
      const slotTimeMs = 1701750600000; // 2023-12-05T10:00:00+05:30
      jest.setSystemTime(new Date(slotTimeMs - 3 * 24 * 60 * 60 * 1000)); // 3 days before
      
      const booking = {
        _id: 'booking1',
        bookingDate: '2023-12-05',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };

      agenda.schedule.mockImplementation((time, name, data) => {
        return { attrs: { _id: { toString: () => name === 'send-session-reminder' && data.type === '24h' ? 'job24' : 'job2' } } };
      });

      await scheduleSessionReminders(booking);

      expect(agenda.schedule).toHaveBeenCalledTimes(2);
      expect(booking.agenda24hJobId).toBe('job24');
      expect(booking.agenda2hJobId).toBe('job2');
      expect(booking.save).toHaveBeenCalled();
    });

    it('TC-NOTIF-06: BVA (Time < 24h, > 2h) - Should only schedule 2h job', async () => {
      const slotTimeMs = 1701750600000; // 2023-12-05T10:00:00+05:30
      jest.setSystemTime(new Date(slotTimeMs - 14 * 60 * 60 * 1000));
      
      const booking = {
        _id: 'booking1',
        bookingDate: '2023-12-05',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };

      agenda.schedule.mockImplementation((time, name, data) => {
        return { attrs: { _id: { toString: () => 'job2' } } };
      });

      await scheduleSessionReminders(booking);

      expect(agenda.schedule).toHaveBeenCalledTimes(1); 
      expect(booking.agenda24hJobId).toBeNull();
      expect(booking.agenda2hJobId).toBe('job2');
      expect(booking.save).toHaveBeenCalled();
    });
    
    it('Should skip both if < 2h', async () => {
      const slotTimeMs = 1701750600000; // 2023-12-05T10:00:00+05:30
      jest.setSystemTime(new Date(slotTimeMs - 1 * 60 * 60 * 1000));
      
      const booking = {
        _id: 'booking1',
        bookingDate: '2023-12-05',
        slotTime: '10:00',
        save: jest.fn().mockResolvedValue(true)
      };

      await scheduleSessionReminders(booking);

      expect(agenda.schedule).not.toHaveBeenCalled();
      expect(booking.agenda24hJobId).toBeNull();
      expect(booking.agenda2hJobId).toBeNull();
      expect(booking.save).toHaveBeenCalled();
    });
  });

  describe('cancelScheduledReminders', () => {
    it('TC-NOTIF-07: Golden Path - Cancels both jobs if populated', async () => {
      const booking = {
        _id: 'booking1',
        agenda24hJobId: '60e456789012345678901234',
        agenda2hJobId: '60e456789012345678901235'
      };

      agenda.cancel.mockResolvedValue(1);

      await cancelScheduledReminders(booking);

      expect(agenda.cancel).toHaveBeenCalledTimes(2);
      expect(agenda.cancel).toHaveBeenCalledWith({ _id: new ObjectId('60e456789012345678901234') });
      expect(agenda.cancel).toHaveBeenCalledWith({ _id: new ObjectId('60e456789012345678901235') });
    });
  });
});
