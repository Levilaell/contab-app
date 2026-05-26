import { ConfidentialClientApplication } from '@azure/msal-node';
import { encrypt, decrypt } from '@/lib/crypto';
import { getConfig } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/service';

const SCOPES = ['Files.ReadWrite', 'User.Read', 'offline_access'];

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID || 'mock-client-id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'mock-secret',
      authority: 'https://login.microsoftonline.com/common',
    },
  });
}

export function getAuthUrl(state: string): string {
  if (process.env.MOCK_ONEDRIVE === 'true') {
    return `/api/oauth/onedrive/callback?code=mock&state=${state}`;
  }
  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID ?? '');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set(
    'redirect_uri',
    process.env.MICROSOFT_REDIRECT_URI ?? 'http://localhost:3000/api/oauth/onedrive/callback',
  );
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  userId: string;
  refreshToken: string;
}> {
  if (process.env.MOCK_ONEDRIVE === 'true') {
    return {
      userId: 'mock-user@onedrive.local',
      refreshToken: `mock-refresh-${Date.now()}`,
    };
  }
  const msal = getMsalClient();
  const result = await msal.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri:
      process.env.MICROSOFT_REDIRECT_URI ??
      'http://localhost:3000/api/oauth/onedrive/callback',
  });
  if (!result) throw new Error('Token exchange falhou');

  // Refresh token só fica disponível através do cache MSAL.
  const tokenCache = msal.getTokenCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = (tokenCache as any).serialize?.() ?? '';
  let refreshToken = '';
  try {
    const cache = JSON.parse(serialized);
    const entry = cache.RefreshToken
      ? Object.values(cache.RefreshToken as Record<string, { secret: string }>)[0]
      : null;
    refreshToken = entry?.secret ?? '';
  } catch {
    refreshToken = '';
  }

  return {
    userId: result.account?.username ?? '',
    refreshToken,
  };
}

export async function getAccessToken(): Promise<string> {
  if (process.env.MOCK_ONEDRIVE === 'true') {
    return 'mock-access-token';
  }
  const config = await getConfig();
  if (!config.onedrive_refresh_token) {
    throw new Error('OneDrive não conectado');
  }
  const msal = getMsalClient();
  const result = await msal.acquireTokenByRefreshToken({
    refreshToken: config.onedrive_refresh_token,
    scopes: SCOPES,
  });
  if (!result) throw new Error('refresh token falhou');
  return result.accessToken;
}

export async function persistOneDriveAuth(userId: string, refreshToken: string) {
  const sb = createServiceClient();
  await sb
    .from('app_config')
    .update({
      onedrive_user_id: userId,
      onedrive_refresh_token_encrypted: refreshToken ? encrypt(refreshToken) : null,
      onedrive_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
}

export { encrypt, decrypt };
