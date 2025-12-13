/**
 * Socket.io Bridge Server - FIXED VERSION
 * Key fix: Check both query params AND auth for client type
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

let connectedClients = 0;
let pythonConnected = false;
let latestSimulationState = null;
let episodeHistory = [];

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: connectedClients,
    pythonConnected,
    uptime: process.uptime()
  });
});

app.get('/api/history', (req, res) => {
  res.json({
    episodes: episodeHistory.slice(-50),
    currentState: latestSimulationState
  });
});

io.on('connection', (socket) => {
  // FIXED: Check multiple places for client type
  const clientType = 
    socket.handshake.query.type || 
    socket.handshake.auth?.type || 
    'unknown';
  
  console.log(`✅ Client connected: ${socket.id} (${clientType})`);
  console.log(`   Query params:`, socket.handshake.query);
  console.log(`   Auth:`, socket.handshake.auth);
  connectedClients++;

  if (clientType === 'python') {
    pythonConnected = true;
    console.log('🐍🐍🐍 Python simulation connected!');
    console.log('   Now listening for simulation_update events...');
    
    // Receive simulation updates from Python
    socket.on('simulation_update', (data) => {
      console.log(`📊 Received update from Python:`, {
        episode: data.episode,
        step: data.step,
        agents: data.agents?.length,
        food: data.food?.length,
        obstacles: data.obstacles?.length,
        survival_rate: data.survival_rate
      });
      
      latestSimulationState = {
        ...data,
        timestamp: Date.now()
      };
      
      // Broadcast to all React clients
      const clientCount = socket.broadcast.emit('state_update', latestSimulationState);
      console.log(`   ✓ Broadcasted to ${io.sockets.sockets.size - 1} client(s)`);
    });
    
    // Receive episode completion data
    socket.on('episode_complete', (data) => {
      episodeHistory.push(data);
      
      if (episodeHistory.length > 100) {
        episodeHistory = episodeHistory.slice(-100);
      }
      
      socket.broadcast.emit('episode_summary', data);
      console.log(`📊 Episode ${data.episode} complete - Survival: ${(data.survival_rate * 100).toFixed(1)}%`);
    });
    
    // Send confirmation back to Python
    socket.emit('connection_confirmed', {
      message: 'Python client registered successfully',
      sid: socket.id
    });
  }

  if (clientType === 'react') {
    console.log('⚛️  React client connected');
    
    // Send initial state if available
    if (latestSimulationState) {
      console.log('   Sending latest state to React client...');
      socket.emit('state_update', latestSimulationState);
    }
    
    // Send episode history
    socket.emit('history_update', episodeHistory.slice(-20));
    
    // Handle requests for updates
    socket.on('request_update', () => {
      if (latestSimulationState) {
        socket.emit('state_update', latestSimulationState);
      }
    });
  }

  if (clientType === 'unknown') {
    console.log('⚠️  Unknown client type - connection may not work properly');
    console.log('   Make sure to pass type in query params or auth');
  }

  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} - ${reason}`);
    connectedClients--;
    
    if (clientType === 'python') {
      pythonConnected = false;
      console.log('🐍 Python simulation disconnected');
    }
  });

  socket.on('error', (error) => {
    console.error(`🔴 Socket error for ${socket.id}:`, error);
  });
});

// Periodic cleanup
setInterval(() => {
  if (episodeHistory.length > 100) {
    episodeHistory = episodeHistory.slice(-100);
  }
}, 60000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing server...');
  io.close(() => {
    httpServer.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log('=' .repeat(60));
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log(`📡 Waiting for connections...`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log('=' .repeat(60));
  console.log('\nExpecting clients:');
  console.log('  1. Python simulation (type=python)');
  console.log('  2. React dashboard (type=react)');
  console.log('');
});