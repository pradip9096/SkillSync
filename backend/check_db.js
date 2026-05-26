const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(uri).then(async () => {
  const User = require('./src/models/User');
  const Expert = require('./src/models/Expert');
  
  const user = await User.findOne({ email: /exmaple121/i });
  console.log('User:', user);
  
  if (user) {
    const expert = await Expert.findOne({ user: user._id });
    console.log('Expert:', expert);
  }
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
