import { checkCronAuth } from '@/lib/cron/auth';
import { runColeta } from '@/lib/dominio/watch-folder';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!checkCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const r = await runColeta();
    return Response.json({ ok: true, ...r });
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
