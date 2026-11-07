/**
 * Builds the Express app, the HTTP server and Socket.io without listening, so tests can load it.
 * index.ts starts it.
 */
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { UserRole } from '@parcelo/shared';
import { config } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { parcelRoutes } from './modules/parcels/parcels.routes';
import { flatRoutes } from './modules/flats/flats.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { errorHandler } from './middleware/errorHandler';
import { resolveAuthUser, AuthUserPayload } from './middleware/auth';
import { prisma } from './lib/prisma';
import { initSocketService, guardRoom, flatRoom } from './services/socket.service';
import { UPLOAD_ROOT, MAX_UPLOAD_JSON, requireSignedPhoto } from './services/storage.service';

const app = express();
const server = http.createServer(app);

if (config.trustProxy > 0) {
  // Lets rate limiting see the real client IP behind a reverse proxy
  app.set('trust proxy', config.trustProxy);
}

// Only the configured web origins may call the API or open a socket
const corsOptions = {
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const io = new SocketIOServer(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
});

initSocketService(io);

// Security headers. Parcel photos are loaded by the web app from another port or
// subdomain, which is same-site, so allow same-site embedding of resources.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors(corsOptions));

// Photo uploads carry a base64 image; everything else is small JSON
app.use('/parcels/upload-photo', express.json({ limit: MAX_UPLOAD_JSON }));
app.use('/admin/residents/import', express.json({ limit: '400kb' }));
app.use(express.json({ limit: '100kb' }));

// Parcel photos: private, served only on a signed, unexpired link (signPhotoUrl); random file
// names, image types only (enforced at upload), never sniffed
app.use(
  '/uploads',
  requireSignedPhoto,
  express.static(UPLOAD_ROOT, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  })
);

// Request logging in development
if (config.isDev) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Parcelo API Server',
    status: 'online',
    healthCheck: '/health',
  });
});

// Health check endpoint (no internal error details)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      service: 'parcelo-api',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    console.error('Health check: database unreachable', err);
    res.status(503).json({
      status: 'degraded',
      service: 'parcelo-api',
      database: 'disconnected',
    });
  }
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/parcels', parcelRoutes);
app.use('/flats', flatRoutes);
app.use('/admin', adminRoutes);

// Sockets must present a valid token; rooms are chosen by the server from the user record
io.use(async (socket, next) => {
  try {
    const user = await resolveAuthUser(socket.handshake.auth?.token);
    if (!user) {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user as AuthUserPayload;

  if (user.role === UserRole.GUARD || user.role === UserRole.ADMIN) {
    socket.join(guardRoom(user.societyId));
  }
  if (user.flatId) {
    socket.join(flatRoom(user.societyId, user.flatId));
  }

  if (config.isDev) {
    console.log(`⚡ Socket connected: ${socket.id} (${user.role} ${user.id})`);
    socket.on('disconnect', () => console.log(`🔌 Socket disconnected: ${socket.id}`));
  }
});

// Global error handler
app.use(errorHandler);

export { app, server };
