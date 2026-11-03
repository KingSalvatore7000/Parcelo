import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { parcelRoutes } from './modules/parcels/parcels.routes';
import { flatRoutes } from './modules/flats/flats.routes';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { initSocketService } from './services/socket.service';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize socket service broadcast helper
initSocketService(io);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for parcel photos
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Thapal API Server',
    status: 'online',
    version: '1.0.0',
    webAppUrl: 'http://localhost:5173',
    healthCheck: '/health',
    message: 'Welcome to Thapal API. The Guard Desk and Web UI runs at http://localhost:5173',
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      service: 'thapal-api',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      service: 'thapal-api',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/parcels', parcelRoutes);
app.use('/flats', flatRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  // Client joins society guard room (for gate guards)
  socket.on('join:guard', (societyId: string) => {
    if (societyId) {
      const room = `society:${societyId}:guards`;
      socket.join(room);
      console.log(`🛡️ Socket ${socket.id} joined guard room: ${room}`);
    }
  });

  // Client joins flat room (for residents of that flat)
  socket.on('join:flat', ({ societyId, flatId }: { societyId: string; flatId: string }) => {
    if (societyId && flatId) {
      const room = `society:${societyId}:flat:${flatId}`;
      socket.join(room);
      console.log(`🏠 Socket ${socket.id} joined flat room: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use(errorHandler);

// Start server
server.listen(config.port, () => {
  console.log('========================================================');
  console.log(`🚀 Thapal API Server running at http://localhost:${config.port}`);
  console.log(`📦 Environment: ${config.nodeEnv}`);
  console.log(`⚡ Socket.io real-time engine ready`);
  console.log('========================================================');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});

export { app, server };
