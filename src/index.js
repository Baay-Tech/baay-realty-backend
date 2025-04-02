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

const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://baay-frontemd.onrender.com'
];

// Initialize Socket.IO with proper CORS configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
    transports: ['websocket', 'polling']
  },
  allowEIO3: true
});

// Track connected users with their type and ID
const connectedUsers = {
  admins: new Set(),    // Store admin socket IDs
  clients: new Map(),   // Map of clientId -> socketId
  realtors: new Map()   // Map of realtorId -> socketId
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle authentication
  socket.on('authenticate', ({ userId, userType }) => {
    switch(userType) {
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
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove from admins
    if (connectedUsers.admins.has(socket.id)) {
      connectedUsers.admins.delete(socket.id);
      return;
    }
    
    // Remove from clients
    for (let [clientId, sockId] of connectedUsers.clients.entries()) {
      if (sockId === socket.id) {
        connectedUsers.clients.delete(clientId);
        return;
      }
    }
    
    // Remove from realtors
    for (let [realtorId, sockId] of connectedUsers.realtors.entries()) {
      if (sockId === socket.id) {
        connectedUsers.realtors.delete(realtorId);
        return;
      }
    }
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
  origin: allowedOrigins,
  credentials: true
}));

// Make io accessible in routes
app.locals.io = io;

// Routes
app.use('/auth', auth);
app.use('/realtor', realtor);
app.use('/admin', admin);
app.use('/client', clients);
app.use('/activity', activity);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});