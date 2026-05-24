# SkillSync - Real-Time Expert Session Booking System

SkillSync is a robust, real-time web application where users can seamlessly discover experts by category, view live availability, and confidently book sessions without encountering double-booking conflicts.

## 🚀 Features
- **Expert Discovery:** Search for experts by name and filter by category.
- **Real-Time Availability:** View available time slots that update instantly via Socket.io when booked by other users.
- **Conflict-Free Booking:** Atomic database-level transactions ensure zero double-bookings.
- **Booking Management:** Users can track their "Pending" or "Confirmed" bookings.

## 🛠️ Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **Real-Time Communication:** Socket.io

## 📂 Project Structure
This is a two-package JavaScript application:
- `backend/`: Node.js, Express, MongoDB, and Socket.io API.
- `frontend/`: React + Vite client.

## 📖 Documentation
Detailed product specifications can be found in our Product Requirement Document (PRD):
- [Product Requirement Document](.agent/commands/docs/SkillSync_PRD.md)

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB running locally or a MongoDB Atlas URI

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the `backend/` directory with:
   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   ```
4. Start the server:
   ```bash
   npm run dev # or node src/app.js
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## 📜 Coding Guidelines & Scripts
- Frontend runs on Vite (`npm run dev`, `npm run build`, `npm run preview`).
- Frontend linting is available via `npm run lint`.
- The application focuses on clean architecture, segregating responsibilities between routes, controllers, and models. 
- Real-time updates rely heavily on accurate Room management in Socket.io to optimize network performance.
