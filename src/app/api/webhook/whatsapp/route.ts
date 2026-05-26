import { after } from 'next/server';
import { getConfig } from '@/lib/config';
import {
  processReceivedMessage,
  processStatusUpdate,
  type WhatsAppMessage,
  type WhatsAppStatus,
} from '@/lib/whatsapp/receive-webhook';
import { verifyWebhookSignature } from '@/lib/whatsapp/verify-webhook';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const config = await getConfig();

  if (mode === 'subscribe' && token === config.wa_webhook_verify_token) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Sempre 200 — processa em background
  after(async () => {
    try {
      const entry = (payload as { entry?: Array<{ changes?: Array<{ value?: unknown }> }> })
        .entry?.[0];
      const change = entry?.changes?.[0]?.value as
        | {
            metadata?: { phone_number_id?: string };
            messages?: WhatsAppMessage[];
            statuses?: WhatsAppStatus[];
          }
        | undefined;

      if (!change) return;

      const config = await getConfig();
      if (
        config.wa_phone_number_id &&
        change.metadata?.phone_number_id &&
        config.wa_phone_number_id !== change.metadata.phone_number_id
      ) {
         
        console.warn('Phone number ID mismatch');
        return;
      }

      for (const message of change.messages ?? []) {
        await processReceivedMessage(message);
      }
      for (const status of change.statuses ?? []) {
        await processStatusUpdate(status);
      }
    } catch (error) {
       
      console.error('webhook processing error', error);
    }
  });

  return new Response('OK', { status: 200 });
}
