import { createServiceClient } from '@/lib/supabase/service';
import { listFiles, downloadFile, type ScanFile } from '@/lib/onedrive/scan';
import { cleanCNPJ } from '@/lib/format';
import { getConfig } from '@/lib/config';
import { randomBytes } from 'node:crypto';
import type { ExternalClient } from '@/lib/types';

const GUIA_TIPOS = ['DARF', 'IRPJ', 'CSLL', 'PIS', 'COFINS', 'DAS', 'INSS', 'FGTS'] as const;
type GuiaTipo = (typeof GUIA_TIPOS)[number] | 'outro';

export type ParsedGuiaName = {
  cnpj: string | null;
  tipo: GuiaTipo;
  competencia: Date;
  vencimento: Date;
};

export function parseGuiaFilename(filename: string, fallbackCompetencia: Date): ParsedGuiaName {
  const cnpjMatch = filename.match(/(\d{2}\.?\d{3}\.?\d{3}[/\\]?\d{4}-?\d{2})/);
  const cnpj = cnpjMatch ? cleanCNPJ(cnpjMatch[1]) : null;

  const upper = filename.toUpperCase();
  let tipo: GuiaTipo = 'outro';
  for (const t of GUIA_TIPOS) {
    if (upper.includes(t)) {
      tipo = t;
      break;
    }
  }

  // Mês: 05-2026, 05_2026, Mai-26, etc
  const competencia = new Date(
    Date.UTC(fallbackCompetencia.getUTCFullYear(), fallbackCompetencia.getUTCMonth(), 1),
  );

  const ddmmaa = filename.match(/(\d{2})-(\d{4})/);
  if (ddmmaa) {
    competencia.setUTCMonth(parseInt(ddmmaa[1], 10) - 1);
    competencia.setUTCFullYear(parseInt(ddmmaa[2], 10));
  }

  // Vencimento default: 20 dias após competencia
  const vencimento = new Date(competencia);
  vencimento.setUTCDate(20);

  return { cnpj, tipo, competencia, vencimento };
}

function mockGuiaFiles(seed: number): ScanFile[] {
  const tipos = ['DARF', 'IRPJ', 'CSLL', 'DAS', 'INSS'];
  const cnpjs = [
    '12345678000190',
    '98765432000110',
    '11222333000144',
    '44555666000177',
    '77888999000122',
  ];
  const out: ScanFile[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const tipo = tipos[i % tipos.length];
    const cnpj = cnpjs[i % cnpjs.length];
    out.push({
      id: `mock-${seed}-${i}`,
      name: `${tipo}_${cnpj}_05-2026.pdf`,
      size: 12345,
    });
  }
  return out;
}

export async function scanWatchFolder(): Promise<{ files: ScanFile[] }> {
  const config = await getConfig();
  if (process.env.MOCK_DOMINIO_WATCH === 'true' || !config.dominio_watch_folder_path) {
    return { files: mockGuiaFiles(Date.now()) };
  }
  if (!config.onedrive_active) {
    return { files: [] };
  }
  const files = await listFiles(config.dominio_watch_folder_path);
  return { files: files.filter((f) => f.name.toLowerCase().endsWith('.pdf')) };
}

export async function runColeta(): Promise<{
  coleta_id: string;
  arquivos: number;
  guias: number;
  orfas: number;
}> {
  const sb = createServiceClient();
  const now = new Date();
  const competencia = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Cria coleta
  const { data: coleta } = await sb
    .from('coletas')
    .insert({
      competencia: competencia.toISOString().slice(0, 10),
      origem: process.env.MOCK_DOMINIO_WATCH === 'true' ? 'mock' : 'watch_folder',
      status: 'executando',
    })
    .select('id')
    .single();

  if (!coleta) throw new Error('Falha ao criar coleta');
  const coletaId = (coleta as { id: string }).id;

  try {
    const { files } = await scanWatchFolder();
    let totalGuias = 0;
    let totalOrfas = 0;
    const clientesIdentificados = new Set<string>();

    const { data: clientes } = await sb
      .from('external_clients')
      .select('id, cnpj, modo_envio_guias');
    const clienteByCnpj = new Map<string, Pick<ExternalClient, 'id' | 'modo_envio_guias'>>();
    ((clientes ?? []) as Pick<ExternalClient, 'id' | 'cnpj' | 'modo_envio_guias'>[]).forEach((c) =>
      clienteByCnpj.set(cleanCNPJ(c.cnpj), { id: c.id, modo_envio_guias: c.modo_envio_guias }),
    );

    for (const file of files) {
      const parsed = parseGuiaFilename(file.name, now);
      const cliente = parsed.cnpj ? clienteByCnpj.get(parsed.cnpj) : undefined;

      // Faz upload pro storage (mock: bytes vazios, real: download da URL)
      const storagePath = `${coletaId}/${randomBytes(4).toString('hex')}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      let buffer: Buffer = Buffer.alloc(0);
      if (process.env.MOCK_DOMINIO_WATCH !== 'true' && file.downloadUrl) {
        try {
          buffer = await downloadFile(file.downloadUrl);
        } catch {
          buffer = Buffer.alloc(0);
        }
      }

      if (buffer.byteLength > 0) {
        await sb.storage.from('guias').upload(storagePath, buffer, {
          contentType: 'application/pdf',
        });
      }

      const { data: guia } = await sb
        .from('guias')
        .insert({
          coleta_id: coletaId,
          external_client_id: cliente?.id ?? null,
          tipo: parsed.tipo === 'outro' ? 'outro' : parsed.tipo,
          competencia: parsed.competencia.toISOString().slice(0, 10),
          vencimento: parsed.vencimento.toISOString().slice(0, 10),
          valor: null,
          storage_path: storagePath,
          filename_original: file.name,
          cnpj_identificado: parsed.cnpj,
        })
        .select('id')
        .single();

      if (!guia) continue;
      totalGuias++;
      if (!cliente) {
        totalOrfas++;
      } else {
        clientesIdentificados.add(cliente.id);
        // Agenda envios pros contatos com receber_guias=true se o cliente tiver modo ativo
        if (cliente.modo_envio_guias === 'individual_automatico') {
          await agendarEnviosGuia((guia as { id: string }).id, cliente.id);
        }
      }
    }

    await sb
      .from('coletas')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        total_arquivos_processados: files.length,
        total_guias_extraidas: totalGuias,
        total_clientes_identificados: clientesIdentificados.size,
        total_orfas: totalOrfas,
      })
      .eq('id', coletaId);

    await sb
      .from('app_config')
      .update({ dominio_last_scan_at: new Date().toISOString() })
      .eq('id', 1);

    return {
      coleta_id: coletaId,
      arquivos: files.length,
      guias: totalGuias,
      orfas: totalOrfas,
    };
  } catch (error) {
    await sb
      .from('coletas')
      .update({
        status: 'erro',
        erro_mensagem: (error as Error).message,
        concluida_em: new Date().toISOString(),
      })
      .eq('id', coletaId);
    throw error;
  }
}

async function agendarEnviosGuia(guiaId: string, externalClientId: string) {
  const sb = createServiceClient();
  const { data: contatos } = await sb
    .from('external_client_contacts')
    .select('id')
    .eq('external_client_id', externalClientId)
    .eq('ativo', true)
    .eq('receber_guias', true);

  if (!contatos || contatos.length === 0) return;

  const envios = (contatos as { id: string }[]).map((c) => ({
    guia_id: guiaId,
    contact_id: c.id,
    status: 'pendente' as const,
    template_nome: 'guia_envio_inicial',
    agendada_para: new Date().toISOString(),
    numero_followup: 0,
  }));

  await sb.from('guia_envios').insert(envios);
}
