import { beforeAll, beforeEach } from 'vitest';
import prisma from '../src/utils/prisma';

beforeAll(async () => {
  console.log('Test Setup: Using DB', process.env.DATABASE_URL);
});

beforeEach(async () => {
  try {
    const tablenames: any = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`;
  
    for (const { name } of tablenames) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
    }
  } catch (e) {
      console.error('Cleanup failed:', e);
  }
});
