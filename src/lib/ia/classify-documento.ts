import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/service';
import { parseNFeXml } from '@/lib/nfe/parser';
import { calculateCost } from './pricing';
import { sendText } from '@/lib/whatsapp/send-template';
import { cleanCNPJ, formatCurrency } from '@/lib/format';
import type { DocStatus, DocTipo, Documento } from '@/lib/types';

const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';

const CLASSIFY_PROMPT = `Você classifica documentos enviados via WhatsApp para um escritório de contabilidade brasileiro.

Tipos possíveis:
- nfe: nota fiscal eletrônica (modelo 55) — XML ou DANFE PDF
- nfse: nota fiscal de serviço eletrônica (varia por município)
- nfce: nota fiscal ao consumidor (modelo 65)
- cte: conhecimento de transporte eletrônico
- comprovante: comprovante de pagamento, boleto pago, transferência
- recibo: recibo de pagamento manual
- contrato: contrato, aditivo, termo de uso
- outro: qualquer outro documento

Responda APENAS com JSON válido neste formato exato:
{
  "tipo": "nfe" | "nfse" | "nfce" | "cte" | "comprovante" | "recibo" | "contrato" | "outro",
  "confidence": 0.0-1.0,
  "reasoning": "explicação curta em pt-BR",
  "metadata": {
    "numero": "número do documento se aplicável",
    "cnpj_emitente": "CNPJ apenas dígitos",
    "cnpj_destinatario": "CNPJ apenas dígitos",
    "razao_social_emitente": "string",
    "razao_social_destinatario": "string",
    "data_emissao": "YYYY-MM-DD",
    "valor": número
  }
}

Use confidence ≥ 0.9 só se tiver certeza. Se for ambíguo, use confidence < 0.7 e tipo "outro".`;

export type ClassificationResult = {
  tipo: DocTipo;
  confidence: number;
  reasoning: string;
  metadata: Record<string, unknown>;
  chave_acesso_nfe: string | null;
  modelo_ia: string;
};

function isMockAnthropic() {
  return process.env.MOCK_ANTHROPIC === 'true' || !process.env.ANTHROPIC_API_KEY;
}

async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from('documentos').download(storagePath);
  if (error || !data) throw new Error(`download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function classifyXml(buffer: Buffer): Promise<ClassificationResult> {
  const parsed = parseNFeXml(buffer);
  return {
    tipo: parsed.tipo ?? 'outro',
    confidence: parsed.tipo ? 0.99 : 0.3,
    reasoning: parsed.tipo
      ? `XML parseado como ${parsed.tipo} (root: ${parsed.raw_root})`
      : `XML sem root conhecido (${parsed.raw_root})`,
    metadata: parsed.metadata as Record<string, unknown>,
    chave_acesso_nfe: parsed.chave_acesso_nfe,
    modelo_ia: 'xml_parser',
  };
}

function mockClassify(doc: Documento): ClassificationResult {
  // distribui mocks por nome de arquivo
  const f = (doc.filename_original ?? '').toLowerCase();
  let tipo: DocTipo = 'outro';
  let confidence = 0.85;
  if (f.includes('nfe') || f.includes('danfe')) {
    tipo = 'nfe';
    confidence = 0.95;
  } else if (f.includes('nfse') || f.includes('servico')) {
    tipo = 'nfse';
    confidence = 0.92;
  } else if (f.includes('comprov') || f.includes('boleto')) {
    tipo = 'comprovante';
    confidence = 0.9;
  } else if (f.includes('recibo')) {
    tipo = 'recibo';
    confidence = 0.85;
  } else if (f.includes('contrato')) {
    tipo = 'contrato';
    confidence = 0.85;
  }
  return {
    tipo,
    confidence,
    reasoning: 'Mock classification (MOCK_ANTHROPIC=true)',
    metadata: { numero: '123', valor: 1500.5 },
    chave_acesso_nfe: tipo === 'nfe' ? `${Date.now()}`.padStart(44, '0') : null,
    modelo_ia: 'mock',
  };
}

async function classifyWithAI(
  doc: Documento,
  buffer: Buffer,
): Promise<ClassificationResult> {
  if (isMockAnthropic()) return mockClassify(doc);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const isImage = doc.mime_type.startsWith('image/');
  const isPdf = doc.mime_type.includes('pdf');

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: 'Classifique este documento:' },
  ];

  if (isImage) {
    const mediaType = (
      doc.mime_type === 'image/jpg' ? 'image/jpeg' : doc.mime_type
    ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: buffer.toString('base64'),
      },
    });
  } else if (isPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: buffer.toString('base64'),
      },
    });
  } else {
    content.push({
      type: 'text',
      text: `Conteúdo (fallback texto): ${buffer.toString('utf8').slice(0, 5000)}`,
    });
  }

  async function callModel(model: string) {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 800,
      system: CLASSIFY_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    });

    const sb = createServiceClient();
    await sb.from('ai_usage').insert({
      modulo: 'docflow_classify',
      modelo: model,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      custo_usd: calculateCost(model, resp.usage.input_tokens, resp.usage.output_tokens),
      contexto: { documento_id: doc.id },
    });

    const textBlock = resp.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Modelo não retornou JSON');
    return JSON.parse(match[0]) as {
      tipo: DocTipo;
      confidence: number;
      reasoning: string;
      metadata: Record<string, unknown>;
    };
  }

  let result = await callModel(HAIKU);
  let modeloFinal = HAIKU;

  // Escala pra Sonnet se confidence baixa
  if (result.confidence < 0.75) {
    try {
      result = await callModel(SONNET);
      modeloFinal = SONNET;
    } catch {
      // mantém resultado do Haiku
    }
  }

  return {
    tipo: result.tipo,
    confidence: result.confidence,
    reasoning: result.reasoning,
    metadata: result.metadata,
    chave_acesso_nfe: null,
    modelo_ia: modeloFinal,
  };
}

function getBotResponseText(result: ClassificationResult): string {
  if (result.confidence >= 0.9) {
    if (result.tipo === 'nfe' || result.tipo === 'nfse' || result.tipo === 'nfce') {
      const numero = result.metadata.numero;
      const valor = result.metadata.valor;
      const partes: string[] = ['recebi sua nota'];
      if (numero) partes.push(`nº ${numero}`);
      if (valor) partes.push(`de ${formatCurrency(Number(valor))}`);
      return `${partes.join(' ')}. já estou processando pra escrituração.`;
    }
    if (result.tipo === 'cte') {
      return 'recebi seu CT-e. já vou processar pra escrituração.';
    }
    return `recebi seu ${result.tipo}. organizei aqui.`;
  }
  if (result.confidence >= 0.7) {
    return 'recebi. vou organizar e te aviso se precisar.';
  }
  return 'recebi, mas tive uma dúvida sobre o tipo. pode me dizer? é uma NF, comprovante ou outro tipo?';
}

export async function classifyDocument(documentoId: string): Promise<void> {
  const sb = createServiceClient();
  const { data: doc } = await sb
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single();

  if (!doc) return;
  const typedDoc = doc as Documento;

  await sb.from('documentos').update({ status: 'classificando' }).eq('id', documentoId);

  let result: ClassificationResult;
  try {
    const buffer = await downloadFromStorage(typedDoc.storage_path);
    if (typedDoc.mime_type.includes('xml')) {
      result = await classifyXml(buffer);
    } else {
      result = await classifyWithAI(typedDoc, buffer);
    }
  } catch (error) {
    await sb
      .from('documentos')
      .update({
        status: 'duvida',
        reasoning: `Erro na classificação: ${(error as Error).message}`,
      })
      .eq('id', documentoId);
    return;
  }

  // Duplicidade (NFe)
  if (result.chave_acesso_nfe) {
    const { data: existing } = await sb
      .from('documentos')
      .select('id')
      .eq('chave_acesso_nfe', result.chave_acesso_nfe)
      .neq('id', documentoId)
      .maybeSingle();

    if (existing) {
      await sb
        .from('documentos')
        .update({
          status: 'duplicado',
          chave_acesso_nfe: result.chave_acesso_nfe,
          tipo: result.tipo,
          confidence: result.confidence,
          metadata: result.metadata,
          reasoning: result.reasoning,
          modelo_ia: result.modelo_ia,
        })
        .eq('id', documentoId);

      if (typedDoc.remetente_phone) {
        await sendText({
          to: typedDoc.remetente_phone,
          text: 'recebi, mas esse documento já foi enviado antes. não vou duplicar.',
        });
      }
      return;
    }
  }

  // Identifica cliente pelo CNPJ destinatário
  let externalClientId = typedDoc.external_client_id;
  const cnpjDest = (result.metadata.cnpj_destinatario as string) || '';
  if (cnpjDest && !externalClientId) {
    const { data: client } = await sb
      .from('external_clients')
      .select('id')
      .eq('cnpj', cleanCNPJ(cnpjDest))
      .maybeSingle();
    if (client) externalClientId = (client as { id: string }).id;
  }

  const isFiscal = ['nfe', 'nfse', 'nfce', 'cte'].includes(result.tipo);
  const nextStatus: DocStatus = isFiscal ? 'pronto_envio' : 'sem_envio';

  await sb
    .from('documentos')
    .update({
      status: nextStatus,
      tipo: result.tipo,
      confidence: result.confidence,
      metadata: result.metadata,
      reasoning: result.reasoning,
      modelo_ia: result.modelo_ia,
      chave_acesso_nfe: result.chave_acesso_nfe,
      external_client_id: externalClientId,
    })
    .eq('id', documentoId);

  if (typedDoc.remetente_phone) {
    const text = getBotResponseText(result);
    const r = await sendText({ to: typedDoc.remetente_phone, text });
    await sb.from('bot_messages').insert({
      documento_id: documentoId,
      external_client_id: externalClientId,
      remetente_phone: typedDoc.remetente_phone,
      direcao: 'enviada',
      tipo: 'texto',
      conteudo: text,
      wa_message_id: r.ok ? r.messageId : null,
    });
  }

  // Upload OneDrive async
  const { uploadToOneDrive } = await import('@/lib/onedrive/upload');
  uploadToOneDrive(documentoId).catch((err) =>
     
    console.error('onedrive upload error', err),
  );
}
