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
const PORT = process.env.PORT;

// Create server and configure Socket.IO
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://baay-frontemd.onrender.com',
  'https://baay-realty.onrender.com',
  'https://baay-realty.onrender.com',
  'https://www.baayrealty.com',
  'https://baay-realty-frontend.onrender.com',
  'https://baay-realty-admin.onrender.com',
  'https://clients.baayrealty.com',
  'https://associates.baayrealty.com',
  'https://superadmin.baayrealty.com',
  'https://admin.baayrealty.com'
];

// Enhanced Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["PATCH","GET", "POST", "PUT", "DELETE", "OPTIONS", "patch"],
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

// In your server code (where you handle socket connections)
socket.on('authenticate', async ({ userId, userType, token }) => {
  try {
    console.log('Authentication attempt received:', { userId, userType });
    
    if (!userType) throw new Error('Missing userType');
    
    // For non-admin users, require both userId and token
    if (userType.toLowerCase() !== 'admin') {
      if (!userId) throw new Error('Missing userId for client/realtor authentication');
      if (!token) throw new Error('Authentication token required');
      
      // Verify token matches user (pseudo-code)
      // const decoded = verifyToken(token);
      // if (decoded.userId !== userId) throw new Error('Invalid token for user');
    }

    switch(userType.toLowerCase()) {
      case 'admin':
        connectedUsers.admins.add(socket.id);
        await socket.join('admin_room');
        console.log(`Admin ${socket.id} joined admin_room`);
        socket.emit('authentication_success', { 
          message: 'Admin authenticated successfully',
          userType: 'admin',
          rooms: ['admin_room']
        });
        break;
        
      case 'client':
      case 'realtor':
        const roomName = `${userType.toLowerCase()}_${userId}`;
        
        // Store connection
        const userMap = userType.toLowerCase() === 'client' 
          ? connectedUsers.clients 
          : connectedUsers.realtors;
        userMap.set(userId, socket.id);
        
        // Join room
        await socket.join(roomName);
        console.log(`${userType} ${userId} joined ${roomName}`);
        
        socket.emit('authentication_success', {
          message: `${userType} authenticated successfully`,
          userType: userType.toLowerCase(),
          room: roomName,
          rooms: [roomName]
        });
        break;
        
      default:
        throw new Error('Invalid userType');
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    socket.emit('authentication_error', { 
      message: error.message,
      requiresAuth: error.message.includes('token'),
      requiresUserId: error.message.includes('userId')
    });
    socket.disconnect();
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
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Make resources accessible to routes
app.locals = {
  io,
  connectedUsers
};

// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path}`, {
//     params: req.params,
//     query: req.query,
//     body: req.body,
//     headers: req.headers
//   });
//   next();
// });

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
