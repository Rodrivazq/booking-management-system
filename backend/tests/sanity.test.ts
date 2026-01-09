import { describe, it, expect } from 'vitest';
import prisma from '../src/utils/prisma';
import fs from 'fs';

describe('Sanity Check', () => {
  it('should require prisma successfully', () => {
    try {
      expect(prisma).toBeDefined();
    } catch (e: any) {
      console.error('Require Error:', e);
      fs.writeFileSync('debug_sanity.json', JSON.stringify({ message: e.message, stack: e.stack }, null, 2));
      throw e;
    }
  });
});
