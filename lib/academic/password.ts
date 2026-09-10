import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// promisify loses the 4-arg overload in @types/node v20 (it types promisify on
// the 3-arg REST signature), so keep the options-carrying call explicit.
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(plain, salt, KEY_LEN, { N, r: R, p: P });
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (parts[4].length === 0 || parts[5].length === 0 || parts[4].length % 2 !== 0 || parts[5].length % 2 !== 0) {
    return false;
  }
  try {
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = await scrypt(plain, salt, expected.length, { N: n, r, p });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
