'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function reenviarPendentes(guiaId: string) {
  await requireUser();
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('guia_envios')
    .update({
      status: 'pendente',
      agendada_para: new Date().toISOString(),
      erro_mensagem: null,
    })
    .eq('guia_id', guiaId)
    .in('status', ['erro', 'cancelado'])
    .select('id');

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/guias/${guiaId}`);
  return { ok: true as const, count: (data ?? []).length };
}
