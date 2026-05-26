import { checkCronAuth } from '@/lib/cron/auth';
import { processEscrituracaoQueue } from '@/lib/dominio/nfe-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await processEscrituracaoQueue();
  return Response.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
