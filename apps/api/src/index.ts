import { config } from './config/env';
import { prisma } from './lib/prisma';
import { app, server, io } from './app';
import { startJobs, stopJobs } from './services/jobs';

server.listen(config.port, () => {
  console.log('========================================================');
  console.log(`🚀 Parcelo API Server running at http://localhost:${config.port}`);
  console.log(`📦 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Allowed origins: ${config.corsOrigin.join(', ')}`);
  console.log(`✉️  Parcel messages via ${config.notify.channel}`);
  console.log('========================================================');
  startJobs();
});

// Graceful shutdown
async function shutdown() {
  console.log('\nGracefully shutting down...');
  stopJobs();
  io.close();
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server };
