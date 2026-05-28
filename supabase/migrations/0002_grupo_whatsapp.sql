-- ============================================================
-- Envio assistido em grupos do WhatsApp (via helper local Playwright)
-- ============================================================

alter table external_clients
  add column if not exists grupo_whatsapp_nome text;

alter table guias
  add column if not exists link_publico_url text,
  add column if not exists link_publico_expira_at timestamptz;

create index if not exists guias_link_publico_expira_idx
  on guias(link_publico_expira_at)
  where link_publico_url is not null;
