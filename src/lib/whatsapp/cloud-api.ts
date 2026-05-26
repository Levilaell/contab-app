import { getConfig } from '@/lib/config';

const GRAPH_URL = 'https://graph.facebook.com/v20.0';

export type WhatsAppOutboundResult =
  | { ok: true; messageId: string; mock?: boolean }
  | { ok: false; error: string };

export async function callGraph<T>(
  path: string,
  init: RequestInit & { phoneId?: string } = {},
): Promise<T> {
  const config = await getConfig();
  if (!config.wa_access_token) {
    throw new Error('WhatsApp access token não configurado');
  }
  const url = `${GRAPH_URL}/${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${config.wa_access_token}`);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function isMockWhatsApp() {
  return process.env.MOCK_WHATSAPP === 'true';
}
