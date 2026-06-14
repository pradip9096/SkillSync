const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return User.findById(id);
  }

  async save(user, options = {}) {
    return user.save(options);
  }
}

module.exports = new UserRepository();
