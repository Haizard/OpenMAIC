import { describe, expect, it } from 'vitest';

import { getRequiredRole, getRoleFromCookie, ROLE_COOKIE } from '@/lib/academic/middleware-auth';

describe('academic middleware auth', () => {
  describe('getRoleFromCookie', () => {
    it('returns the role from a well-formed role cookie', () => {
      expect(getRoleFromCookie('student')).toBe('student');
      expect(getRoleFromCookie('parent')).toBe('parent');
      expect(getRoleFromCookie('school')).toBe('school');
    });

    it('accepts the dotted legacy format by reading the first segment', () => {
      expect(getRoleFromCookie('school.1725000000000.sig')).toBe('school');
    });

    it('returns null for an unknown role', () => {
      expect(getRoleFromCookie('admin')).toBeNull();
    });

    it('returns null for a missing cookie', () => {
      expect(getRoleFromCookie(undefined)).toBeNull();
      expect(getRoleFromCookie('')).toBeNull();
    });
  });

  describe('getRequiredRole', () => {
    it('maps student, parent, and school route prefixes to their roles', () => {
      expect(getRequiredRole('/learn')).toBe('student');
      expect(getRequiredRole('/learn/deep/route')).toBe('student');
      expect(getRequiredRole('/parent')).toBe('parent');
      expect(getRequiredRole('/school')).toBe('school');
    });

    it('returns null for public routes', () => {
      expect(getRequiredRole('/')).toBeNull();
      expect(getRequiredRole('/login')).toBeNull();
      expect(getRequiredRole('/register/student')).toBeNull();
      expect(getRequiredRole('/api/academic/login')).toBeNull();
    });

    it('does not treat prefix lookalikes as protected', () => {
      expect(getRequiredRole('/learning-extras')).toBeNull();
      expect(getRequiredRole('/schoolnotes')).toBeNull();
    });
  });

  it('uses the documented role cookie name', () => {
    expect(ROLE_COOKIE).toBe('openmaic_role');
  });
});
