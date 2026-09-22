import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/nexus_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-key-123456789012345',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key-1234567890',
      PORT: '3000'
    }
  }
});
