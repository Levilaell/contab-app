import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEL, WA_URL } from './wa-selectors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, '..', 'wa-profile');
const DEBUG_DIR = join(__dirname, '..', 'debug');

let context: BrowserContext | null = null;
let page: Page | null = null;
let initPromise: Promise<void> | null = null;

async function ensureDirs() {
  await mkdir(PROFILE_DIR, { recursive: true });
  await mkdir(DEBUG_DIR, { recursive: true });
}

async function snapshot(name: string) {
  if (!page) return null;
  const path = join(DEBUG_DIR, `${Date.now()}_${name}.png`);
  try {
    await page.screenshot({ path, fullPage: false });
    return path;
  } catch {
    return null;
  }
}

async function initBrowser(): Promise<void> {
  if (context) return;
  await ensureDirs();

  console.log(`[helper] abrindo Chromium com perfil em ${PROFILE_DIR}`);
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });

  const existing = context.pages();
  page = existing[0] ?? (await context.newPage());

  context.on('close', () => {
    console.log('[helper] context fechado externamente');
    context = null;
    page = null;
  });

  await page.goto(WA_URL, { waitUntil: 'domcontentloaded' });
  console.log('[helper] aguardando WhatsApp Web carregar...');

  // Espera ou QR (primeira vez) ou app carregado (sessão persistente)
  const racer = await Promise.race([
    page.waitForSelector(SEL.appReady, { timeout: 120_000 }).then(() => 'ready' as const),
    page.waitForSelector(SEL.qrCanvas, { timeout: 120_000 }).then(() => 'qr' as const),
  ]).catch(() => null);

  if (racer === 'qr') {
    console.log('[helper] QR code detectado. Escaneie pelo celular pra logar.');
    await page.waitForSelector(SEL.appReady, { timeout: 300_000 });
    console.log('[helper] login feito. Sessão salva no perfil.');
  } else if (racer === 'ready') {
    console.log('[helper] sessão WhatsApp Web já autenticada.');
  } else {
    throw new Error('Timeout aguardando WhatsApp Web carregar');
  }
}

export async function ensureReady(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = initBrowser().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

async function getPage(): Promise<Page> {
  await ensureReady();
  if (!page || page.isClosed()) {
    // aba fechada manualmente — recria mantendo o context
    if (!context) throw new Error('Context perdido');
    page = await context.newPage();
    await page.goto(WA_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SEL.appReady, { timeout: 120_000 });
  }
  return page;
}

async function clearSearch(p: Page) {
  // Esc várias vezes pra fechar qualquer estado anterior
  for (let i = 0; i < 3; i++) {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(80);
  }
}

async function findFirstVisible(p: Page, selectors: string[], timeoutMs: number): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = '';
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const loc = p.locator(sel).first();
      try {
        if ((await loc.count()) > 0 && (await loc.isVisible())) {
          return loc;
        }
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }
    await p.waitForTimeout(150);
  }
  throw new Error(
    `Nenhum dos selectors apareceu em ${timeoutMs}ms. Tentei: ${selectors.join(' | ')}${lastErr ? ` (último erro: ${lastErr})` : ''}`,
  );
}

async function tryLocateAll(p: Page, selectors: string[]): Promise<Locator[]> {
  for (const sel of selectors) {
    const loc = p.locator(sel);
    const count = await loc.count();
    if (count > 0) {
      const out: Locator[] = [];
      for (let i = 0; i < count; i++) out.push(loc.nth(i));
      return out;
    }
  }
  return [];
}

async function waitForInputAriaLabelContaining(
  p: Page,
  needle: string,
  timeoutMs: number,
): Promise<string | null> {
  const target = needle.trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inputs = await p.locator('[contenteditable="true"][role="textbox"]').all();
    for (const el of inputs) {
      const al = await el.getAttribute('aria-label').catch(() => null);
      if (al && al.toLowerCase().includes(target)) {
        return al;
      }
    }
    await p.waitForTimeout(200);
  }
  return null;
}

async function typeMessageWithLineBreaks(p: Page, text: string) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      await p.keyboard.type(lines[i], { delay: 15 });
    }
    if (i < lines.length - 1) {
      await p.keyboard.press('Shift+Enter');
      await p.waitForTimeout(30);
    }
  }
}

export type PrepEnvioInput = {
  grupoNome: string;
  mensagem: string;
};

export type PrepEnvioResult =
  | { ok: true; headerLido: string }
  | { ok: false; error: string; screenshotPath?: string | null };

export async function prepEnvio(input: PrepEnvioInput): Promise<PrepEnvioResult> {
  const p = await getPage();

  try {
    await p.bringToFront();
    await clearSearch(p);

    // 1) Foca search, limpa eventual busca anterior, digita nome do grupo.
    // WA Web atual usa <input> nativo; .fill('') funciona pra ambos input e contenteditable.
    const searchBox = await findFirstVisible(p, SEL.searchBoxFallbacks, 15_000);
    await searchBox.click();
    await p.waitForTimeout(120);
    await searchBox.fill('');
    await p.waitForTimeout(80);
    await p.keyboard.type(input.grupoNome, { delay: 40 });

    // 2) Espera grid de resultados aparecer e clica no primeiro que contém o nome
    await p
      .locator(SEL.searchResultsContainer)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});
    await p.waitForTimeout(500); // WA debouncea

    let items = await tryLocateAll(p, SEL.searchResultItemFallbacks);
    if (items.length === 0) {
      const shot = await snapshot('sem_resultado');
      return {
        ok: false,
        error: `Nenhum resultado pra "${input.grupoNome}" na busca do WhatsApp`,
        screenshotPath: shot,
      };
    }

    const normaliza = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const target = normaliza(input.grupoNome);
    let clicked = false;
    for (let i = 0; i < Math.min(items.length, 8); i++) {
      const item = items[i];
      const text = (await item.innerText().catch(() => '')) || '';
      // Resultados costumam vir como "<nome><timestamp><preview>..." — startsWith é mais preciso
      const n = normaliza(text);
      if (n.startsWith(target) || n.includes(target)) {
        await item.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      const shot = await snapshot('match_text');
      const sample = (await items[0].innerText().catch(() => '')) || '';
      return {
        ok: false,
        error: `Resultado encontrado mas texto não bate. Primeiro item: "${sample.slice(0, 60)}"`,
        screenshotPath: shot,
      };
    }

    // 3) Valida via aria-label do input de mensagem que aparece após click.
    // Padrão: "Type a message to group <nome>" / "Type a message to <nome>" / PT equivalente.
    // É a forma mais estável: o nome do grupo aparece literalmente no aria-label.
    const foundAriaLabel = await waitForInputAriaLabelContaining(p, input.grupoNome, 10_000);
    if (!foundAriaLabel) {
      const shot = await snapshot('grupo_errado');
      const visivel = await p
        .locator('[contenteditable="true"][role="textbox"]')
        .first()
        .getAttribute('aria-label')
        .catch(() => null);
      return {
        ok: false,
        error: `Grupo "${input.grupoNome}" não foi aberto. Input visível aria-label="${visivel ?? '?'}"`,
        screenshotPath: shot,
      };
    }

    // 4) Foca o input específico do grupo certo
    const safe = input.grupoNome.replace(/["\\]/g, '\\$&');
    const msgInput = p
      .locator(`[contenteditable="true"][role="textbox"][aria-label*="${safe}" i]`)
      .first();
    await msgInput.waitFor({ state: 'visible', timeout: 5_000 });
    await msgInput.click();
    await p.waitForTimeout(150);

    // 5) Limpa qualquer rascunho existente e digita
    await p.keyboard.press('Control+A').catch(() => {});
    await p.keyboard.press('Delete').catch(() => {});
    await typeMessageWithLineBreaks(p, input.mensagem);

    // 6) Sinaliza pra Rosana — bringToFront + beep no terminal
    await p.bringToFront();
    process.stdout.write('\x07');

    return { ok: true, headerLido: foundAriaLabel };
  } catch (err) {
    const shot = await snapshot('erro_geral');
    return {
      ok: false,
      error: (err as Error).message,
      screenshotPath: shot,
    };
  }
}

export async function inspect(): Promise<unknown> {
  const p = await getPage();
  // Passa o script como string pra escapar do __name injetado pelo esbuild/tsx
  // em qualquer função (declaration ou arrow). evaluate aceita string e roda
  // direto no contexto do browser sem instrumentação.
  const script = `(() => {
    const describe = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      title: el.getAttribute('title') || undefined,
      contenteditable: el.getAttribute('contenteditable') || undefined,
      dataTab: el.getAttribute('data-tab') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      tabindex: el.getAttribute('tabindex') || undefined,
      text: (el.textContent || '').trim().slice(0, 100),
    });
    const footer = document.querySelector('footer');
    const footerChildren = footer
      ? Array.from(footer.querySelectorAll('input, div[contenteditable="true"], div[role="textbox"], textarea')).map(describe)
      : [];
    const conversationHeader = document.querySelector('#main header, [data-testid="conversation-header"]');
    const paneSide = document.querySelector('#pane-side');
    // Captura roles únicos dentro de #pane-side e amostra elementos clicáveis
    const paneSideRoles = paneSide
      ? Array.from(new Set(Array.from(paneSide.querySelectorAll('[role]')).map(el => el.getAttribute('role')).filter(Boolean)))
      : [];
    const paneSideDataTabs = paneSide
      ? Array.from(new Set(Array.from(paneSide.querySelectorAll('[data-tab]')).map(el => el.getAttribute('data-tab')).filter(Boolean)))
      : [];
    // Pega elementos com texto visível na sidebar (potenciais resultados de busca)
    const paneSideClickables = paneSide
      ? Array.from(paneSide.querySelectorAll('[role="listitem"], [role="gridcell"], [role="option"], [role="row"], [role="button"], [tabindex="-1"], [tabindex="0"]'))
          .filter(el => {
            const txt = (el.textContent || '').trim();
            return txt.length > 0 && txt.length < 300;
          })
          .slice(0, 12)
          .map(describe)
      : [];
    return {
      url: location.href,
      title: document.title,
      sideExists: !!document.querySelector('#side'),
      paneSideExists: !!paneSide,
      mainExists: !!document.querySelector('#main'),
      chatOpen: !!conversationHeader,
      conversationHeader: conversationHeader ? describe(conversationHeader) : null,
      conversationHeaderTitles: Array.from(document.querySelectorAll('#main header [title], #main header span')).slice(0, 10).map(describe),
      textboxes: Array.from(document.querySelectorAll('[role="textbox"]')).map(describe),
      editables: Array.from(document.querySelectorAll('[contenteditable="true"]')).slice(0, 10).map(describe),
      footerExists: !!footer,
      footerChildren,
      paneSideRoles,
      paneSideDataTabs,
      paneSideClickables,
      searchLike: Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          const a = el.getAttribute('aria-label') || '';
          const t = el.getAttribute('title') || '';
          return /search|pesquis/i.test(a) || /search|pesquis/i.test(t);
        })
        .slice(0, 15)
        .map(describe),
      headers: Array.from(document.querySelectorAll('header')).map(describe),
    };
  })()`;
  return p.evaluate(script);
}

export async function shutdown() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
    page = null;
    initPromise = null;
  }
}
