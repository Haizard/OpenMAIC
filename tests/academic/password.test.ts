import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/academic/password';

describe('password hashing', () => {
  it('verifies a hash produced from the same password', async () => {
    const stored = await hashPassword('correct horse');
    await expect(verifyPassword('correct horse', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse');
    await expect(verifyPassword('wrong password', stored)).resolves.toBe(false);
  });

  it('returns false for a malformed stored hash', async () => {
    await expect(verifyPassword('correct horse', 'not-a-hash')).resolves.toBe(false);
  });
});
