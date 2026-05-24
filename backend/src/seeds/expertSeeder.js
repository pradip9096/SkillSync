/**
 * Purpose: Script to populate the MongoDB database with initial expert data.
 * Inputs: Database connection string via process.env.MONGO_URI and a local array of sample expert objects.
 * Outputs: None (logs status to console and terminates the process).
 * Side Effects: Connects to MongoDB, deletes all existing documents in the Expert and Booking collections, inserts new sample experts, and terminates the Node.js process.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Expert = require('../models/Expert');
const Booking = require('../models/Booking');
const path = require('path');

// Load environment variables, ensuring the path points to the root backend .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Sample expert data to be seeded into the database.
 */
const experts = [
  {
    name: 'Dr. Sarah Mitchell',
    category: 'Health',
    experience: 12,
    rating: 4.9,
    description: 'Specialist in holistic wellness and preventive medicine.',
    hourlyRate: 150,
    profileImage: '/experts/sarah.png'
  },
  {
    name: 'James Wilson',
    category: 'Technology',
    experience: 8,
    rating: 4.7,
    description: 'Expert Full-stack Developer and System Architect.',
    hourlyRate: 120,
    profileImage: '/experts/james.png'
  },
  {
    name: 'Elena Rodriguez',
    category: 'Design',
    experience: 6,
    rating: 4.8,
    description: 'Award-winning UI/UX Designer specializing in mobile apps.',
    hourlyRate: 90,
    profileImage: '/experts/elena.png'
  },
  {
    name: 'Michael Chen',
    category: 'Finance',
    experience: 15,
    rating: 4.9,
    description: 'Certified Financial Planner and Investment Consultant.',
    hourlyRate: 200,
    profileImage: '/experts/michael.png'
  },
  {
    name: 'Amanda Brooks',
    category: 'Marketing',
    experience: 5,
    rating: 4.5,
    description: 'Digital Marketing Strategist and Social Media Expert.',
    hourlyRate: 80,
    profileImage: '/experts/amanda.png'
  },
  {
    name: 'David Foster',
    category: 'Business',
    experience: 10,
    rating: 4.6,
    description: 'Startup Mentor and Business Strategy Consultant.',
    hourlyRate: 180,
    profileImage: '/experts/david.png'
  }
];

/**
 * Purpose: Connects to the database, clears existing experts and bookings, and inserts new sample experts.
 * @async
 * @returns {Promise<void>} Exits the process upon completion or failure.
 * Side effects: Establishes a database connection, removes all records from 'experts' and 'bookings' collections, inserts new records, logs progress, and terminates the process.
 */
const seedData = async () => {
  try {
    // Connect to MongoDB using the URI from environment variables
    await mongoose.connect(process.env.MONGO_URI);
    
    /**
     * Clear existing data:
     * We delete both experts and bookings to maintain a clean state and prevent
     * orphan bookings pointing to non-existent experts.
     */
    await Expert.deleteMany();
    await Booking.deleteMany();
    console.log('Existing data removed (Experts & Bookings)...');

    // Insert the new sample experts
    await Expert.insertMany(experts);
    console.log('Experts seeded successfully!');
    
    // Successfully finish the process
    process.exit();
  } catch (error) {
    // Log any errors and exit with a failure code
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Execute the seeding script
seedData();
