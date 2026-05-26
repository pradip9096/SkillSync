
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

(async () => {
  await mongoose.connect(uri);
  const User = require('./src/models/User');
  const Expert = require('./src/models/Expert');
  
  const testEmail = `test_tx_${Date.now()}@example.com`;

  try {
    console.log('Registering user without mandatory Expert fields...');
    const res = await fetch('http://localhost:5000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
        role: 'Expert',
        name: 'Transaction Test',
        phone: '+910000000000'
      })
    });
    const data = await res.json();
    
    if (res.ok) {
      console.error('Registration succeeded unexpectedly!');
    } else {
      console.log('Registration failed as expected with status:', res.status);
      console.log('Error message:', data.error);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }

  const userCount = await User.countDocuments({ email: testEmail });
  console.log(`User documents found for ${testEmail}:`, userCount);

  process.exit(0);
})();
