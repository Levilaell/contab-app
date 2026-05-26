'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { agendarSolicitacoesDoDia } from '@/lib/solicitacoes/scheduler';
import { processarFilaEnvios } from '@/lib/solicitacoes/sender';

export async function triggerAgendar() {
  await requireUser();
  try {
    const r = await agendarSolicitacoesDoDia();
    revalidatePath('/documentos/solicitacoes');
    return { ok: true as const, ...r };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}

export async function triggerEnvio() {
  await requireUser();
  try {
    const r = await processarFilaEnvios();
    revalidatePath('/documentos/solicitacoes');
    return { ok: true as const, ...r };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}
