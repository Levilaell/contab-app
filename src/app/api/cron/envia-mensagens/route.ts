import { checkCronAuth } from '@/lib/cron/auth';
import { processarFilaEnvios } from '@/lib/solicitacoes/sender';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!checkCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const r = await processarFilaEnvios();
  return Response.json({ ok: true, ...r });
}

export async function POST(request: Request) {
  return GET(request);
}
