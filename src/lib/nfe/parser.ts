import { XMLParser } from 'fast-xml-parser';
import { cleanCNPJ } from '@/lib/format';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
});

export type NFeParseResult = {
  tipo: 'nfe' | 'nfse' | 'nfce' | 'cte' | null;
  chave_acesso_nfe: string | null;
  metadata: {
    numero?: string;
    serie?: string;
    cnpj_emitente?: string;
    razao_social_emitente?: string;
    cnpj_destinatario?: string;
    razao_social_destinatario?: string;
    data_emissao?: string;
    valor?: number;
  };
  raw_root: string | null;
};

export function parseNFeXml(xmlContent: string | Buffer): NFeParseResult {
  const str = typeof xmlContent === 'string' ? xmlContent : xmlContent.toString('utf8');
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(str) as Record<string, unknown>;
  } catch {
    return {
      tipo: null,
      chave_acesso_nfe: null,
      metadata: {},
      raw_root: null,
    };
  }

  const rootKey = Object.keys(parsed)[0] ?? '';
  const lowerRoot = rootKey.toLowerCase();

  // NFe (modelo 55) ou NFCe (modelo 65)
  if (lowerRoot === 'nfeproc' || lowerRoot === 'nfe') {
    const nfeNode = (parsed[rootKey] as Record<string, unknown>)?.NFe ?? parsed[rootKey];
    const infNFe = (nfeNode as Record<string, unknown>)?.infNFe as Record<string, unknown> | undefined;
    if (!infNFe) {
      return { tipo: 'nfe', chave_acesso_nfe: null, metadata: {}, raw_root: rootKey };
    }
    const chaveRaw = String(infNFe['@_Id'] ?? '');
    const chave = chaveRaw.replace(/^NFe/, '');
    const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
    const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
    const dest = (infNFe.dest ?? {}) as Record<string, unknown>;
    const total =
      ((infNFe.total as Record<string, unknown>)?.ICMSTot as Record<string, unknown>) ?? {};

    const modelo = String(ide.mod ?? '');
    const isNFCe = modelo === '65';

    return {
      tipo: isNFCe ? 'nfce' : 'nfe',
      chave_acesso_nfe: chave || null,
      metadata: {
        numero: String(ide.nNF ?? ''),
        serie: String(ide.serie ?? ''),
        cnpj_emitente: cleanCNPJ(String(emit.CNPJ ?? '')),
        razao_social_emitente: String(emit.xNome ?? ''),
        cnpj_destinatario: cleanCNPJ(String(dest.CNPJ ?? '')),
        razao_social_destinatario: String(dest.xNome ?? ''),
        data_emissao: String(ide.dhEmi ?? ide.dEmi ?? ''),
        valor: Number(total.vNF ?? 0) || undefined,
      },
      raw_root: rootKey,
    };
  }

  // CT-e
  if (lowerRoot === 'cteproc' || lowerRoot === 'cte') {
    const cteNode = (parsed[rootKey] as Record<string, unknown>)?.CTe ?? parsed[rootKey];
    const infCte = (cteNode as Record<string, unknown>)?.infCte as Record<string, unknown> | undefined;
    if (!infCte) {
      return { tipo: 'cte', chave_acesso_nfe: null, metadata: {}, raw_root: rootKey };
    }
    const chaveRaw = String(infCte['@_Id'] ?? '');
    const chave = chaveRaw.replace(/^CTe/, '');
    const ide = (infCte.ide ?? {}) as Record<string, unknown>;
    const emit = (infCte.emit ?? {}) as Record<string, unknown>;
    const dest = (infCte.dest ?? {}) as Record<string, unknown>;
    return {
      tipo: 'cte',
      chave_acesso_nfe: chave || null,
      metadata: {
        numero: String(ide.nCT ?? ''),
        cnpj_emitente: cleanCNPJ(String(emit.CNPJ ?? '')),
        razao_social_emitente: String(emit.xNome ?? ''),
        cnpj_destinatario: cleanCNPJ(String(dest.CNPJ ?? '')),
        data_emissao: String(ide.dhEmi ?? ''),
      },
      raw_root: rootKey,
    };
  }

  // NFSe — formato varia por município, heurística simples
  if (lowerRoot.includes('nfse') || str.toLowerCase().includes('<nfse')) {
    return {
      tipo: 'nfse',
      chave_acesso_nfe: null,
      metadata: {},
      raw_root: rootKey,
    };
  }

  return { tipo: null, chave_acesso_nfe: null, metadata: {}, raw_root: rootKey };
}
