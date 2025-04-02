require('dotenv').config();
const express = require("express");
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require("./database/index");

// Import routes
const auth = require('./routes/auth');
const realtor = require("./routes/realtor");
const admin = require("./routes/admin");
const clients = require("./routes/client");
const activity = require("./routes/activity");

const app = express();
const PORT = process.env.PORT || 3005;

// Create server and configure Socket.IO
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://baay-frontemd.onrender.com'
];

// Enhanced Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "my-custom-header"],
    transports: ['websocket', 'polling']
  },
  allowEIO3: true,
  pingTimeout: 60000, // Increase timeout for better reliability
  pingInterval: 25000
});

// Track connected users
const connectedUsers = {
  admins: new Set(),
  clients: new Map(),
  realtors: new Map()
};

// Socket.IO connection handler with better error handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Add heartbeat monitoring
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') {
      cb();
    }
  });

  socket.on('authenticate', ({ userId, userType }) => {
    try {
      if (!userId || !userType) {
        throw new Error('Missing userId or userType');
      }

      switch(userType.toLowerCase()) {
        case 'admin':
          connectedUsers.admins.add(socket.id);
          socket.join('admin_room');
          console.log(`Admin authenticated: ${socket.id}`);
          break;
        case 'client':
          connectedUsers.clients.set(userId, socket.id);
          socket.join(`user_${userId}`);
          console.log(`Client ${userId} authenticated: ${socket.id}`);
          break;
        case 'realtor':
          connectedUsers.realtors.set(userId, socket.id);
          socket.join(`realtor_${userId}`);
          console.log(`Realtor ${userId} authenticated: ${socket.id}`);
          break;
        default:
          throw new Error('Invalid userType');
      }
    } catch (error) {
      console.error('Authentication error:', error.message);
      socket.emit('authentication_error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    cleanupDisconnectedUser(socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Helper function to clean up disconnected users
function cleanupDisconnectedUser(socketId) {
  // Remove from admins
  if (connectedUsers.admins.has(socketId)) {
    connectedUsers.admins.delete(socketId);
    return;
  }
  
  // Remove from clients
  for (let [clientId, sockId] of connectedUsers.clients.entries()) {
    if (sockId === socketId) {
      connectedUsers.clients.delete(clientId);
      return;
    }
  }
  
  // Remove from realtors
  for (let [realtorId, sockId] of connectedUsers.realtors.entries()) {
    if (sockId === socketId) {
      connectedUsers.realtors.delete(realtorId);
      return;
    }
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Make resources accessible to routes
app.locals = {
  io,
  connectedUsers
};

// Routes
app.use('/auth', auth);
app.use('/realtor', realtor);
app.use('/admin', admin);
app.use('/client', clients);
app.use('/activity', activity);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    socketConnections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle Socket.IO errors differently
  if (err.name === 'SocketError') {
    return res.status(503).json({ error: 'WebSocket service unavailable' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Server startup
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...');
  
  // Close all Socket.IO connections
  io.close(() => {
    console.log('Socket.IO server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});