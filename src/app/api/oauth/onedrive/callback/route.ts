import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCodeForToken, persistOneDriveAuth } from '@/lib/onedrive/auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = request.cookies.get('onedrive_oauth_state')?.value;

  if (!code) {
    return NextResponse.redirect(new URL('/settings/onedrive?error=missing_code', request.url));
  }
  if (state && stateCookie && state !== stateCookie) {
    return NextResponse.redirect(new URL('/settings/onedrive?error=state_mismatch', request.url));
  }

  try {
    const { userId, refreshToken } = await exchangeCodeForToken(code);
    await persistOneDriveAuth(userId, refreshToken);
    return NextResponse.redirect(new URL('/settings/onedrive?connected=1', request.url));
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/onedrive?error=${encodeURIComponent((error as Error).message)}`,
        request.url,
      ),
    );
  }
}
