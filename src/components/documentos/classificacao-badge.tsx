import { Badge } from '@/components/ui/badge';
import type { DocStatus, DocTipo } from '@/lib/types';

const STATUS_MAP: Record<DocStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  recebido: { label: 'Recebido', variant: 'outline' },
  classificando: { label: 'Classificando', variant: 'secondary' },
  classificado: { label: 'Classificado', variant: 'secondary' },
  duvida: { label: 'Com dúvida', variant: 'outline' },
  pronto_envio: { label: 'Pronto pra escriturar', variant: 'secondary' },
  enviando_dominio: { label: 'Enviando ao Domínio', variant: 'secondary' },
  escriturado: { label: 'Escriturado', variant: 'default' },
  duplicado: { label: 'Duplicado', variant: 'outline' },
  erro_dominio: { label: 'Erro Domínio', variant: 'destructive' },
  sem_envio: { label: 'Arquivado', variant: 'outline' },
};

const TIPO_LABEL: Record<DocTipo, string> = {
  nfe: 'NFe',
  nfse: 'NFSe',
  nfce: 'NFCe',
  cte: 'CT-e',
  comprovante: 'Comprovante',
  recibo: 'Recibo',
  contrato: 'Contrato',
  outro: 'Outro',
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const { label, variant } = STATUS_MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function TipoBadge({ tipo }: { tipo: DocTipo | null }) {
  if (!tipo) return null;
  return <Badge variant="outline">{TIPO_LABEL[tipo]}</Badge>;
}
