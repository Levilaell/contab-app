import { createServiceClient } from '@/lib/supabase/service';
import { sendTemplate } from '@/lib/whatsapp/send-template';
import { formatCompetencia } from '@/lib/format';
import type {
  ExternalClientContact,
  GuiaEnvio,
  SolicitacaoDocumento,
  Guia,
  ExternalClient,
} from '@/lib/types';

type EnviadoRow =
  | { kind: 'solicitacao'; row: SolicitacaoDocumento }
  | { kind: 'guia_envio'; row: GuiaEnvio };

export async function processarFilaEnvios(): Promise<{
  enviadas: number;
  erros: number;
}> {
  const sb = createServiceClient();
  const agora = new Date().toISOString();

  const [solRes, guiaRes] = await Promise.all([
    sb
      .from('solicitacoes_documentos')
      .select('*')
      .eq('status', 'agendada')
      .lte('agendada_para', agora)
      .limit(50),
    sb
      .from('guia_envios')
      .select('*')
      .eq('status', 'pendente')
      .lte('agendada_para', agora)
      .limit(50),
  ]);

  const items: EnviadoRow[] = [
    ...((solRes.data ?? []) as SolicitacaoDocumento[]).map((r) => ({
      kind: 'solicitacao' as const,
      row: r,
    })),
    ...((guiaRes.data ?? []) as GuiaEnvio[]).map((r) => ({
      kind: 'guia_envio' as const,
      row: r,
    })),
  ];

  let enviadas = 0;
  let erros = 0;

  for (const item of items) {
    try {
      if (item.kind === 'solicitacao') {
        await enviarSolicitacao(item.row);
      } else {
        await enviarGuia(item.row);
      }
      enviadas++;
    } catch (err) {
      erros++;
       
      console.error('envio erro', err);
    }
  }

  return { enviadas, erros };
}

async function enviarSolicitacao(sol: SolicitacaoDocumento) {
  const sb = createServiceClient();
  const { data: contato } = await sb
    .from('external_client_contacts')
    .select('*')
    .eq('id', sol.contact_id)
    .single();
  if (!contato) {
    await sb
      .from('solicitacoes_documentos')
      .update({ status: 'erro', erro_mensagem: 'contato não encontrado' })
      .eq('id', sol.id);
    return;
  }
  const c = contato as ExternalClientContact;

  const r = await sendTemplate({
    to: c.whatsapp,
    templateName: sol.template_nome,
    params: [
      { name: 'nome_contato', value: c.nome.split(' ')[0] },
      { name: 'competencia', value: formatCompetencia(sol.competencia) },
    ],
  });

  if (r.ok) {
    await sb
      .from('solicitacoes_documentos')
      .update({
        status: 'enviada',
        enviada_at: new Date().toISOString(),
        wa_message_id: r.messageId,
      })
      .eq('id', sol.id);

    await sb.from('bot_messages').insert({
      solicitacao_id: sol.id,
      external_client_id: sol.external_client_id,
      remetente_phone: c.whatsapp,
      direcao: 'enviada',
      tipo: 'template',
      conteudo: `[${sol.template_nome}] competencia=${sol.competencia}`,
      wa_message_id: r.messageId,
    });
  } else {
    await sb
      .from('solicitacoes_documentos')
      .update({ status: 'erro', erro_mensagem: r.error })
      .eq('id', sol.id);
  }
}

async function enviarGuia(envio: GuiaEnvio) {
  const sb = createServiceClient();

  const [contatoRes, guiaRes] = await Promise.all([
    sb.from('external_client_contacts').select('*').eq('id', envio.contact_id).single(),
    sb.from('guias').select('*').eq('id', envio.guia_id).single(),
  ]);

  if (!contatoRes.data || !guiaRes.data) {
    await sb
      .from('guia_envios')
      .update({ status: 'erro', erro_mensagem: 'contato ou guia não encontrado' })
      .eq('id', envio.id);
    return;
  }

  const contato = contatoRes.data as ExternalClientContact;
  const guia = guiaRes.data as Guia;

  let cliente: Pick<ExternalClient, 'razao_social'> | null = null;
  if (guia.external_client_id) {
    const { data } = await sb
      .from('external_clients')
      .select('razao_social')
      .eq('id', guia.external_client_id)
      .maybeSingle();
    if (data) cliente = data as Pick<ExternalClient, 'razao_social'>;
  }

  const vencimentoBR = new Date(guia.vencimento).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  await sb.from('guia_envios').update({ status: 'enviando' }).eq('id', envio.id);

  const r = await sendTemplate({
    to: contato.whatsapp,
    templateName: envio.template_nome,
    params: [
      { name: 'nome_contato', value: contato.nome.split(' ')[0] },
      { name: 'razao_social', value: cliente?.razao_social ?? '' },
      { name: 'tipo_guia', value: guia.tipo },
      { name: 'vencimento', value: vencimentoBR },
    ],
  });

  if (r.ok) {
    await sb
      .from('guia_envios')
      .update({
        status: 'enviado',
        enviado_at: new Date().toISOString(),
        wa_message_id: r.messageId,
      })
      .eq('id', envio.id);
  } else {
    await sb
      .from('guia_envios')
      .update({ status: 'erro', erro_mensagem: r.error })
      .eq('id', envio.id);
  }
}
