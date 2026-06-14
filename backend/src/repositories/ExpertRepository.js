const Expert = require('../models/Expert');

class ExpertRepository {
  async findById(id) {
    return Expert.findById(id);
  }

  async findByIdWithUser(id) {
    return Expert.findById(id).populate('user');
  }

  async findOne(query) {
    return Expert.findOne(query);
  }

  async findOneWithUser(query) {
    return Expert.findOne(query).populate('user');
  }
}

module.exports = new ExpertRepository();
