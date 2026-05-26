import { createServiceClient } from '@/lib/supabase/service';
import { tryDecrypt } from '@/lib/crypto';

export type AppConfig = {
  id: number;
  nome_escritorio: string;
  contact_email: string | null;

  wa_phone_number_id: string | null;
  wa_access_token_encrypted: string | null;
  wa_business_account_id: string | null;
  wa_webhook_verify_token: string | null;
  wa_active: boolean;

  dominio_api_key_encrypted: string | null;
  dominio_integration_id: string | null;
  dominio_active: boolean;

  dominio_watch_folder_path: string | null;
  dominio_watch_active: boolean;
  dominio_last_scan_at: string | null;

  onedrive_user_id: string | null;
  onedrive_refresh_token_encrypted: string | null;
  onedrive_root_folder_id: string | null;
  onedrive_active: boolean;

  updated_at: string;
};

export type ResolvedConfig = AppConfig & {
  wa_access_token: string;
  dominio_api_key: string;
  onedrive_refresh_token: string;
};

let cached: { value: ResolvedConfig; ts: number } | null = null;
const TTL_MS = 30_000;

export async function getConfig(force = false): Promise<ResolvedConfig> {
  if (!force && cached && Date.now() - cached.ts < TTL_MS) {
    return cached.value;
  }
  const sb = createServiceClient();
  const { data, error } = await sb.from('app_config').select('*').eq('id', 1).single();
  if (error) throw error;

  const config = data as AppConfig;
  const resolved: ResolvedConfig = {
    ...config,
    wa_access_token: tryDecrypt(config.wa_access_token_encrypted),
    dominio_api_key: tryDecrypt(config.dominio_api_key_encrypted),
    onedrive_refresh_token: tryDecrypt(config.onedrive_refresh_token_encrypted),
  };

  cached = { value: resolved, ts: Date.now() };
  return resolved;
}

export function invalidateConfigCache() {
  cached = null;
}

export const brandName = () =>
  process.env.NEXT_PUBLIC_BRAND_NAME || 'Contabilliza';
export const brandEmail = () =>
  process.env.NEXT_PUBLIC_BRAND_EMAIL || 'contato@contabilliza.com.br';
