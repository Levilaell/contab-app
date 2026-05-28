// Selectors do WhatsApp Web. WA obfusca classes CSS mas mantém aria-label/role estáveis
// pra acessibilidade. Cada constante combina variantes PT/EN com vírgula (CSS OR).
//
// Atualizar aqui quando a UI quebrar — único ponto de mudança.

export const WA_URL = 'https://web.whatsapp.com';

export const SEL = {
  // App carregado (sidebar de conversas visível)
  appReady:
    '#side, [aria-label="Lista de conversas"], [aria-label="Chat list"]',

  // QR code visível (precisa scan)
  qrCanvas:
    'canvas[aria-label*="Escanear" i], canvas[aria-label*="Scan" i], div[data-ref] canvas',

  // Search box na lateral esquerda. WA Web atual usa <input> HTML nativo, não
  // contenteditable. Aria-label fica em EN mesmo no PT.
  searchBoxFallbacks: [
    'input[aria-label*="Search or start" i]',
    'input[aria-label*="Pesquisar ou começar" i]',
    'input[data-tab="3"]',
    '#side input[role="textbox"]',
    '#side input[placeholder*="earch" i]',
    '#side input[placeholder*="esquis" i]',
    // Fallback histórico (versões antigas usavam contenteditable)
    '#side div[role="textbox"][contenteditable="true"]',
  ],

  // Container do grid de resultados (aria-label estável)
  searchResultsContainer: '[role="grid"][aria-label*="Search results" i], [role="grid"][aria-label*="Resultados" i]',

  // Cada resultado clicável dentro do grid (gridcell com tabindex=0)
  searchResultItemFallbacks: [
    '[role="grid"][aria-label*="Search results" i] [role="gridcell"][tabindex="0"]',
    '[role="grid"][aria-label*="Resultados" i] [role="gridcell"][tabindex="0"]',
    '[role="grid"] [role="gridcell"][tabindex="0"]',
    '[role="grid"] [role="row"]',
  ],

  // Header da conversa aberta — kept for snapshot but não usamos pra validar
  conversationHeader: '#main header, header',

  // Input de digitação de mensagem (footer do chat aberto)
  // WA pode estar migrando pra input nativo aqui também, então cobrimos ambos
  messageInputFallbacks: [
    'footer div[contenteditable="true"][role="textbox"]',
    'footer div[contenteditable="true"]',
    'footer [aria-label*="Type a message" i]',
    'footer [aria-label*="Digite uma mensagem" i]',
    'footer input[role="textbox"]',
    '[data-tab="10"]',
    'div[contenteditable="true"][role="textbox"]',
  ],
};
