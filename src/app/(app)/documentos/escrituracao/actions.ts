'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { processEscrituracaoQueue } from '@/lib/dominio/nfe-batch';

export async function triggerEscrituracao(): Promise<
  | { ok: true; batches: number; documentos: number }
  | { ok: false; error: string }
> {
  await requireUser();
  try {
    const r = await processEscrituracaoQueue();
    revalidatePath('/documentos/escrituracao');
    revalidatePath('/documentos');
    return { ok: true, batches: r.batches_created, documentos: r.documentos_processados };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
