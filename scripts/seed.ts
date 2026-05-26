import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('seed: começando...');

  // ===== USER =====
  const DEMO_EMAIL = 'demo@contabilliza.com';
  const DEMO_PASSWORD = 'demo12345';

  // tenta encontrar
  const { data: users } = await sb.auth.admin.listUsers();
  let userId = users?.users.find((u) => u.email === DEMO_EMAIL)?.id;

  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error('user create error:', error);
    } else {
      userId = data.user?.id;
      console.log(`user criado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    }
  } else {
    console.log(`user já existe: ${DEMO_EMAIL}`);
  }

  // ===== CLIENTES =====
  const clientesSeed = [
    {
      cnpj: '12345678000190',
      razao_social: 'Padaria do Bairro Ltda',
      nome_fantasia: 'Padaria do Bairro',
      dia_solicitacao: 5,
      dominio_codigo_empresa: '1001',
    },
    {
      cnpj: '98765432000110',
      razao_social: 'Auto Peças Silva ME',
      nome_fantasia: 'Auto Peças Silva',
      dia_solicitacao: 10,
      dominio_codigo_empresa: '1002',
    },
    {
      cnpj: '11222333000144',
      razao_social: 'Café Cantinho Ltda',
      nome_fantasia: 'Café Cantinho',
      dia_solicitacao: 8,
      dominio_codigo_empresa: '1003',
    },
    {
      cnpj: '44555666000177',
      razao_social: 'Salão Beleza Pura ME',
      nome_fantasia: 'Beleza Pura',
      dia_solicitacao: 5,
      dominio_codigo_empresa: '1004',
    },
    {
      cnpj: '77888999000122',
      razao_social: 'Mercado Vila Boa Ltda',
      nome_fantasia: 'Mercado Vila Boa',
      dia_solicitacao: 15,
      dominio_codigo_empresa: '1005',
    },
  ];

  const { data: clientesData, error: cliErr } = await sb
    .from('external_clients')
    .upsert(clientesSeed, { onConflict: 'cnpj' })
    .select('id, cnpj, razao_social');
  if (cliErr) {
    console.error('clientes error:', cliErr);
    return;
  }
  console.log(`${clientesData?.length ?? 0} clientes`);

  // ===== CONTATOS =====
  type Cli = { id: string; cnpj: string; razao_social: string };
  const clientes = (clientesData ?? []) as Cli[];
  const cliByCnpj = new Map(clientes.map((c) => [c.cnpj, c]));

  const contatosSeed = [
    { cnpj: '12345678000190', nome: 'Maria Padaria', papel: 'dono', whatsapp: '5517999000001', receber_solicitacoes: true },
    { cnpj: '12345678000190', nome: 'João Padeiro', papel: 'financeiro', whatsapp: '5517999000002' },
    { cnpj: '98765432000110', nome: 'Carlos Silva', papel: 'dono', whatsapp: '5517999000003', receber_solicitacoes: true },
    { cnpj: '98765432000110', nome: 'Ana Caixa', papel: 'financeiro', whatsapp: '5517999000004' },
    { cnpj: '11222333000144', nome: 'Roberto Café', papel: 'dono', whatsapp: '5517999000005', receber_solicitacoes: true },
    { cnpj: '44555666000177', nome: 'Beatriz Beleza', papel: 'dono', whatsapp: '5517999000006', receber_solicitacoes: true },
    { cnpj: '44555666000177', nome: 'Marcia Recepção', papel: 'recepção', whatsapp: '5517999000007' },
    { cnpj: '77888999000122', nome: 'Pedro Mercado', papel: 'dono', whatsapp: '5517999000008', receber_solicitacoes: true },
    { cnpj: '77888999000122', nome: 'Lucia Financeiro', papel: 'financeiro', whatsapp: '5517999000009' },
    { cnpj: '77888999000122', nome: 'Tales Estoque', papel: 'estoque', whatsapp: '5517999000010' },
  ];

  await sb.from('external_client_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const contatosRows = contatosSeed
    .map((c) => {
      const cli = cliByCnpj.get(c.cnpj);
      if (!cli) return null;
      return {
        external_client_id: cli.id,
        nome: c.nome,
        papel: c.papel,
        whatsapp: c.whatsapp,
        ativo: true,
        receber_guias: true,
        receber_solicitacoes: c.receber_solicitacoes ?? false,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const { data: contatosData, error: contErr } = await sb
    .from('external_client_contacts')
    .insert(contatosRows)
    .select('id, external_client_id');
  if (contErr) console.error('contatos error:', contErr);
  else console.log(`${contatosData?.length ?? 0} contatos`);

  // ===== DOCUMENTOS (mock) =====
  await sb.from('bot_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('documentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const padaria = cliByCnpj.get('12345678000190');
  const mercado = cliByCnpj.get('77888999000122');

  const docsSeed = [
    {
      external_client_id: padaria?.id ?? null,
      remetente_phone: '5517999000001',
      storage_path: 'seed/nfe_padaria_001.xml',
      mime_type: 'application/xml',
      filename_original: 'NFe_padaria_12345.xml',
      file_size_bytes: 12345,
      status: 'escriturado',
      tipo: 'nfe',
      confidence: 0.99,
      metadata: { numero: '12345', valor: 1250.5, cnpj_destinatario: '12345678000190' },
      reasoning: 'XML parseado como NFe',
      modelo_ia: 'xml_parser',
      chave_acesso_nfe: '35251212345678000190550010000123451234567890',
      escriturado: true,
      escriturado_em: new Date().toISOString(),
      escriturado_via: 'api_dominio',
    },
    {
      external_client_id: mercado?.id ?? null,
      remetente_phone: '5517999000008',
      storage_path: 'seed/comprovante_001.pdf',
      mime_type: 'application/pdf',
      filename_original: 'comprovante_pagamento.pdf',
      file_size_bytes: 80000,
      status: 'sem_envio',
      tipo: 'comprovante',
      confidence: 0.92,
      metadata: { valor: 350 },
      reasoning: 'Identificado como comprovante de pagamento',
      modelo_ia: 'claude-haiku-4-5',
    },
    {
      external_client_id: null,
      remetente_phone: '5517888777666',
      storage_path: 'seed/contrato_001.pdf',
      mime_type: 'application/pdf',
      filename_original: 'contrato_servico.pdf',
      file_size_bytes: 200000,
      status: 'duvida',
      tipo: 'outro',
      confidence: 0.55,
      reasoning: 'Documento ambíguo, modelo não conseguiu classificar com alta confiança',
      modelo_ia: 'claude-haiku-4-5',
    },
    {
      external_client_id: padaria?.id ?? null,
      remetente_phone: '5517999000001',
      storage_path: 'seed/nfe_002.xml',
      mime_type: 'application/xml',
      filename_original: 'NFe_padaria_67890.xml',
      file_size_bytes: 12000,
      status: 'pronto_envio',
      tipo: 'nfe',
      confidence: 0.99,
      metadata: { numero: '67890', valor: 870.25, cnpj_destinatario: '12345678000190' },
      reasoning: 'XML parseado como NFe',
      modelo_ia: 'xml_parser',
      chave_acesso_nfe: '35251212345678000190550010000678901234567890',
    },
  ];

  const { error: docErr } = await sb.from('documentos').insert(docsSeed);
  if (docErr) console.error('docs error:', docErr);
  else console.log(`${docsSeed.length} documentos`);

  // ===== COLETA + GUIAS =====
  await sb.from('guia_envios').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('guias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('coletas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const now = new Date();
  const comp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const venc20 = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-20`;

  const { data: coleta } = await sb
    .from('coletas')
    .insert({
      competencia: comp,
      origem: 'mock',
      status: 'concluida',
      total_arquivos_processados: 12,
      total_guias_extraidas: 12,
      total_clientes_identificados: 4,
      total_orfas: 2,
      concluida_em: new Date().toISOString(),
    })
    .select('id')
    .single();

  const coletaId = (coleta as { id: string } | null)?.id ?? null;

  const tipos = ['DARF', 'IRPJ', 'CSLL', 'DAS', 'INSS'];
  const guiaSeeds: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 12; i++) {
    const cliente = i < 10 ? clientes[i % clientes.length] : null;
    guiaSeeds.push({
      coleta_id: coletaId,
      external_client_id: cliente?.id ?? null,
      tipo: tipos[i % tipos.length],
      competencia: comp,
      vencimento: venc20,
      valor: 100 + i * 50,
      storage_path: `seed/guia_${i}.pdf`,
      filename_original: `${tipos[i % tipos.length]}_${cliente?.cnpj ?? '00000000000000'}_${String(now.getUTCMonth() + 1).padStart(2, '0')}-${now.getUTCFullYear()}.pdf`,
      cnpj_identificado: cliente?.cnpj ?? null,
    });
  }

  const { data: guias, error: guiasErr } = await sb
    .from('guias')
    .insert(guiaSeeds)
    .select('id, external_client_id');

  if (guiasErr) console.error('guias error:', guiasErr);
  else console.log(`${guias?.length ?? 0} guias`);

  // ===== GUIA ENVIOS =====
  const contatosList = (contatosData ?? []) as { id: string; external_client_id: string }[];
  const envios: Array<Record<string, unknown>> = [];
  const statuses = ['pendente', 'enviado', 'entregue', 'lido', 'erro'];
  const guiasArr = (guias ?? []) as { id: string; external_client_id: string | null }[];

  for (const g of guiasArr) {
    if (!g.external_client_id) continue;
    const cs = contatosList.filter((c) => c.external_client_id === g.external_client_id);
    for (let i = 0; i < cs.length; i++) {
      const status = statuses[(envios.length + i) % statuses.length];
      const enviadoAt = status !== 'pendente' ? new Date().toISOString() : null;
      envios.push({
        guia_id: g.id,
        contact_id: cs[i].id,
        status,
        template_nome: 'guia_envio_inicial',
        agendada_para: new Date().toISOString(),
        enviado_at: enviadoAt,
        entregue_at: ['entregue', 'lido'].includes(status) ? enviadoAt : null,
        lido_at: status === 'lido' ? enviadoAt : null,
        erro_mensagem: status === 'erro' ? 'Mock: número não encontrado' : null,
      });
    }
  }

  if (envios.length > 0) {
    const { error: envErr } = await sb.from('guia_envios').insert(envios);
    if (envErr) console.error('envios error:', envErr);
    else console.log(`${envios.length} envios`);
  }

  // ===== SOLICITAÇÕES =====
  await sb.from('solicitacoes_documentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const solRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < Math.min(3, clientes.length); i++) {
    const cli = clientes[i];
    const ct = contatosList.find((c) => c.external_client_id === cli.id);
    if (!ct) continue;
    solRows.push({
      external_client_id: cli.id,
      contact_id: ct.id,
      competencia: comp,
      template_nome: 'docs_solicitacao_mensal',
      status: ['agendada', 'enviada', 'respondida'][i],
      agendada_para: new Date().toISOString(),
      enviada_at: i > 0 ? new Date().toISOString() : null,
      respondida_at: i === 2 ? new Date().toISOString() : null,
    });
  }
  if (solRows.length > 0) {
    const { error: solErr } = await sb.from('solicitacoes_documentos').insert(solRows);
    if (solErr) console.error('sol error:', solErr);
    else console.log(`${solRows.length} solicitações`);
  }

  console.log('seed: pronto');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
