import { createServiceClient } from '@/lib/supabase/service';

const EXPIRA_SEGUNDOS = 30 * 24 * 3600; // 30 dias

export async function gerarLinkPublicoGuia(guiaId: string, storagePath: string): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
}> {
  const sb = createServiceClient();

  const { data, error } = await sb.storage
    .from('guias')
    .createSignedUrl(storagePath, EXPIRA_SEGUNDOS);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'createSignedUrl retornou vazio' };
  }

  const expiraAt = new Date(Date.now() + EXPIRA_SEGUNDOS * 1000).toISOString();
  const { error: updateError } = await sb
    .from('guias')
    .update({
      link_publico_url: data.signedUrl,
      link_publico_expira_at: expiraAt,
    })
    .eq('id', guiaId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, url: data.signedUrl };
}
