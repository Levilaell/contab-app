import { getGraphClient, isMockOneDrive } from './client';

export type ScanFile = {
  id: string;
  name: string;
  downloadUrl?: string;
  size?: number;
};

export async function listFiles(folderPath: string): Promise<ScanFile[]> {
  if (isMockOneDrive()) {
    return [];
  }
  const graph = getGraphClient();
  const url = folderPath.startsWith('/')
    ? `/me/drive/root:${encodeURI(folderPath)}:/children`
    : `/me/drive/root:/${encodeURI(folderPath)}:/children`;
  const res = await graph.api(url).get();
  const items: ScanFile[] = (res.value || []).map(
    (item: {
      id: string;
      name: string;
      size?: number;
      '@microsoft.graph.downloadUrl'?: string;
    }) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
    }),
  );
  return items;
}

export async function downloadFile(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`download falhou: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
