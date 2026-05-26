import { checkCronAuth } from '@/lib/cron/auth';
import { agendarSolicitacoesDoDia } from '@/lib/solicitacoes/scheduler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!checkCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const r = await agendarSolicitacoesDoDia();
  return Response.json({ ok: true, ...r });
}

export async function POST(request: Request) {
  return GET(request);
}
