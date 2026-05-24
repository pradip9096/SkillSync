/**
 * Purpose: Unified database seeding script to populate the database with Users (Admin, Clients, Experts) and their corresponding Expert profiles.
 * Inputs: Database connection string via process.env.MONGO_URI.
 * Outputs: None (logs status and exits).
 * Side Effects: Connects to MongoDB, deletes all documents in User, Expert, and Booking collections, inserts new records.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Expert = require('../models/Expert');
const Booking = require('../models/Booking');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected for seeding...');

    // Clear existing data
    await Booking.deleteMany();
    await Expert.deleteMany();
    await User.deleteMany();
    console.log('Existing data cleared (Bookings, Experts, Users)...');

    // 1. Seed Administrators
    const adminUser = await User.create({
      email: 'admin@skillsync.com',
      password: 'adminpassword123',
      role: 'Admin',
      name: 'System Administrator',
      phone: '+919999999999'
    });
    console.log('Admin user seeded: admin@skillsync.com');

    // 2. Seed Clients
    const clientUser = await User.create({
      email: 'client@example.com',
      password: 'password123',
      role: 'Client',
      name: 'Rohan Sharma',
      phone: '+919876543210'
    });
    console.log('Client user seeded: client@example.com');

    // 3. Seed Experts and their User credentials
    const expertAccounts = [
      {
        email: 'sarah@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'Dr. Sarah Mitchell',
        phone: '+919111111111',
        profile: {
          name: 'Dr. Sarah Mitchell',
          category: 'Health',
          experience: 12,
          rating: 4.9,
          description: 'Specialist in holistic wellness and preventive medicine.',
          hourlyRate: 1500 // Localized to INR (₹1500)
        }
      },
      {
        email: 'james@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'James Wilson',
        phone: '+919222222222',
        profile: {
          name: 'James Wilson',
          category: 'Technology',
          experience: 8,
          rating: 4.7,
          description: 'Expert Full-stack Developer and System Architect.',
          hourlyRate: 1200
        }
      },
      {
        email: 'elena@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'Elena Rodriguez',
        phone: '+919333333333',
        profile: {
          name: 'Elena Rodriguez',
          category: 'Design',
          experience: 6,
          rating: 4.8,
          description: 'Award-winning UI/UX Designer specializing in mobile apps.',
          hourlyRate: 900
        }
      },
      {
        email: 'michael@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'Michael Chen',
        phone: '+919444444444',
        profile: {
          name: 'Michael Chen',
          category: 'Finance',
          experience: 15,
          rating: 4.9,
          description: 'Certified Financial Planner and Investment Consultant.',
          hourlyRate: 2000
        }
      },
      {
        email: 'amanda@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'Amanda Brooks',
        phone: '+919555555555',
        profile: {
          name: 'Amanda Brooks',
          category: 'Marketing',
          experience: 5,
          rating: 4.5,
          description: 'Digital Marketing Strategist and Social Media Expert.',
          hourlyRate: 800
        }
      },
      {
        email: 'david@skillsync.com',
        password: 'password123',
        role: 'Expert',
        name: 'David Foster',
        phone: '+919666666666',
        profile: {
          name: 'David Foster',
          category: 'Business',
          experience: 10,
          rating: 4.6,
          description: 'Startup Mentor and Business Strategy Consultant.',
          hourlyRate: 1800
        }
      }
    ];

    for (const account of expertAccounts) {
      // Create user credential
      const user = await User.create({
        email: account.email,
        password: account.password,
        role: account.role,
        name: account.name,
        phone: account.phone
      });

      // Create expert profile linked to user credential
      await Expert.create({
        ...account.profile,
        user: user._id
      });
      console.log(`Expert user and profile seeded: ${account.email}`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Seeding error: ${error.message}`);
    process.exit(1);
  }
};

seedData();
