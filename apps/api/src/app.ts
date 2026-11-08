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
import { initSocketService, guardRoom, flatRoom, userRoom } from './services/socket.service';
import { UPLOAD_ROOT, requireSignedPhoto } from './services/storage.service';
import { securityLog } from './services/securityLog';

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

// Behind a TLS proxy, plain HTTP is sent to HTTPS (308 keeps the method and body)
if (config.isProd) {
  app.use((req, res, next) => {
    if (req.get('x-forwarded-proto') === 'http') {
      res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
      return;
    }
    next();
  });
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, frameguard: { action: 'deny' } }));
app.use(cors(corsOptions));

// Denied and throttled requests go to the security log (expired photo links are routine)
app.use((req, res, next) => {
  res.on('finish', () => {
    const event = res.statusCode === 403 ? 'permission_denied' : res.statusCode === 429 ? 'rate_limited' : null;
    if (event && !req.originalUrl.startsWith('/uploads')) {
      securityLog(event, { userId: req.user?.id, ip: req.ip, method: req.method, path: req.originalUrl.split('?')[0] });
    }
  });
  next();
});

// Small JSON everywhere. The two large-body routes parse their own body after checking who is
// calling, so nobody can make the server read megabytes without signing in.
const LARGE_BODY_ROUTES = new Set(['/parcels/upload-photo', '/admin/residents/import']);
const smallJson = express.json({ limit: '100kb' });
app.use((req, res, next) => (LARGE_BODY_ROUTES.has(req.path) ? next() : smallJson(req, res, next)));

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
      // The link itself is the permission, and the web app may be on another site than the API
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// API answers can hold temporary passwords and personal details: never cache them
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
    if (!user || user.mustChangePassword) {
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

  socket.join(userRoom(user.id));
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
