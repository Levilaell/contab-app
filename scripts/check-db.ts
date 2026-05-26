/**
 * Diagnóstico rápido: lista tabelas e contagens.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('faltam env vars');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const TABELAS = [
  'app_config',
  'external_clients',
  'external_client_contacts',
  'solicitacoes_documentos',
  'documentos',
  'escrituracao_batches',
  'bot_messages',
  'coletas',
  'guias',
  'guia_envios',
  'ai_usage',
] as const;

async function main() {
  for (const t of TABELAS) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${t.padEnd(30)} ERROR ${error.message}`);
    } else {
      console.log(`${t.padEnd(30)} ${count ?? 0}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
