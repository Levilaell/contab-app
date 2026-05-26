# PENDENCIAS — escopo deixado para depois ou bloqueado

## Crítico (precisa antes de produção real)

### 1. Templates WhatsApp UTILITY — aprovar no Meta

Não tem como mandar mensagem template sem aprovação. Templates necessários (em pt_BR):

**`docs_solicitacao_mensal`** — categoria UTILITY

```
Oi {{nome_contato}}, chegou a hora de mandar os documentos do mês ({{competencia}}).
Pode mandar por aqui: notas, comprovantes, recibos. Mande quantos quiser, em PDF, XML ou foto.
```

Variáveis: `nome_contato`, `competencia`.

**`guia_envio_inicial`** — UTILITY

```
Oi {{nome_contato}}, segue a guia {{tipo_guia}} de {{razao_social}} com vencimento {{vencimento}}.
Qualquer dúvida me chama.
```

Variáveis: `nome_contato`, `razao_social`, `tipo_guia`, `vencimento`.

**`guia_followup_d1`, `guia_followup_d3`, `guia_followup_d7`** — UTILITY (mesma estrutura, texto incremental de lembrança).

Submeter no Meta Business Manager → WhatsApp Manager → Message templates. Aprovação leva 1-24h.

### 2. Cron hourly exige Vercel Pro

Hobby plan suporta só daily. Opções:

- (a) Upgrade pra Pro.
- (b) Ajustar `vercel.json` pra `0 8 * * *` em todos.
- (c) Usar serviço externo (cron-job.org) chamando os endpoints com o `Authorization: Bearer ${CRON_SECRET}`.

### 3. Migration no Supabase — DROP SCHEMA cascade primeiro

O arquivo `supabase/migrations/0001_init.sql` ainda **não foi aplicado** — preciso da service role key ou acesso ao SQL editor. Como o sprint pediu "drop schema public cascade + recreate", rode na seguinte ordem no SQL editor:

```sql
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
-- depois cole o conteúdo de supabase/migrations/0001_init.sql
```

Ou via CLI:

```bash
supabase link --project-ref wvvfikpfwpkzynloauvv
supabase db reset
supabase db push
```

Se rodar `0001_init.sql` em schema com tabelas pré-existentes do projeto antigo (LancaFlow etc.), vai quebrar em `create table`.

### 4. ENCRYPTION_KEY em produção

Gere com `openssl rand -base64 32` e coloque na Vercel **antes** de salvar qualquer credencial. Trocar a key invalida todos os tokens encriptados.

### 5. WHATSAPP_APP_SECRET para verificar webhook

Sem essa env, `verifyWebhookSignature` aceita tudo (modo dev). Em prod, pegue em Meta Dashboard → App Settings → Basic → App Secret.

## Importante (limitações deste sprint)

### 6. NFSe parser é heurístico

Cada município tem schema próprio. Hoje só identifica `tipo=nfse` pela tag `<Nfse>`, sem extrair metadata. Considerar:

- Whitelist dos principais (SP, RJ, SJRP, BH) com parsers dedicados.
- Cair pra Sonnet quando não identifica tag.

### 7. API Domínio — endpoint fictício

O endpoint `https://api.dominio.com.br/v1/escrituracao/nfe/batch` em `src/lib/dominio/api-client.ts` é placeholder. Substituir pelo real após receber doc da Domínio. Estrutura do payload (`cliente_codigo` + `arquivos[{chave,xml_content}]`) é palpite — confirmar contrato.

### 8. msal-node refresh token extraction

O refresh token só é exposto via cache serialization (hack). Microsoft recomenda usar in-memory cache persistente. Se a conta tiver MFA, o fluxo precisa ser re-validado. Em produção, considere persistir o cache MSAL inteiro encriptado no `app_config` ao invés de só o refresh token.

### 9. Reclassificar via IA não tem modal de override manual

O botão `Reclassificar` só re-roda o classifier. Falta UI pra contadora forçar `tipo` manualmente (ex: "isso é um recibo, não NFe"). Tabela `documentos.classificacao_original` já existe — só falta UI + action.

### 10. Solicitações: idempotência por dia ≠ competência

`agendarSolicitacoesDoDia` evita duplicar por contato+competência (mês). Se rodar o cron 2x no mesmo dia 5, não duplica. Mas se a contadora trocar `dia_solicitacao` de 5 → 10 no meio do mês, e o cron de hoje já tiver rodado, vai gerar de novo. OK pra single-tenant.

### 11. Follow-ups não são gerados automaticamente

A tabela `guia_envios.numero_followup` e os templates `guia_followup_d1/d3/d7` existem mas falta o scheduler que cria os follow-ups N dias após `enviado_at` quando `respondido_at IS NULL`. Sugestão: novo cron diário que escaneia envios sem resposta e cria nova linha `guia_envios` agendada.

### 12. Dashboard: custo IA está multiplicado por 5

No card "Geral", o custo IA é multiplicado por 5 (proxy pra BRL ~5/USD). É grosseiro — quando virar real, usar API de cotação ou só mostrar em USD.

### 13. Sem testes automatizados

Nenhum unit/integration test. Mínimo recomendado:

- `parseNFeXml` com um XML real de NFe e CT-e
- `parseGuiaFilename` com nomes variados do Domínio
- Encrypt/decrypt round-trip

### 14. Sem rate limit nas rotas públicas

`/api/webhook/whatsapp` aceita qualquer POST. Embora `verifyWebhookSignature` proteja em prod, sem app_secret em dev qualquer um pode injetar mensagens. Considerar IP allowlist Meta em produção.

### 15. Sidebar não tem indicador "ao vivo" pra Realtime

Os badges de count nas tabs de solicitações são computados no server, não atualizam em Realtime. Funciona pra refresh manual, mas não pra ver alertas em tempo real. Adicionar canal `documentos` no badge da sidebar seria nice-to-have.

## Nice to have

### 16. Modo `reclassificar` em batch

Reclassificar todos os docs status=`duvida` de uma vez via IA mais forte.

### 17. Convite via email pra usuários

Hoje signup só por script (admin). Pra ter Rosana entrando, criar via Supabase Studio ou script.

### 18. PDF prova de envio: sem assinatura digital

O PDF é exportável mas não tem certificado/timestamp. Pra valor jurídico de comprovante, precisa assinatura ICP-Brasil.

### 19. Pasta do OneDrive não é configurável dinamicamente

Hardcoded `Contabilliza/[razão]/[AAAA-MM]/[Tipo]/`. Se a contadora quiser estrutura diferente, hoje precisa mexer no código. Adicionar template configurável em settings.

### 20. Sem retry inteligente em falhas Meta

Se o webhook do Meta falhar, eles tentam de novo. Mas nossa lógica em `processReceivedMessage` não tem dedupe — se a mesma `wa_message_id` chegar 2x, a linha em `bot_messages` duplica. Adicionar `unique(wa_message_id)` ou check antes do insert.

## Resolved durante o sprint

(vazio — manter histórico aqui se desfizer alguma decisão.)

## 🔴 Follow-up automático de guias — INCOMPLETO

**Problema:** Schema preparado (`guia_envios.numero_followup`, `followup_dias_apos`), mas scheduler não cria registros D+1, D+3, D+7 quando cliente não responde.

**Hoje:** cron `/api/cron/envia-mensagens` só envia envios originais. Follow-ups nunca são agendados.

**Pra resolver:**

1. Criar `lib/guias/followup-scheduler.ts`:

```typescript
// Cron diário roda às 6h
// Pra cada guia_envio status='enviado' onde respondido_at IS NULL:
//   - dias_desde_envio = today - enviado_at
//   - Se dias_desde_envio in [1, 3, 7] e NÃO existe guia_envios desse contact_id + guia_id + numero_followup == N:
//     - Cria novo guia_envios numero_followup=N, status='pendente', template_nome='guia_followup_dN'
//     - Cron envia-mensagens vai pegar e enviar
```

2. Adicionar cron novo em `vercel.json`:

```json
{ "path": "/api/cron/followups-scheduler", "schedule": "0 6 * * *" }
```

3. Bot recebe resposta → marca `respondido_at = now()` em TODOS guia_envios do contact_id (já implementado no webhook, confirmar)

**Estimativa:** 2-3h dev

---

## 🔴 Dedup de webhook WhatsApp — BUG

**Problema:** Meta pode re-entregar mesma mensagem (network glitch, timeout). Hoje sistema cria 2 `bot_messages` e potencialmente 2 `documentos` pro mesmo `wa_message_id`.

**Pra resolver:**

1. Adicionar constraint:

```sql
   alter table bot_messages
     add constraint bot_messages_wa_message_id_unique
     unique (wa_message_id);

   alter table documentos
     add constraint documentos_wa_message_id_unique
     unique (wa_message_id);
```

2. No webhook (`lib/whatsapp/receive-webhook.ts`):

```typescript
// Antes de inserir, check se wa_message_id já existe
const { data: existing } = await supabase
  .from("bot_messages")
  .select("id")
  .eq("wa_message_id", message.id)
  .maybeSingle();

if (existing) {
  console.log("Dedup: message already processed", message.id);
  return;
}
```

3. Tratar erro de unique constraint violation gracefully (não dar 500 pro Meta).

**Estimativa:** 1h dev

## 🟡 Credenciais reais pendentes (não bloqueiam demo)

Ativar quando ligar produção real (deixar mock=false):

1. **Meta WhatsApp App Secret**
   - Onde pegar: developers.facebook.com → seu app → Settings → Basic → App Secret
   - Variável: WHATSAPP_APP_SECRET
   - Usado pra: validação HMAC dos webhooks
   - Quando: ao desativar MOCK_WHATSAPP

2. **Microsoft Azure AD App (OneDrive)**
   - Onde criar: portal.azure.com → App registrations → New registration
   - Configurar:
     - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
     - Redirect URI: https://contab-app.vercel.app/api/oauth/onedrive/callback (Web)
   - Permissions: Files.ReadWrite, offline_access, User.Read
   - Gerar Client Secret em "Certificates & secrets"
   - Variáveis: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI
   - Quando: ao desativar MOCK_ONEDRIVE
