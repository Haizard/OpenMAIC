import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'You do not have access to the requested area.',
    },
    { status: 403 },
  );
}
