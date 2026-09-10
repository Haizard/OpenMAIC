import { NextResponse } from 'next/server';

import { verifyPassword } from '@/lib/academic/password';
import { createSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/academic/session';
import { getAcademicDb } from '@/lib/academic/db';
import { ROLE_COOKIE } from '@/lib/academic/middleware-auth';

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as LoginRequest;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const db = await getAcademicDb();
    const result = await db.query(
      `SELECT id, password_hash, role FROM academic_users WHERE email = $1`,
      [email],
    );

    const user = result.rows[0] as { id: string; password_hash: string; role: string } | undefined;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const { id: sessionId, expiresAt } = await createSession(db, user.id);

    const response = NextResponse.json({
      success: true,
      role: user.role,
    });

    response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions(expiresAt));

    // Role cookie: an Edge-middleware UX hint so protected pages can redirect
    // without a DB round-trip. Not a security boundary — API routes verify the
    // database-backed session via requireRole. Its lifetime matches the session.
    response.cookies.set(ROLE_COOKIE, user.role, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
