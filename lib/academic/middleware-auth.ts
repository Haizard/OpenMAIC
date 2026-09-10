/**
 * Edge-compatible role helpers for middleware.
 *
 * The middleware cannot reach Postgres, so the login route also sets a
 * non-sensitive `openmaic_role` cookie naming the signed-in role. It is a UX
 * hint only: every API route re-verifies the real session against the
 * database via `requireRole`, so a forged role cookie can at most bounce a
 * browser between dashboards — it never grants data access.
 */

export const ROLE_COOKIE = 'openmaic_role';

const ALLOWED_ROLES = ['student', 'parent', 'school'] as const;

/**
 * Extract the role from the role cookie.
 * Returns null if the cookie is missing or malformed.
 */
export function getRoleFromCookie(roleCookie: string | undefined): string | null {
  if (!roleCookie) return null;
  const role = roleCookie.split('.')[0];
  return (ALLOWED_ROLES as readonly string[]).includes(role) ? role : null;
}

/**
 * Role-based route configuration.
 */
export const ROLE_ROUTES: Record<string, string[]> = {
  student: ['/learn'],
  parent: ['/parent'],
  school: ['/school'],
};

/**
 * Check if a pathname requires a specific role.
 * Returns the required role or null if the route is public.
 */
export function getRequiredRole(pathname: string): string | null {
  for (const [role, prefixes] of Object.entries(ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (pathname === prefix || pathname.startsWith(prefix + '/')) {
        return role;
      }
    }
  }
  return null;
}
