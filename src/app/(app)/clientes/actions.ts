'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { cleanCNPJ, toE164 } from '@/lib/format';
import { requireUser } from '@/lib/auth';

const clienteSchema = z.object({
  cnpj: z.string().min(14, 'CNPJ inválido'),
  razao_social: z.string().min(1, 'Razão social obrigatória'),
  nome_fantasia: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
  solicitar_documentos: z.boolean().default(true),
  dia_solicitacao: z.coerce.number().min(1).max(28).default(5),
  modo_envio_guias: z.enum(['individual_automatico', 'desativado']).default('individual_automatico'),
  dominio_codigo_empresa: z.string().nullable().optional(),
  grupo_whatsapp_nome: z.string().nullable().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCliente(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();

  const raw = Object.fromEntries(formData.entries());
  const parsed = clienteSchema.safeParse({
    ...raw,
    ativo: raw.ativo === 'on' || raw.ativo === 'true',
    solicitar_documentos: raw.solicitar_documentos === 'on' || raw.solicitar_documentos === 'true',
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  data.cnpj = cleanCNPJ(data.cnpj);

  const { error } = await sb.from('external_clients').insert({
    ...data,
    nome_fantasia: data.nome_fantasia || null,
    dominio_codigo_empresa: data.dominio_codigo_empresa || null,
    grupo_whatsapp_nome: data.grupo_whatsapp_nome?.trim() || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/clientes');
  redirect('/clientes');
}

export async function updateCliente(id: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();

  const raw = Object.fromEntries(formData.entries());
  const parsed = clienteSchema.safeParse({
    ...raw,
    ativo: raw.ativo === 'on' || raw.ativo === 'true',
    solicitar_documentos: raw.solicitar_documentos === 'on' || raw.solicitar_documentos === 'true',
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  data.cnpj = cleanCNPJ(data.cnpj);

  const { error } = await sb
    .from('external_clients')
    .update({
      ...data,
      nome_fantasia: data.nome_fantasia || null,
      dominio_codigo_empresa: data.dominio_codigo_empresa || null,
      grupo_whatsapp_nome: data.grupo_whatsapp_nome?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();
  const { error } = await sb.from('external_clients').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/clientes');
  return { ok: true };
}

const contactSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  papel: z.string().default('outro'),
  whatsapp: z.string().min(8, 'WhatsApp inválido'),
  email: z.string().email().nullable().optional().or(z.literal('')),
  ativo: z.boolean().default(true),
  receber_guias: z.boolean().default(true),
  receber_solicitacoes: z.boolean().default(false),
  ordem: z.coerce.number().default(0),
});

export async function addContact(
  externalClientId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse({
    ...raw,
    ativo: raw.ativo === 'on' || raw.ativo === 'true',
    receber_guias: raw.receber_guias === 'on' || raw.receber_guias === 'true',
    receber_solicitacoes: raw.receber_solicitacoes === 'on' || raw.receber_solicitacoes === 'true',
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const { error } = await sb.from('external_client_contacts').insert({
    external_client_id: externalClientId,
    ...data,
    whatsapp: toE164(data.whatsapp),
    email: data.email || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${externalClientId}`);
  return { ok: true };
}

export async function updateContact(
  contactId: string,
  externalClientId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse({
    ...raw,
    ativo: raw.ativo === 'on' || raw.ativo === 'true',
    receber_guias: raw.receber_guias === 'on' || raw.receber_guias === 'true',
    receber_solicitacoes: raw.receber_solicitacoes === 'on' || raw.receber_solicitacoes === 'true',
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await sb
    .from('external_client_contacts')
    .update({
      ...parsed.data,
      whatsapp: toE164(parsed.data.whatsapp),
      email: parsed.data.email || null,
    })
    .eq('id', contactId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${externalClientId}`);
  return { ok: true };
}

export async function deleteContact(
  contactId: string,
  externalClientId: string,
): Promise<ActionResult> {
  await requireUser();
  const sb = createServiceClient();
  const { error } = await sb
    .from('external_client_contacts')
    .delete()
    .eq('id', contactId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${externalClientId}`);
  return { ok: true };
}

const csvRowSchema = z.object({
  cnpj: z.string(),
  razao_social: z.string(),
  nome_fantasia: z.string().nullable().optional(),
  dominio_codigo_empresa: z.string().nullable().optional(),
});

export async function importClientesCSV(
  rows: Array<Record<string, string>>,
): Promise<{ ok: boolean; created: number; errors: string[] }> {
  await requireUser();
  const sb = createServiceClient();
  const errors: string[] = [];
  let created = 0;

  for (const row of rows) {
    const parsed = csvRowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push(`linha ${row.cnpj || '?'}: ${parsed.error.issues[0].message}`);
      continue;
    }
    const cnpj = cleanCNPJ(parsed.data.cnpj);
    if (cnpj.length !== 14) {
      errors.push(`${parsed.data.cnpj}: CNPJ inválido`);
      continue;
    }
    const { error } = await sb.from('external_clients').upsert(
      {
        cnpj,
        razao_social: parsed.data.razao_social,
        nome_fantasia: parsed.data.nome_fantasia || null,
        dominio_codigo_empresa: parsed.data.dominio_codigo_empresa || null,
      },
      { onConflict: 'cnpj' },
    );
    if (error) errors.push(`${cnpj}: ${error.message}`);
    else created++;
  }

  revalidatePath('/clientes');
  return { ok: errors.length === 0, created, errors };
}
