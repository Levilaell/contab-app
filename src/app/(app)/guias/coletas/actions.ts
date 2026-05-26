'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { runColeta } from '@/lib/dominio/watch-folder';

export async function triggerColeta() {
  await requireUser();
  try {
    const r = await runColeta();
    revalidatePath('/guias/coletas');
    revalidatePath('/guias');
    return { ok: true as const, ...r };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}
