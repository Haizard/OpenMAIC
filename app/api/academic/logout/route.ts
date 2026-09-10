import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAcademicDb } from '@/lib/academic/db';
import { ROLE_COOKIE } from '@/lib/academic/middleware-auth';
import { destroySession, SESSION_COOKIE } from '@/lib/academic/session';

export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    if (sessionCookie?.value) {
      try {
        const db = await getAcademicDb();
        await destroySession(db, sessionCookie.value);
      } catch {
        // DB unavailable: still clear cookies so the browser session ends.
      }
    }

    const response = NextResponse.json({ success: true });

    // Clear the session cookie
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    
    // Clear role cookie
    response.cookies.set(ROLE_COOKIE, '', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
