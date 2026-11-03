"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = exports.io = void 0;
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const env_1 = require("./config/env");
const auth_routes_1 = require("./modules/auth/auth.routes");
const parcels_routes_1 = require("./modules/parcels/parcels.routes");
const flats_routes_1 = require("./modules/flats/flats.routes");
const errorHandler_1 = require("./middleware/errorHandler");
const prisma_1 = require("./lib/prisma");
const socket_service_1 = require("./services/socket.service");
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// Configure Socket.io with CORS
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
// Initialize socket service broadcast helper
(0, socket_service_1.initSocketService)(exports.io);
// Middleware
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static file serving for parcel photos
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '../../uploads')));
// Request logging in development
if (env_1.config.nodeEnv === 'development') {
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
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'ok',
            service: 'thapal-api',
            environment: env_1.config.nodeEnv,
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    }
    catch (err) {
        res.status(503).json({
            status: 'degraded',
            service: 'thapal-api',
            database: 'disconnected',
            error: err.message,
        });
    }
});
// Mount Routes
app.use('/auth', auth_routes_1.authRoutes);
app.use('/parcels', parcels_routes_1.parcelRoutes);
app.use('/flats', flats_routes_1.flatRoutes);
// Socket.io connection handling
exports.io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);
    // Client joins society guard room (for gate guards)
    socket.on('join:guard', (societyId) => {
        if (societyId) {
            const room = `society:${societyId}:guards`;
            socket.join(room);
            console.log(`🛡️ Socket ${socket.id} joined guard room: ${room}`);
        }
    });
    // Client joins flat room (for residents of that flat)
    socket.on('join:flat', ({ societyId, flatId }) => {
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
app.use(errorHandler_1.errorHandler);
// Start server
server.listen(env_1.config.port, () => {
    console.log('========================================================');
    console.log(`🚀 Thapal API Server running at http://localhost:${env_1.config.port}`);
    console.log(`📦 Environment: ${env_1.config.nodeEnv}`);
    console.log(`⚡ Socket.io real-time engine ready`);
    console.log('========================================================');
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nGracefully shutting down...');
    await prisma_1.prisma.$disconnect();
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map