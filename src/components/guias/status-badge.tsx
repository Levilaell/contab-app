import { Badge } from '@/components/ui/badge';
import type { GuiaEnvioStatus } from '@/lib/types';

const MAP: Record<GuiaEnvioStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  enviando: { label: 'Enviando', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'secondary' },
  entregue: { label: 'Entregue', variant: 'default' },
  lido: { label: 'Lido', variant: 'default' },
  erro: { label: 'Erro', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'outline' },
};

export function GuiaStatusBadge({ status }: { status: GuiaEnvioStatus }) {
  const { label, variant } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
