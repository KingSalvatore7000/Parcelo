import { execSync } from 'child_process';
import path from 'path';

/** Rebuild the test schema from the migrations before the run (the dev schema is untouched) */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgrespassword@localhost:5433/thapal_dev?schema=test';
  if (!/schema=test\b|_test\b/.test(url)) {
    throw new Error(`Refusing to reset ${url}: the test database URL must name a test schema or database`);
  }
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
