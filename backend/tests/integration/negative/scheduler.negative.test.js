const mongoose = require('mongoose');
const Booking = require('../../../src/models/Booking');
const PaymentLog = require('../../../src/models/PaymentLog');
const agenda = require('../../../src/config/agenda');
const emailService = require('../../../src/services/emailService');
const smsService = require('../../../src/services/smsService');

// This requires the scheduler to load agenda definitions
require('../../../src/services/reminderScheduler');

describe('Asynchronous Job Processor Resilience (Scheduler Negative Testing)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('NEG-SCHED-01: send-booking-confirmation gracefully skips if booking is not found', async () => {
    const handler = agenda._definitions['send-booking-confirmation'].fn;
    
    // Provide a valid object ID but it doesn't exist in DB
    const jobId = new mongoose.Types.ObjectId();
    const job = {
      attrs: {
        data: { bookingId: jobId.toString() }
      }
    };

    jest.spyOn(Booking, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);
    
    // Should not throw and should return early
    await expect(handler(job)).resolves.toBeUndefined();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('NEG-SCHED-02: send-session-reminder gracefully skips if booking is not Confirmed', async () => {
    const handler = agenda._definitions['send-session-reminder'].fn;
    
    const jobId = new mongoose.Types.ObjectId();
    const job = {
      attrs: {
        data: { bookingId: jobId.toString(), type: '24h' }
      }
    };

    jest.spyOn(Booking, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({ status: 'Cancelled' }) // mock populated booking
    });

    jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    await expect(handler(job)).resolves.toBeUndefined();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('NEG-SCHED-03: cancel-abandoned-booking throws to trigger Agenda retry when failCount < 3', async () => {
    const handler = agenda._definitions['cancel-abandoned-booking'].fn;

    const jobId = new mongoose.Types.ObjectId();
    const job = {
      attrs: {
        data: { bookingId: jobId.toString() },
        failCount: 2 // Has failed twice before
      }
    };

    // Simulate DB failure
    jest.spyOn(Booking, 'findById').mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Mongo Timeout'))
    });

    // Should throw to retry
    await expect(handler(job)).rejects.toThrow('Mongo Timeout');
  });

  it('NEG-SCHED-04: cancel-abandoned-booking catches error and aborts retry if failCount >= 3', async () => {
    const handler = agenda._definitions['cancel-abandoned-booking'].fn;

    const jobId = new mongoose.Types.ObjectId();
    const job = {
      attrs: {
        data: { bookingId: jobId.toString() },
        failCount: 3 // Reached max retries
      }
    };

    // Simulate DB failure
    jest.spyOn(Booking, 'findById').mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Mongo Timeout'))
    });

    // Should NOT throw, but rather catch and abort
    await expect(handler(job)).resolves.toBeUndefined();
  });
});
