const Availability = require('../models/Availability');

class AvailabilityRepository {
  async findOne(query, options = {}) {
    let q = Availability.findOne(query);
    if (options.session) {
      q = q.session(options.session);
    }
    return q;
  }

  async find(query) {
    return Availability.find(query);
  }
}

module.exports = new AvailabilityRepository();
