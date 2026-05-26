import { createServiceClient } from '@/lib/supabase/service';
import type { ExternalClient, ExternalClientContact } from '@/lib/types';

export const TEMPLATE_NAME = 'docs_solicitacao_mensal';

export async function agendarSolicitacoesDoDia(refDate = new Date()): Promise<{
  agendadas: number;
}> {
  const sb = createServiceClient();
  const dia = refDate.getUTCDate();
  const competencia = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  const { data: clientes } = await sb
    .from('external_clients')
    .select('id')
    .eq('ativo', true)
    .eq('solicitar_documentos', true)
    .eq('dia_solicitacao', dia);

  if (!clientes || clientes.length === 0) return { agendadas: 0 };

  const clienteIds = (clientes as Pick<ExternalClient, 'id'>[]).map((c) => c.id);

  const { data: contatos } = await sb
    .from('external_client_contacts')
    .select('id, external_client_id')
    .in('external_client_id', clienteIds)
    .eq('ativo', true)
    .eq('receber_solicitacoes', true);

  if (!contatos || contatos.length === 0) return { agendadas: 0 };

  const typedContatos = contatos as Pick<
    ExternalClientContact,
    'id' | 'external_client_id'
  >[];

  // Idempotência: evita duplicar se já tem solicitação nesta competência
  const { data: existentes } = await sb
    .from('solicitacoes_documentos')
    .select('contact_id, competencia')
    .in(
      'contact_id',
      typedContatos.map((c) => c.id),
    )
    .eq('competencia', competencia);

  const existSet = new Set(
    ((existentes ?? []) as { contact_id: string }[]).map((e) => e.contact_id),
  );

  const novos = typedContatos
    .filter((c) => !existSet.has(c.id))
    .map((c) => ({
      external_client_id: c.external_client_id,
      contact_id: c.id,
      competencia,
      template_nome: TEMPLATE_NAME,
      status: 'agendada' as const,
      agendada_para: new Date().toISOString(),
    }));

  if (novos.length === 0) return { agendadas: 0 };

  const { error } = await sb.from('solicitacoes_documentos').insert(novos);
  if (error) throw error;

  return { agendadas: novos.length };
}
