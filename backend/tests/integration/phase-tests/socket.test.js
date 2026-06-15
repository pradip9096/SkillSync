const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

describe('Socket.IO Real-Time Event Testing', () => {
  let io, serverSocket, clientSocket, clientSocket2;
  const port = 5005; // Use an isolated port to avoid EADDRINUSE

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    
    // Minimal mock of the socket events from the main app
    io.on('connection', (socket) => {
      serverSocket = socket;
      socket.on('join_expert_room', (expertId) => {
        socket.join(`expert_${expertId}`);
      });
      socket.on('slot_booked', ({ expertId, slot }) => {
        io.to(`expert_${expertId}`).emit('slot_booked', { slot });
      });
      socket.on('slot_released', ({ expertId, slot }) => {
        io.to(`expert_${expertId}`).emit('slot_released', { slot });
      });
    });

    httpServer.listen(port, () => {
      done();
    });
  });

  afterAll(() => {
    io.close();
  });

  beforeEach((done) => {
    clientSocket = new Client(`http://localhost:${port}`);
    clientSocket2 = new Client(`http://localhost:${port}`);
    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) done();
    };
    clientSocket.on('connect', onConnect);
    clientSocket2.on('connect', onConnect);
  });

  afterEach(() => {
    clientSocket.close();
    clientSocket2.close();
  });

  it('should allow clients to join expert rooms (join_expert_room)', (done) => {
    clientSocket.emit('join_expert_room', 'expert123');
    // We emit to the room to verify client 1 joined successfully
    clientSocket.on('test_room', (msg) => {
      expect(msg).toBe('welcome');
      done();
    });
    setTimeout(() => {
      io.to('expert_expert123').emit('test_room', 'welcome');
    }, 200);
  });

  it('should broadcast slot_booked only to clients in the room', (done) => {
    clientSocket.emit('join_expert_room', 'expert123');
    clientSocket2.emit('join_expert_room', 'expert456');

    setTimeout(() => {
      clientSocket.on('slot_booked', (data) => {
        expect(data.slot).toBe('10:00 AM');
        done();
      });

      clientSocket2.on('slot_booked', () => {
        done(new Error('Client 2 should not receive event for expert123'));
      });

      clientSocket.emit('slot_booked', { expertId: 'expert123', slot: '10:00 AM' });
    }, 50);
  });

  it('should broadcast slot_released only to clients in the room', (done) => {
    clientSocket.emit('join_expert_room', 'expert123');
    clientSocket2.emit('join_expert_room', 'expert456');

    setTimeout(() => {
      clientSocket.on('slot_released', (data) => {
        expect(data.slot).toBe('11:00 AM');
        done();
      });

      clientSocket2.on('slot_released', () => {
        done(new Error('Client 2 should not receive event for expert123'));
      });

      clientSocket.emit('slot_released', { expertId: 'expert123', slot: '11:00 AM' });
    }, 50);
  });
});
