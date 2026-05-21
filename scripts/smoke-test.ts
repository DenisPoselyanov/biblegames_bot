import { readFileSync } from 'fs';
import { join } from 'path';

import { sqlStore } from '../server/db/sqlStore';
import pg from 'pg';

async function runSmokeTest() {
  console.log('🔄 Starting smoke test...');
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('ТВІЙ_РЕАЛЬНИЙ_ПАРОЛЬ') || process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
    console.error('❌ Error: Please update DATABASE_URL in .env with your real password.');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // 1. Run migrations
    console.log('🔄 Running migrations (schema.sql)...');
    const schemaPath = join(process.cwd(), 'server/db/schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('✅ Migrations completed successfully.');

    // 2. Test sqlStore
    console.log('🔄 Testing sqlStore operations...');
    const testUserId = 'test-user-123';
    
    await sqlStore.setProfile(testUserId, { streakDays: 5, mastery: { topic1: 10 } });
    const profile = await sqlStore.getProfile(testUserId);
    
    if (profile && profile.streakDays === 5) {
      console.log('✅ Profile read/write test passed!');
    } else {
      throw new Error('Profile test failed.');
    }

    await sqlStore.setStats(testUserId, { totalScore: 1000 });
    const stats = await sqlStore.getStats(testUserId);
    if (stats && stats.totalScore === 1000) {
      console.log('✅ Stats read/write test passed!');
    } else {
      throw new Error('Stats test failed.');
    }

    console.log('🎉 Smoke test completely successful!');
  } catch (error) {
    console.error('❌ Smoke test failed:', error);
  } finally {
    await pool.end();
  }
}

runSmokeTest();
