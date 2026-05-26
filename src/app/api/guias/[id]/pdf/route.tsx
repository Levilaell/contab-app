import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServiceClient } from '@/lib/supabase/service';
import { ProvaEnvioPDF } from '@/lib/pdf/guia-prova';
import { getUser } from '@/lib/auth';
import type { Guia, GuiaEnvio, ExternalClient, ExternalClientContact } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const sb = createServiceClient();

  const { data: guia } = await sb.from('guias').select('*').eq('id', id).maybeSingle();
  if (!guia) return new Response('Not found', { status: 404 });
  const g = guia as Guia;

  const [{ data: envios }, { data: cliente }] = await Promise.all([
    sb.from('guia_envios').select('*').eq('guia_id', g.id).order('created_at'),
    g.external_client_id
      ? sb.from('external_clients').select('razao_social, cnpj').eq('id', g.external_client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const envioList = (envios ?? []) as GuiaEnvio[];
  const cl = (cliente as Pick<ExternalClient, 'razao_social' | 'cnpj'> | null) ?? null;

  const contatoIds = Array.from(new Set(envioList.map((e) => e.contact_id)));
  const { data: contatos } = await sb
    .from('external_client_contacts')
    .select('id, nome, whatsapp')
    .in('id', contatoIds.length > 0 ? contatoIds : ['00000000-0000-0000-0000-000000000000']);
  const contatoList = (contatos ?? []) as Pick<
    ExternalClientContact,
    'id' | 'nome' | 'whatsapp'
  >[];

  const buffer = await renderToBuffer(
    <ProvaEnvioPDF
      guia={g}
      cliente={cl}
      envios={envioList}
      contatos={contatoList}
    />,
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="guia-${g.id.slice(0, 8)}-prova.pdf"`,
    },
  });
}
