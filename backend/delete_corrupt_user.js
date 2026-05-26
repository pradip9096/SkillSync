const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(uri).then(async () => {
  const User = require('./src/models/User');
  const result = await User.deleteOne({ email: 'exmaple121@gmail.com' });
  console.log('Deleted corrupted user:', result);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
