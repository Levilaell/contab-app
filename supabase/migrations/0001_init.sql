-- ============================================================
-- Contab-app: schema inicial (single-tenant: Contabilliza)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- app_config (linha única — single-tenant)
-- ============================================================

create table app_config (
  id int primary key default 1 check (id = 1),
  nome_escritorio text not null default 'Contabilliza',
  contact_email text,

  wa_phone_number_id text,
  wa_access_token_encrypted text,
  wa_business_account_id text,
  wa_webhook_verify_token text,
  wa_active boolean default false,

  dominio_api_key_encrypted text,
  dominio_integration_id text,
  dominio_active boolean default false,

  dominio_watch_folder_path text,
  dominio_watch_active boolean default false,
  dominio_last_scan_at timestamptz,

  onedrive_user_id text,
  onedrive_refresh_token_encrypted text,
  onedrive_root_folder_id text,
  onedrive_active boolean default false,

  updated_at timestamptz default now()
);

insert into app_config (id, nome_escritorio)
  values (1, 'Contabilliza')
  on conflict (id) do nothing;

-- ============================================================
-- external_clients + contacts
-- ============================================================

create table external_clients (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  razao_social text not null,
  nome_fantasia text,
  ativo boolean default true,

  solicitar_documentos boolean default true,
  dia_solicitacao int default 5 check (dia_solicitacao between 1 and 28),

  modo_envio_guias text default 'individual_automatico'
    check (modo_envio_guias in ('individual_automatico', 'desativado')),

  dominio_codigo_empresa text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on external_clients(ativo);
create index on external_clients(cnpj);

create table external_client_contacts (
  id uuid primary key default gen_random_uuid(),
  external_client_id uuid references external_clients(id) on delete cascade not null,

  nome text not null,
  papel text default 'outro',
  whatsapp text not null,
  email text,

  ativo boolean default true,
  receber_guias boolean default true,
  receber_solicitacoes boolean default false,
  ordem int default 0,

  created_at timestamptz default now()
);

create index on external_client_contacts(external_client_id);
create index on external_client_contacts(whatsapp);

-- ============================================================
-- DocFlow
-- ============================================================

create table solicitacoes_documentos (
  id uuid primary key default gen_random_uuid(),
  external_client_id uuid references external_clients(id) not null,
  contact_id uuid references external_client_contacts(id) not null,

  competencia date not null,
  template_nome text not null,

  status text default 'agendada'
    check (status in ('agendada', 'enviada', 'respondida', 'erro', 'cancelada')),
  agendada_para timestamptz not null,
  enviada_at timestamptz,
  respondida_at timestamptz,
  wa_message_id text,
  erro_mensagem text,

  documentos_recebidos_count int default 0,

  created_at timestamptz default now()
);

create index on solicitacoes_documentos(agendada_para) where status = 'agendada';
create index on solicitacoes_documentos(external_client_id, competencia);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  external_client_id uuid references external_clients(id),
  contact_id uuid references external_client_contacts(id),
  solicitacao_id uuid references solicitacoes_documentos(id),

  remetente_phone text not null,
  remetente_nome text,
  wa_message_id text,
  recebido_em timestamptz default now(),

  storage_path text not null,
  mime_type text not null,
  filename_original text,
  file_size_bytes int,
  sha256 text,

  status text default 'recebido' check (status in (
    'recebido', 'classificando', 'classificado', 'duvida',
    'pronto_envio', 'enviando_dominio', 'escriturado',
    'duplicado', 'erro_dominio', 'sem_envio'
  )),
  tipo text check (tipo is null or tipo in (
    'nfe', 'nfse', 'nfce', 'cte', 'comprovante',
    'recibo', 'contrato', 'outro'
  )),
  confidence float,
  metadata jsonb,
  reasoning text,
  modelo_ia text,

  chave_acesso_nfe text unique,

  batch_id uuid,
  escriturado boolean default false,
  escriturado_em timestamptz,
  escriturado_via text check (
    escriturado_via is null or escriturado_via in ('api_dominio', 'manual')
  ),
  dominio_response jsonb,
  escrituracao_erro text,

  onedrive_file_id text,
  onedrive_path text,
  onedrive_uploaded_at timestamptz,
  onedrive_erro text,

  revisado_por uuid references auth.users(id),
  revisado_em timestamptz,
  reclassificado boolean default false,
  classificacao_original jsonb,

  created_at timestamptz default now()
);

create index on documentos(recebido_em desc);
create index on documentos(external_client_id, recebido_em desc);
create index on documentos(status)
  where status in ('recebido', 'classificando', 'duvida', 'pronto_envio');
create index on documentos(remetente_phone);
create index on documentos(batch_id) where batch_id is not null;

create table escrituracao_batches (
  id uuid primary key default gen_random_uuid(),
  external_client_id uuid references external_clients(id) not null,

  total_documentos int default 0,
  sucessos int default 0,
  erros int default 0,
  duplicados int default 0,

  status text default 'preparando'
    check (status in ('preparando', 'enviando', 'concluido', 'erro_total')),

  iniciado_em timestamptz default now(),
  concluido_em timestamptz,

  dominio_response jsonb,
  erro_mensagem text,

  created_at timestamptz default now()
);

create index on escrituracao_batches(status, iniciado_em);

create table bot_messages (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references documentos(id),
  solicitacao_id uuid references solicitacoes_documentos(id),
  external_client_id uuid references external_clients(id),
  remetente_phone text not null,

  direcao text not null check (direcao in ('recebida', 'enviada')),
  tipo text default 'texto',
  conteudo text,
  wa_message_id text,

  created_at timestamptz default now()
);

create index on bot_messages(remetente_phone, created_at desc);

-- ============================================================
-- GuiaFlow
-- ============================================================

create table coletas (
  id uuid primary key default gen_random_uuid(),
  competencia date not null,
  origem text default 'watch_folder'
    check (origem in ('watch_folder', 'manual_upload', 'mock')),

  status text default 'pendente'
    check (status in ('pendente', 'executando', 'concluida', 'erro')),
  total_arquivos_processados int default 0,
  total_guias_extraidas int default 0,
  total_clientes_identificados int default 0,
  total_orfas int default 0,

  iniciada_em timestamptz default now(),
  concluida_em timestamptz,
  erro_mensagem text,

  created_at timestamptz default now()
);

create index on coletas(competencia);
create index on coletas(status);

create table guias (
  id uuid primary key default gen_random_uuid(),
  coleta_id uuid references coletas(id),
  external_client_id uuid references external_clients(id),

  tipo text not null check (tipo in (
    'DARF', 'IRPJ', 'CSLL', 'PIS', 'COFINS', 'DAS',
    'INSS', 'FGTS', 'outro'
  )),
  competencia date not null,
  vencimento date not null,
  valor decimal(12,2),

  storage_path text not null,
  filename_original text,
  cnpj_identificado text,

  created_at timestamptz default now()
);

create index on guias(competencia);
create index on guias(external_client_id);
create index on guias(vencimento) where external_client_id is not null;

create table guia_envios (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid references guias(id) on delete cascade not null,
  contact_id uuid references external_client_contacts(id) on delete cascade not null,

  status text default 'pendente' check (status in (
    'pendente', 'enviando', 'enviado', 'entregue', 'lido',
    'erro', 'cancelado'
  )),
  template_nome text not null,
  agendada_para timestamptz default now(),
  enviado_at timestamptz,
  entregue_at timestamptz,
  lido_at timestamptz,
  respondido_at timestamptz,

  wa_message_id text,
  erro_mensagem text,

  numero_followup int default 0,
  followup_dias_apos int,
  cancelado_motivo text,

  created_at timestamptz default now()
);

create index on guia_envios(guia_id);
create index on guia_envios(contact_id);
create index on guia_envios(status, enviado_at);
create index on guia_envios(agendada_para) where status = 'pendente';

-- ============================================================
-- AI usage
-- ============================================================

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  modelo text not null,

  input_tokens int,
  output_tokens int,
  custo_usd decimal(10,6),

  contexto jsonb,
  created_at timestamptz default now()
);

create index on ai_usage(created_at desc);

-- ============================================================
-- Storage buckets
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('guias', 'guias', false, 10485760, array['application/pdf']),
  ('documentos', 'documentos', false, 104857600, array[
    'application/pdf', 'application/xml', 'text/xml',
    'image/jpeg', 'image/png', 'image/webp'
  ])
on conflict (id) do nothing;

-- ============================================================
-- RLS — single-tenant: authenticated pode tudo
-- (service role bypassa, então API routes usam service client)
-- ============================================================

alter table app_config enable row level security;
alter table external_clients enable row level security;
alter table external_client_contacts enable row level security;
alter table solicitacoes_documentos enable row level security;
alter table documentos enable row level security;
alter table escrituracao_batches enable row level security;
alter table bot_messages enable row level security;
alter table coletas enable row level security;
alter table guias enable row level security;
alter table guia_envios enable row level security;
alter table ai_usage enable row level security;

create policy "authenticated_all_app_config" on app_config
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_external_clients" on external_clients
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_external_client_contacts" on external_client_contacts
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_solicitacoes_documentos" on solicitacoes_documentos
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_documentos" on documentos
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_escrituracao_batches" on escrituracao_batches
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_bot_messages" on bot_messages
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_coletas" on coletas
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_guias" on guias
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_guia_envios" on guia_envios
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_ai_usage" on ai_usage
  for all to authenticated using (true) with check (true);

create policy "authenticated_storage_all" on storage.objects
  for all to authenticated
  using (bucket_id in ('guias', 'documentos'))
  with check (bucket_id in ('guias', 'documentos'));

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table documentos;
alter publication supabase_realtime add table guia_envios;
alter publication supabase_realtime add table coletas;
alter publication supabase_realtime add table escrituracao_batches;
alter publication supabase_realtime add table solicitacoes_documentos;
