const mongoose = require('mongoose');

describe('Infrastructure Extinction Paths (DB Config)', () => {
  let mockExit;

  beforeEach(() => {
    // Isolate process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process.exit called with code ${code}`);
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('NEG-DB-01: Should explicitly invoke process.exit(1) on connection failure', async () => {
    // Delete require cache to reload db.js and force a new connectDB call
    delete require.cache[require.resolve('../../../src/config/db')];
    
    // Mock mongoose connect to reject immediately
    jest.spyOn(mongoose, 'connect').mockRejectedValue(new Error('Fatal DB Error'));

    const connectDB = require('../../../src/config/db');

    await expect(connectDB()).rejects.toThrow('Process.exit called with code 1');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mongoose.connect).toHaveBeenCalled();
  });
});
