import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuthUrl } from '@/lib/onedrive/auth';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const url = getAuthUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set('onedrive_oauth_state', state, {
    path: '/',
    httpOnly: true,
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
