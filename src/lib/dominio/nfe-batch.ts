import { createServiceClient } from '@/lib/supabase/service';
import { importBatch } from './api-client';
import type { Documento, ExternalClient } from '@/lib/types';

const BATCH_SIZE = 50;

async function downloadFromStorage(storagePath: string): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from('documentos').download(storagePath);
  if (error || !data) throw new Error(`download falhou: ${error?.message}`);
  return await data.text();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function processEscrituracaoQueue(): Promise<{
  batches_created: number;
  documentos_processados: number;
}> {
  const sb = createServiceClient();

  const { data: pendentes } = await sb
    .from('documentos')
    .select(
      'id, external_client_id, tipo, storage_path, chave_acesso_nfe, recebido_em',
    )
    .eq('status', 'pronto_envio')
    .in('tipo', ['nfe', 'nfse', 'nfce', 'cte'])
    .not('external_client_id', 'is', null)
    .order('recebido_em')
    .limit(500);

  if (!pendentes || pendentes.length === 0) {
    return { batches_created: 0, documentos_processados: 0 };
  }

  const typed = pendentes as Pick<
    Documento,
    'id' | 'external_client_id' | 'tipo' | 'storage_path' | 'chave_acesso_nfe' | 'recebido_em'
  >[];

  const porCliente = new Map<string, typeof typed>();
  for (const d of typed) {
    const key = d.external_client_id ?? '';
    if (!key) continue;
    if (!porCliente.has(key)) porCliente.set(key, []);
    porCliente.get(key)!.push(d);
  }

  let batches = 0;
  let processados = 0;

  for (const [clienteId, docs] of porCliente) {
    for (const grupo of chunk(docs, BATCH_SIZE)) {
      await processSingleBatch(clienteId, grupo);
      batches++;
      processados += grupo.length;
    }
  }

  return { batches_created: batches, documentos_processados: processados };
}

async function processSingleBatch(
  clienteId: string,
  docs: Pick<
    Documento,
    'id' | 'storage_path' | 'chave_acesso_nfe' | 'tipo'
  >[],
) {
  const sb = createServiceClient();

  const { data: batch } = await sb
    .from('escrituracao_batches')
    .insert({
      external_client_id: clienteId,
      total_documentos: docs.length,
      status: 'enviando',
    })
    .select('id')
    .single();

  if (!batch) return;
  const batchId = (batch as { id: string }).id;

  await sb
    .from('documentos')
    .update({ status: 'enviando_dominio', batch_id: batchId })
    .in(
      'id',
      docs.map((d) => d.id),
    );

  let codigoEmpresa: string | null = null;
  const { data: client } = await sb
    .from('external_clients')
    .select('dominio_codigo_empresa')
    .eq('id', clienteId)
    .maybeSingle();
  if (client) {
    codigoEmpresa = (client as Pick<ExternalClient, 'dominio_codigo_empresa'>).dominio_codigo_empresa;
  }

  try {
    const xmlsPromises = docs.map(async (d) => {
      try {
        const content = await downloadFromStorage(d.storage_path);
        return { chave: d.chave_acesso_nfe, xml_content: content };
      } catch {
        return { chave: d.chave_acesso_nfe, xml_content: '' };
      }
    });
    const arquivos = await Promise.all(xmlsPromises);

    const response = await importBatch({
      cliente_codigo: codigoEmpresa,
      arquivos,
    });

    let sucessos = 0;
    let erros = 0;
    let duplicados = 0;

    for (let i = 0; i < docs.length; i++) {
      const result = response.results[i];
      if (!result) continue;
      const updatePatch: Record<string, unknown> = {
        dominio_response: result,
        escrituracao_erro: result.error ?? null,
      };
      if (result.status === 'success') {
        updatePatch.status = 'escriturado';
        updatePatch.escriturado = true;
        updatePatch.escriturado_em = new Date().toISOString();
        updatePatch.escriturado_via = 'api_dominio';
        sucessos++;
      } else if (result.status === 'duplicate') {
        updatePatch.status = 'duplicado';
        duplicados++;
      } else {
        updatePatch.status = 'erro_dominio';
        erros++;
      }
      await sb.from('documentos').update(updatePatch).eq('id', docs[i].id);
    }

    await sb
      .from('escrituracao_batches')
      .update({
        status: 'concluido',
        concluido_em: new Date().toISOString(),
        sucessos,
        erros,
        duplicados,
        dominio_response: { batch_id: response.batch_id },
      })
      .eq('id', batchId);
  } catch (error) {
    await sb
      .from('escrituracao_batches')
      .update({
        status: 'erro_total',
        erro_mensagem: (error as Error).message,
      })
      .eq('id', batchId);

    await sb
      .from('documentos')
      .update({
        status: 'erro_dominio',
        escrituracao_erro: (error as Error).message,
      })
      .in(
        'id',
        docs.map((d) => d.id),
      );
  }
}
