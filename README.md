# contab-app

Single-tenant — DocFlow (recepção+IA+escrituração+OneDrive) + GuiaFlow (coleta+envio multi-contato).

Stack: Next 16 (App Router, `proxy.ts`) · TypeScript · Tailwind v4 · shadcn (Base UI) · Supabase (ssr+service) · Anthropic SDK · Microsoft Graph + msal-node · fast-xml-parser · @react-pdf/renderer.

## Passo 0 — Env vars OBRIGATÓRIAS antes de `pnpm dev`

Sem esses 4, o app **não sobe** (proxy quebra ou Settings explode no primeiro salvar):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=          # openssl rand -base64 32
```

Copia `.env.example` → `.env.local` e preenche. `ENCRYPTION_KEY` é exigido até no fluxo mock (qualquer encrypt() chama).

## Pré-requisitos

1. Supabase project: `wvvfikpfwpkzynloauvv`.
2. Aplica migration **com drop schema antes** (sprint pediu reset total):
   ```sql
   -- no SQL editor do Supabase
   drop schema public cascade;
   create schema public;
   grant all on schema public to postgres, anon, authenticated, service_role;
   -- depois cola o conteúdo de supabase/migrations/0001_init.sql
   ```
   Ou via Supabase CLI:
   ```bash
   supabase link --project-ref wvvfikpfwpkzynloauvv
   supabase db reset    # drop + recreate
   supabase db push     # aplica 0001_init.sql
   ```
3. `pnpm install`
4. Preenche `.env.local` (ver Passo 0). Em dev, mocks ficam `true` — não precisa credencial real de WhatsApp/Domínio/OneDrive/Anthropic.
5. Seed:
   ```bash
   pnpm seed
   ```
6. Sobe:
   ```bash
   pnpm dev
   ```
7. Login: `demo@contabilliza.com` / `demo12345`

## Comandos

| comando | descrição |
| --- | --- |
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm typecheck` | TS sem build |
| `pnpm lint` | ESLint |
| `pnpm build` | build produção |
| `pnpm seed` | popula clientes, contatos, docs, guias mock |
| `pnpm check-db` | conta linhas de cada tabela |
| `pnpm encrypt` | criptografa um valor para colar manualmente no banco |

## Estrutura

```
src/
  app/
    (public)/login/          # Supabase auth
    (app)/                   # tudo atrás de auth
      dashboard/
      clientes/              # CRUD + CSV importer
      documentos/            # DocFlow
        solicitacoes/        # solicitações mensais
        escrituracao/        # batches Domínio
        [id]/                # detalhe + ações
      guias/                 # GuiaFlow
        coletas/             # histórico watch folder
        [id]/                # timeline + PDF prova
      settings/
        whatsapp/  dominio/  onedrive/
    api/
      webhook/whatsapp/      # GET verify + POST messages
      oauth/onedrive/        # start + callback
      cron/                  # solicitacoes / envia-mensagens / escrituracao / watch-folder
      guias/[id]/pdf/        # PDF prova de envio
  components/
    layout/    clientes/    documentos/    guias/    ui/ (shadcn Base UI)
  lib/
    supabase/{client,server,service}
    auth/                    # requireUser, getUser
    crypto/                  # AES-256-GCM
    format/                  # CNPJ, valor, telefone, competência BR
    config/                  # leitura cached do app_config (single-tenant)
    whatsapp/                # cloud-api, send-template, download-media, receive-webhook
    dominio/                 # api-client (NFe batch), nfe-batch, watch-folder
    onedrive/                # auth (msal), client (Graph), upload, scan
    ia/                      # classify-documento (Haiku→Sonnet), pricing
    nfe/                     # parser XML (NFe/CTe/NFSe heurística)
    solicitacoes/            # scheduler diário + sender hourly
    pdf/                     # prova de envio (@react-pdf/renderer)
    cron/auth                # Bearer ${CRON_SECRET}
  proxy.ts                   # Next 16 — auth refresh + guard /login
```

## Fluxos

**DocFlow (mensagem com documento → escriturado + OneDrive):**
1. Cliente manda doc no WhatsApp → Meta dispara `POST /api/webhook/whatsapp`
2. `processReceivedMessage` salva em `bot_messages`, marca solicitação `respondida`, cancela follow-ups
3. Se for arquivo: baixa via `download-media`, sobe pro bucket `documentos`, cria linha em `documentos` status=`recebido`
4. Dispara `classifyDocument` em background:
   - XML → `parseNFeXml` (sem IA)
   - PDF/imagem → Haiku, escala pra Sonnet se confiança < 0.75
   - Verifica duplicidade por chave NFe
   - Identifica cliente pelo CNPJ destinatário
   - Status final: `pronto_envio` (fiscal) ou `sem_envio` (outros)
   - Bot responde no WhatsApp com texto adaptado à confiança
5. `uploadToOneDrive` (background): cria pastas `Contabilliza/[razão]/[AAAA-MM]/[Tipo]/` e sobe
6. Cron `escrituracao` (hourly): agrupa `pronto_envio` por cliente, envia em batches de 50 pra Domínio, atualiza status individual

**GuiaFlow (coleta → envio multi-contato):**
1. Cron `watch-folder` (hourly): `scanWatchFolder` lista PDFs do OneDrive (ou gera mock)
2. Pra cada PDF: parsea nome (CNPJ + tipo), faz download, sobe bucket `guias`, cria linha em `guias`
3. Se cliente identificado + `modo_envio_guias=individual_automatico`: cria `guia_envios` pendentes pra cada contato `receber_guias=true`
4. Cron `envia-mensagens` (hourly): processa `guia_envios` + `solicitacoes_documentos` agendados
5. Webhook do WhatsApp atualiza `entregue_at`/`lido_at` por `wa_message_id`
6. Quando cliente responde, `guia_envios` pendentes daquele contato são cancelados (`cancelado_motivo=cliente_respondeu`)
7. `/guias/[id]` mostra timeline + botão "Exportar prova" → PDF

## Mocks

Por padrão todos os mocks ficam `true` em dev pra você poder clicar tudo sem credencial real. Em produção, mude pra `false`.

| env var | função |
| --- | --- |
| `MOCK_WHATSAPP` | `sendTemplate`/`sendText`/`downloadMedia` retornam fake |
| `MOCK_ANTHROPIC` | `classifyWithAI` decide tipo pelo nome do arquivo (sem chamar API) |
| `MOCK_DOMINIO_API` | `importBatch` retorna 90% sucesso, 5% duplicado, 5% erro |
| `MOCK_DOMINIO_WATCH` | `scanWatchFolder` gera 12 PDFs fake |
| `MOCK_ONEDRIVE` | OAuth e upload simulados |

## Crons (vercel.json)

| path | schedule | descrição |
| --- | --- | --- |
| `/api/cron/solicitacoes` | `0 8 * * *` | agenda solicitações dos clientes do dia |
| `/api/cron/envia-mensagens` | `0 * * * *` | envia tudo `agendada/pendente` cuja `agendada_para <= now` |
| `/api/cron/escrituracao` | `30 * * * *` | manda lotes de NFe pro Domínio |
| `/api/cron/watch-folder` | `15 * * * *` | scan + coleta de guias |

Todos exigem `Authorization: Bearer ${CRON_SECRET}`.

> Hourly cron exige Vercel **Pro**. Em Hobby, ajuste pra diário ou rode manualmente via UI.

## Como ativar prod real

### WhatsApp Cloud API
1. Crie um app Meta Business → adicione produto WhatsApp.
2. Em `/settings/whatsapp`:
   - Cole `Phone Number ID`, `Business Account ID`, `Access Token` (permanente).
   - Salve → o sistema gera um `verify_token`.
3. No Meta Dashboard → Webhooks: subscribe a `messages` apontando para `https://seudominio.com/api/webhook/whatsapp` com o `verify_token` do passo 2.
4. Crie e submeta os templates UTILITY (ver PENDENCIAS).
5. `MOCK_WHATSAPP=false`. Defina `WHATSAPP_APP_SECRET` (em App Settings → Basic).

### Domínio Sistemas
1. Solicite credenciais REST com o Domínio (Integration ID + API Key).
2. Em `/settings/dominio`: cole as credenciais e ative.
3. `MOCK_DOMINIO_API=false`.
4. Watch folder: aponte `dominio_watch_folder_path` para a pasta do OneDrive onde o Domínio salva PDFs.

### OneDrive
1. Crie app no Microsoft Entra (Azure AD) com OAuth confidential client.
2. Redirect URI: `https://seudominio.com/api/oauth/onedrive/callback`.
3. Permissions delegated: `Files.ReadWrite`, `User.Read`, `offline_access`.
4. Em `.env`: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`.
5. `MOCK_ONEDRIVE=false`.
6. Em `/settings/onedrive` → "Conectar OneDrive" → fluxo OAuth.

### Anthropic
1. `ANTHROPIC_API_KEY=sk-ant-...`
2. `MOCK_ANTHROPIC=false`.

## Deploy Vercel

```bash
vercel link    # liga ao project existente
vercel env pull
vercel deploy --prod
```

Configure env vars no painel da Vercel (todas do `.env.example`). **Não** ligue mocks em prod.
