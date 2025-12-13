/**
 * Socket.io Bridge Server - FIXED EVENT NAMES
 * Key fix: Consistent event names between Python -> Server -> React
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
    episodeHistoryLength: episodeHistory.length,
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
  const clientType = 
    socket.handshake.query.type || 
    socket.handshake.auth?.type || 
    'unknown';
  
  console.log(`✅ Client connected: ${socket.id} (${clientType})`);
  connectedClients++;

  if (clientType === 'python') {
    pythonConnected = true;
    console.log('🐍 Python simulation connected!');
    
    // Receive simulation updates from Python
    socket.on('simulation_update', (data) => {
      console.log(`📊 Simulation update - Episode ${data.episode}, Step ${data.step}`);
      
      latestSimulationState = {
        ...data,
        timestamp: Date.now()
      };
      
      // Broadcast to all React clients
      socket.broadcast.emit('state_update', latestSimulationState);
    });
    
    // Receive episode completion data
    socket.on('episode_complete', (data) => {
      console.log(`✅ Episode ${data.episode} complete!`);
      console.log(`   Survival: ${(data.survival_rate * 100).toFixed(1)}%`);
      console.log(`   Cooperations: ${data.cooperation_events}`);
      console.log(`   Thefts: ${data.theft_events}`);
      console.log(`   Alliances: ${data.num_alliances}`);
      
      episodeHistory.push(data);
      
      if (episodeHistory.length > 100) {
        episodeHistory = episodeHistory.slice(-100);
      }
      
      // Broadcast as 'episode_complete' to React clients
      const broadcastCount = socket.broadcast.emit('episode_complete', data);
      console.log(`   ✓ Broadcasted to ${io.sockets.sockets.size - 1} client(s)`);
      console.log(`   ✓ Total episodes in history: ${episodeHistory.length}`);
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
    if (episodeHistory.length > 0) {
      console.log(`   Sending ${episodeHistory.length} episodes from history...`);
      // Send each episode individually to trigger the UI update
      episodeHistory.slice(-20).forEach(episode => {
        socket.emit('episode_complete', episode);
      });
    }
    
    // Handle requests for updates
    socket.on('request_update', () => {
      console.log('   React client requested update');
      if (latestSimulationState) {
        socket.emit('state_update', latestSimulationState);
      }
      if (episodeHistory.length > 0) {
        episodeHistory.slice(-20).forEach(episode => {
          socket.emit('episode_complete', episode);
        });
      }
    });
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

// Periodic status log
setInterval(() => {
  if (connectedClients > 0 || episodeHistory.length > 0) {
    console.log(`📊 Status: ${connectedClients} clients | Python: ${pythonConnected ? '✓' : '✗'} | Episodes: ${episodeHistory.length}`);
  }
}, 30000);

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