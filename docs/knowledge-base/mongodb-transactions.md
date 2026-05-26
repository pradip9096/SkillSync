# MongoDB Multi-Document Transactions

This document explains how multi-document transactions work in MongoDB and why they are essential for preserving data integrity across multiple collections.

## The Analogy: Buying a Coffee
Imagine buying a coffee at a café. It involves two steps:
1. You hand the cashier ₹200.
2. The barista hands you your coffee.

**Without Transactions:**
The cashier takes your money, but the espresso machine suddenly breaks. You've lost your ₹200, and you don't have a coffee. You are left in a "corrupted" state. 

*This is analogous to a database operation where a `User` record is created (money taken), but the `Expert` profile creation throws an error (broken espresso machine), leaving an orphaned `User` record behind.*

**With Transactions:**
The entire process happens inside an "all-or-nothing" bubble. You put the ₹200 on the counter, and the barista starts making the coffee. If the machine breaks, the cashier slides your ₹200 back to you. The exchange is completely **rolled back** as if you never walked into the store. Nothing is permanently recorded until *both* steps succeed.

## How it Works in MongoDB

A multi-document transaction is bound to a `Session`. All database operations that are part of the transaction are passed this session object.

1. **Start Session**: A temporary bubble is created.
2. **Operations**: You create the `User` and `Expert` documents, attaching the session to each call. The data is kept in an isolated "staging" area and is completely invisible to the rest of the application.
3. **Commit**: If all operations succeed, the changes are written to the main database simultaneously (Atomicity).
4. **Abort (Rollback)**: If *any* error occurs mid-way, the entire session is thrown away. The database is restored to exactly how it looked before step 1.

### ASCII Architecture Diagram

Below is a visual representation of how the transaction bubble protects the database from partial states:

```text
  +----------------+                      +-----------------------+                    +-----------------+
  |                |                      |                       |                    |                 |
  |  Controller    |                      | MongoDB Transaction   |                    | Main Database   |
  |                |                      |                       |                    |                 |
  +-------+--------+                      +-----------+-----------+                    +--------+--------+
          |                                           |                                         |
          |  1. Start Session                         |                                         |
          +-----------------------------------------> | (Creates isolated Bubble)               |
          |                                           |                                         |
          |  2. Create User                           |                                         |
          +-----------------------------------------> | [User Data stored in temporary state]   |
          |                                           |                                         |
          |  3. Create Expert Profile                 |                                         |
          +-----------------------------------------> |                                         |
          |                                           |                                         |
          |                                           |                                         |
     +----v-------------------------------------------v----+                                    |
     |                                                     |                                    |
     | IF EXPERT CREATION THROWS AN ERROR:                 |                                    |
     |                                                     |                                    |
     |   Controller   <--- Catch Error ---- Transaction    |                                    |
     |                                                     |                                    |
     |   Transaction Aborts!                               |                                    |
     |   (Temporary User Data is immediately destroyed,    |                                    |
     |    leaving zero trace in the main database.)        |                                    |
     |                                                     |                                    |
     +----^-------------------------------------------^----+                                    |
          |                                           |                                         |
          |                                           |                                         |
     +----v-------------------------------------------v----+                                    |
     |                                                     |                                    |
     | IF BOTH OPERATIONS SUCCEED:                         |                                    |
     |                                                     |                                    |
     |   Controller: Commit Transaction!                   |                                    |
     |                                                     |                                    |
     |   Transaction  -------------------------------------+----------------------------------> |
     |                                                     (Writes BOTH User and Expert to      |
     |                                                      Main Database simultaneously)       |
     |                                                     |                                    |
     +-----------------------------------------------------+                                    |
          |                                           |                                         |
```

## Usage in Code (Mongoose)

To implement this in Mongoose:

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // Operations inside the transaction MUST receive the session object
    const [user] = await User.create([{ name: 'Jane' }], { session });
    await Expert.create([{ user: user._id, category: 'Design' }], { session });
  });
  // Transaction committed successfully
} catch (error) {
  // Transaction automatically aborted
  console.error("Operation failed, data rolled back.");
} finally {
  await session.endSession();
}
```

> **Note:** Multi-document transactions require MongoDB to be running as a Replica Set or Sharded Cluster (like MongoDB Atlas). They are not supported on standalone local instances.
