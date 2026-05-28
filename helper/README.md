# contab-helper

Helper local pra envio assistido de guias em grupos do WhatsApp.

Roda no PC do operador (Rosana). Mantém uma sessão WhatsApp Web persistente via Playwright,
expõe um servidor HTTP em `localhost:7777` que a UI do contab-app (no Vercel) chama
quando precisa preparar uma mensagem em grupo.

A mensagem é digitada no input do WhatsApp Web e o helper **para antes do envio** —
quem aperta enviar é a operadora, depois de conferir.

## Setup (primeira vez)

A partir da raiz do repo:

```bash
pnpm helper:install
```

Esse comando instala dependências do helper e baixa o Chromium dedicado do Playwright.

## Rodar

```bash
pnpm helper:start
```

Saída esperada:

```
[helper] escutando em http://127.0.0.1:7777
[helper] abrindo Chromium com perfil em /caminho/helper/wa-profile
[helper] aguardando WhatsApp Web carregar...
```

**Primeira vez:** o WhatsApp Web vai mostrar um QR code na janela do Chromium aberta.
Escaneie pelo celular (WhatsApp → Aparelhos conectados → Conectar um aparelho).
A sessão fica salva em `helper/wa-profile/` — próximas execuções abrem já logadas.

Deixe o terminal aberto enquanto estiver usando o app. Pra parar, `Ctrl+C`.

## Como funciona

1. UI do contab-app (no Vercel) tem botão "Preparar envio em grupo" em cada cliente
   com `grupo_whatsapp_nome` cadastrado.
2. Clique → server action monta a mensagem em bloco único (todas as guias do mês +
   links signed URL pros PDFs) → o browser da operadora faz fetch pro helper local.
3. Helper recebe o payload `{ grupoNome, mensagem }`, busca o grupo pelo nome no WA Web,
   valida que o header bate, digita a mensagem e para.
4. Janela do Chromium volta pra frente + beep no terminal.
5. Operadora confere e clica Enviar manualmente.

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `HELPER_PORT` | `7777` | Porta do servidor HTTP local |
| `HELPER_ALLOWED_ORIGINS` | `*` | CORS — em prod restrinja, ex: `HELPER_ALLOWED_ORIGINS=https://contab-app.vercel.app` |

## Sistema operacional

Pensado pra rodar no Windows ou macOS direto, onde está o WhatsApp Web logado da operadora.
Em WSL2 funciona mas tem ressalvas: `bringToFront` e o beep do terminal podem não dar
sinal claro porque o Chromium roda sob WSLg/X. Use WSL só pra dev/debug.

## Debug

Em qualquer erro, screenshot vai pra `helper/debug/<timestamp>_<motivo>.png`. Anexa
no relato quando reportar.

## Limitações conhecidas

- **WhatsApp Multi-Device:** o número logado aqui consome 1 das 4 vagas de dispositivo
  vinculado da conta. Se a operadora logar em outro PC ou navegador, pode estourar o limite.
- **Selectors quebram:** WA Web muda layout às vezes. Ajuste em `src/wa-selectors.ts` —
  é um arquivo só. Mantenha aria-label/role como âncoras.
- **Risco de ban:** automação fora da API oficial sempre tem risco. Mitigantes: browser
  real (headed), IP residencial, confirmação humana antes do envio, delays de digitação
  parecidos com humanos. Mas o número logado aqui não deve ser o único canal crítico
  da operadora.
- **Foco da janela:** durante a digitação (~5-10s) o helper traz a janela pra frente.
  Não digite em outras coisas nesse intervalo.

## Arquitetura

```
helper/
  src/
    index.ts        Express server, valida payload e delega pro driver
    driver.ts       Playwright session manager + fluxo de prep-envio
    wa-selectors.ts Selectors centralizados (único lugar pra atualizar)
  wa-profile/       Perfil persistente do Chromium (gitignored)
  debug/            Screenshots de erro (gitignored)
```
