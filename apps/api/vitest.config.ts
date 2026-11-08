import { defineConfig } from 'vitest/config';

// Tests run against their own Postgres schema ("test"), so the dev data is never touched.
// TEST_DATABASE_URL overrides it (CI sets one).
const testDb =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgrespassword@localhost:5433/thapal_dev?schema=test';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // One file at a time: the files share the test database
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      JOBS_ENABLED: 'false',
      JWT_EXPIRES_IN: '15m',
      NOTIFY_CHANNEL: 'console',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
