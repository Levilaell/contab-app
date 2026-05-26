'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { classifyDocument } from '@/lib/ia/classify-documento';
import { uploadToOneDrive } from '@/lib/onedrive/upload';
import { createServiceClient } from '@/lib/supabase/service';

export async function reclassificar(documentoId: string) {
  await requireUser();
  const sb = createServiceClient();
  await sb
    .from('documentos')
    .update({
      reclassificado: true,
      status: 'recebido',
    })
    .eq('id', documentoId);

  try {
    await classifyDocument(documentoId);
    revalidatePath(`/documentos/${documentoId}`);
    revalidatePath('/documentos');
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}

export async function retentarEscrituracao(documentoId: string) {
  await requireUser();
  const sb = createServiceClient();
  await sb
    .from('documentos')
    .update({
      status: 'pronto_envio',
      escrituracao_erro: null,
      batch_id: null,
    })
    .eq('id', documentoId);
  revalidatePath(`/documentos/${documentoId}`);
  revalidatePath('/documentos');
  return { ok: true as const };
}

export async function sincronizarOneDrive(documentoId: string) {
  await requireUser();
  try {
    await uploadToOneDrive(documentoId);
    revalidatePath(`/documentos/${documentoId}`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}
