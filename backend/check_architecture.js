const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(uri).then(async () => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const info = await adminDb.command({ buildInfo: 1 });
    console.log('MongoDB Version:', info.version);
    
    try {
      const isMaster = await adminDb.command({ isMaster: 1 });
      console.log('Is Replica Set / Atlas:', !!isMaster.setName);
      console.log('Set Name:', isMaster.setName || 'N/A');
    } catch (e) {
      console.log('Could not determine isMaster status:', e.message);
    }
  } catch (err) {
    console.log('Error checking MongoDB architecture:', err);
  } finally {
    process.exit(0);
  }
}).catch(err => {
  console.error('Connection error:', err);
  process.exit(1);
});
