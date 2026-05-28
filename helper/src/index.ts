import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { prepEnvio, ensureReady, shutdown, inspect } from './driver.js';

const PORT = parseInt(process.env.HELPER_PORT ?? '7777', 10);
const ALLOWED_ORIGINS = (process.env.HELPER_ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((s) => s.trim());

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);

// Chrome Private Network Access: Vercel HTTPS pro localhost exige esse header
// no preflight, ou a request nem chega aqui. cors middleware não adiciona.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

const prepSchema = z.object({
  grupoNome: z.string().min(1, 'grupoNome obrigatório').max(200),
  mensagem: z.string().min(1, 'mensagem obrigatória').max(8000),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0' });
});

app.get('/inspect', async (_req, res) => {
  try {
    const info = await inspect();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/prep-envio', async (req, res) => {
  const parsed = prepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? 'payload inválido' });
    return;
  }

  console.log(`[helper] prep-envio: grupo="${parsed.data.grupoNome}"`);
  const result = await prepEnvio(parsed.data);
  if (!result.ok) {
    console.error(`[helper] falhou: ${result.error}`);
    res.status(500).json(result);
    return;
  }

  console.log(`[helper] mensagem preparada no grupo "${result.headerLido}"`);
  res.json(result);
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[helper] escutando em http://127.0.0.1:${PORT}`);
  console.log('[helper] origins permitidas:', ALLOWED_ORIGINS);
  // Warm-up: já abre o browser e loga (mostra QR se necessário)
  ensureReady().catch((err) => {
    console.error('[helper] erro ao iniciar browser:', err.message);
  });
});

async function gracefulShutdown(signal: string) {
  console.log(`[helper] recebido ${signal}, encerrando...`);
  server.close();
  await shutdown();
  process.exit(0);
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
