const Booking = require('../models/Booking');

class BookingRepository {
  async findById(id) {
    return Booking.findById(id);
  }

  async findByIdWithExpert(id) {
    return Booking.findById(id).populate('expert');
  }

  async findOne(query, options = {}) {
    let q = Booking.findOne(query);
    if (options.session) {
      q = q.session(options.session);
    }
    return q;
  }

  async find(query, options = {}) {
    let q = Booking.find(query);
    if (options.populate) {
      q = q.populate(options.populate);
    }
    if (options.sort) {
      q = q.sort(options.sort);
    }
    if (options.skip !== undefined) {
      q = q.skip(options.skip);
    }
    if (options.limit !== undefined) {
      q = q.limit(options.limit);
    }
    if (options.lean) {
      q = q.lean();
    }
    return q;
  }

  async countDocuments(query) {
    return Booking.countDocuments(query);
  }

  async create(data, options = {}) {
    const bookings = await Booking.create([data], options);
    return bookings[0];
  }
  
  createInstance(data) {
    return new Booking(data);
  }

  async save(booking, options = {}) {
    return booking.save(options);
  }
}

module.exports = new BookingRepository();
