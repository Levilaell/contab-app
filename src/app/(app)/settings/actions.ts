'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { encrypt } from '@/lib/crypto';
import { requireUser } from '@/lib/auth';
import { invalidateConfigCache } from '@/lib/config';
import { randomBytes } from 'node:crypto';

type Result = { ok: true } | { ok: false; error: string };

async function updateAppConfig(patch: Record<string, unknown>): Promise<Result> {
  await requireUser();
  const sb = createServiceClient();
  const { error } = await sb
    .from('app_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { ok: false, error: error.message };
  invalidateConfigCache();
  return { ok: true };
}

const generalSchema = z.object({
  nome_escritorio: z.string().min(1),
  contact_email: z.string().email().nullable().optional().or(z.literal('')),
});

export async function saveGeneral(formData: FormData): Promise<Result> {
  const parsed = generalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await updateAppConfig({
    nome_escritorio: parsed.data.nome_escritorio,
    contact_email: parsed.data.contact_email || null,
  });
  revalidatePath('/settings');
  return r;
}

const whatsappSchema = z.object({
  wa_phone_number_id: z.string().optional().nullable(),
  wa_business_account_id: z.string().optional().nullable(),
  wa_access_token: z.string().optional().nullable(),
  wa_webhook_verify_token: z.string().optional().nullable(),
  wa_active: z.boolean().default(false),
});

export async function saveWhatsApp(formData: FormData): Promise<Result> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = whatsappSchema.safeParse({
    ...raw,
    wa_active: raw.wa_active === 'on' || raw.wa_active === 'true',
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const patch: Record<string, unknown> = {
    wa_phone_number_id: parsed.data.wa_phone_number_id || null,
    wa_business_account_id: parsed.data.wa_business_account_id || null,
    wa_webhook_verify_token:
      parsed.data.wa_webhook_verify_token ||
      randomBytes(24).toString('hex'),
    wa_active: parsed.data.wa_active,
  };
  if (parsed.data.wa_access_token) {
    patch.wa_access_token_encrypted = encrypt(parsed.data.wa_access_token);
  }

  const r = await updateAppConfig(patch);
  revalidatePath('/settings/whatsapp');
  return r;
}

const dominioSchema = z.object({
  dominio_integration_id: z.string().optional().nullable(),
  dominio_api_key: z.string().optional().nullable(),
  dominio_active: z.boolean().default(false),
  dominio_watch_folder_path: z.string().optional().nullable(),
  dominio_watch_active: z.boolean().default(false),
});

export async function saveDominio(formData: FormData): Promise<Result> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = dominioSchema.safeParse({
    ...raw,
    dominio_active: raw.dominio_active === 'on' || raw.dominio_active === 'true',
    dominio_watch_active:
      raw.dominio_watch_active === 'on' || raw.dominio_watch_active === 'true',
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const patch: Record<string, unknown> = {
    dominio_integration_id: parsed.data.dominio_integration_id || null,
    dominio_active: parsed.data.dominio_active,
    dominio_watch_folder_path: parsed.data.dominio_watch_folder_path || null,
    dominio_watch_active: parsed.data.dominio_watch_active,
  };
  if (parsed.data.dominio_api_key) {
    patch.dominio_api_key_encrypted = encrypt(parsed.data.dominio_api_key);
  }

  const r = await updateAppConfig(patch);
  revalidatePath('/settings/dominio');
  return r;
}

export async function disconnectOneDrive(): Promise<Result> {
  const r = await updateAppConfig({
    onedrive_user_id: null,
    onedrive_refresh_token_encrypted: null,
    onedrive_root_folder_id: null,
    onedrive_active: false,
  });
  revalidatePath('/settings/onedrive');
  return r;
}
