import { getConfig } from '@/lib/config';

export type DominioBatchItem = {
  chave: string | null;
  xml_content: string;
};

export type DominioBatchResult = {
  status: 'success' | 'error' | 'duplicate';
  chave?: string;
  error?: string;
};

export type DominioBatchResponse = {
  batch_id?: string;
  results: DominioBatchResult[];
};

export function isMockDominio() {
  return process.env.MOCK_DOMINIO_API === 'true';
}

export async function importBatch(opts: {
  cliente_codigo: string | null;
  arquivos: DominioBatchItem[];
}): Promise<DominioBatchResponse> {
  if (isMockDominio()) {
    return mockImportBatch(opts.arquivos);
  }

  const config = await getConfig();
  if (!config.dominio_api_key) {
    throw new Error('Domínio API key não configurado');
  }

  const res = await fetch('https://api.dominio.com.br/v1/escrituracao/nfe/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.dominio_api_key}`,
      'X-Integration-Id': config.dominio_integration_id ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cliente_codigo: opts.cliente_codigo,
      arquivos: opts.arquivos,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Domínio ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as DominioBatchResponse;
}

function mockImportBatch(arquivos: DominioBatchItem[]): DominioBatchResponse {
  return {
    batch_id: `mock_${Date.now()}`,
    results: arquivos.map((a, i) => {
      // 10% erro, 5% duplicado, resto sucesso
      const seed = (a.chave ? parseInt(a.chave.slice(-2), 10) : i) % 20;
      if (seed === 0) {
        return {
          status: 'error',
          chave: a.chave ?? undefined,
          error: 'Mock: XML rejeitado pela validação',
        };
      }
      if (seed === 1) {
        return { status: 'duplicate', chave: a.chave ?? undefined };
      }
      return { status: 'success', chave: a.chave ?? undefined };
    }),
  };
}
