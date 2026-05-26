import { createServiceClient } from '@/lib/supabase/service';
import { getGraphClient, isMockOneDrive } from './client';
import { capitalize, formatYearMonth } from '@/lib/format';
import { getConfig } from '@/lib/config';
import type { Documento, ExternalClient } from '@/lib/types';

async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from('documentos').download(storagePath);
  if (error || !data) throw new Error(`download falhou: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function ensureFolder(path: string): Promise<string> {
  if (isMockOneDrive()) {
    return `mock-folder-${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  const graph = getGraphClient();
  const segments = path.split('/').filter(Boolean);
  let parentId = 'root';
  for (const seg of segments) {
    try {
      // tenta criar
      const created = await graph
        .api(`/me/drive/items/${parentId}/children`)
        .post({
          name: seg,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
      parentId = created.id;
    } catch (err) {
      const e = err as { statusCode?: number };
      if (e.statusCode === 409) {
        const child = await graph
          .api(`/me/drive/items/${parentId}:/${encodeURIComponent(seg)}`)
          .get();
        parentId = child.id;
      } else {
        throw err;
      }
    }
  }
  return parentId;
}

async function uploadFile(
  folderId: string,
  filename: string,
  buffer: Buffer,
): Promise<{ id: string; webUrl?: string }> {
  if (isMockOneDrive()) {
    return { id: `mock-file-${Date.now()}` };
  }
  const graph = getGraphClient();
  const path = `/me/drive/items/${folderId}:/${encodeURIComponent(filename)}:/content`;
  return await graph.api(path).put(buffer);
}

export async function uploadToOneDrive(documentoId: string): Promise<void> {
  const sb = createServiceClient();
  const config = await getConfig();
  if (!config.onedrive_active) {
    await sb
      .from('documentos')
      .update({ onedrive_erro: 'OneDrive não configurado' })
      .eq('id', documentoId);
    return;
  }

  const { data: doc } = await sb
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single();
  if (!doc) return;
  const typedDoc = doc as Documento;

  let clienteNome = 'Sem Cliente';
  if (typedDoc.external_client_id) {
    const { data: client } = await sb
      .from('external_clients')
      .select('razao_social')
      .eq('id', typedDoc.external_client_id)
      .maybeSingle();
    if (client) clienteNome = (client as Pick<ExternalClient, 'razao_social'>).razao_social;
  }

  const yearMonth = formatYearMonth(typedDoc.recebido_em);
  const tipoPasta = capitalize(typedDoc.tipo ?? 'Outros');
  const safeCliente = clienteNome.replace(/[<>:"/\\|?*]/g, '_');
  const folderPath = `Contabilliza/${safeCliente}/${yearMonth}/${tipoPasta}`;

  try {
    const folderId = await ensureFolder(folderPath);
    const buffer = await downloadFromStorage(typedDoc.storage_path);
    const filename = typedDoc.filename_original || `doc_${typedDoc.id}.bin`;
    const result = await uploadFile(folderId, filename, buffer);

    await sb
      .from('documentos')
      .update({
        onedrive_file_id: result.id,
        onedrive_path: `${folderPath}/${filename}`,
        onedrive_uploaded_at: new Date().toISOString(),
        onedrive_erro: null,
      })
      .eq('id', documentoId);
  } catch (error) {
    await sb
      .from('documentos')
      .update({ onedrive_erro: (error as Error).message })
      .eq('id', documentoId);
  }
}
