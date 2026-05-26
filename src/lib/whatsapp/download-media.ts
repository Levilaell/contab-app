import { callGraph, isMockWhatsApp } from './cloud-api';
import { getConfig } from '@/lib/config';

export async function downloadMedia(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  if (isMockWhatsApp()) {
    return {
      buffer: Buffer.from('mock pdf content'),
      mimeType: 'application/pdf',
    };
  }

  const meta = await callGraph<{ url: string; mime_type: string }>(mediaId);

  const config = await getConfig();
  const res = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${config.wa_access_token}` },
  });
  if (!res.ok) throw new Error(`download media ${res.status}`);
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), mimeType: meta.mime_type };
}
