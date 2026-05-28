'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { gerarLinkPublicoGuia } from '@/lib/guias/storage';
import { montarMensagemGrupo, type GuiaParaEnvio } from '@/lib/guias/grupo-mensagem';
import type { Guia, ExternalClient } from '@/lib/types';

type PrepResult =
  | { ok: true; grupoNome: string; mensagem: string; total_guias: number }
  | { ok: false; error: string };

export async function prepararEnvioGrupo(externalClientId: string): Promise<PrepResult> {
  await requireUser();
  const sb = createServiceClient();

  const { data: cliente } = await sb
    .from('external_clients')
    .select('id, razao_social, grupo_whatsapp_nome')
    .eq('id', externalClientId)
    .maybeSingle();

  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };
  const c = cliente as Pick<ExternalClient, 'id' | 'razao_social' | 'grupo_whatsapp_nome'>;
  if (!c.grupo_whatsapp_nome) {
    return { ok: false, error: 'Cliente sem grupo WhatsApp cadastrado' };
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const { data: guias } = await sb
    .from('guias')
    .select('id, tipo, competencia, vencimento, valor, storage_path, link_publico_url, link_publico_expira_at')
    .eq('external_client_id', externalClientId)
    .gte('competencia', monthStart)
    .order('vencimento', { ascending: true });

  type GuiaRow = Pick<
    Guia,
    'id' | 'tipo' | 'competencia' | 'vencimento' | 'valor' | 'storage_path' | 'link_publico_url' | 'link_publico_expira_at'
  >;
  const guiaList = (guias ?? []) as GuiaRow[];

  if (guiaList.length === 0) {
    return { ok: false, error: 'Nenhuma guia do mês atual pra este cliente' };
  }

  // Regenera signed URLs que estão prestes a expirar ou ausentes
  const limite = Date.now() + 24 * 3600 * 1000; // próximas 24h conta como "ausente"
  for (const g of guiaList) {
    const expira = g.link_publico_expira_at ? new Date(g.link_publico_expira_at).getTime() : 0;
    if (!g.link_publico_url || expira < limite) {
      const r = await gerarLinkPublicoGuia(g.id, g.storage_path);
      if (r.ok && r.url) {
        g.link_publico_url = r.url;
      }
    }
  }

  const config = await getConfig();
  const nomeEscritorio = config.nome_escritorio ?? 'Contabilliza';

  const guiasParaEnvio: GuiaParaEnvio[] = guiaList.map((g) => ({
    tipo: g.tipo,
    competencia: g.competencia,
    vencimento: g.vencimento,
    valor: g.valor,
    link_publico_url: g.link_publico_url,
  }));

  const mensagem = montarMensagemGrupo({
    razaoSocial: c.razao_social,
    guias: guiasParaEnvio,
    nomeEscritorio,
  });

  return {
    ok: true,
    grupoNome: c.grupo_whatsapp_nome,
    mensagem,
    total_guias: guiaList.length,
  };
}
