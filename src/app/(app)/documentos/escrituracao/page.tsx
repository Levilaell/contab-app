import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeBR } from '@/lib/format';
import { TriggerEscrituracaoButton } from './trigger-button';
import type { EscrituracaoBatch, ExternalClient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EscrituracaoPage() {
  const sb = createServiceClient();
  const { data: batches } = await sb
    .from('escrituracao_batches')
    .select('*')
    .order('iniciado_em', { ascending: false })
    .limit(50);

  const list = (batches ?? []) as EscrituracaoBatch[];

  const clientIds = Array.from(new Set(list.map((b) => b.external_client_id)));
  const { data: clientes } = await sb
    .from('external_clients')
    .select('id, razao_social')
    .in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000']);
  const clientMap = new Map<string, string>();
  ((clientes ?? []) as Pick<ExternalClient, 'id' | 'razao_social'>[]).forEach((c) =>
    clientMap.set(c.id, c.razao_social),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/documentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para DocFlow
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escrituração</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de lotes enviados para a API Domínio
          </p>
        </div>
        <TriggerEscrituracaoButton />
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum lote ainda. Quando documentos forem classificados como NFe/NFSe, eles entram na fila.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">
                    {clientMap.get(b.external_client_id) ?? 'Cliente desconhecido'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTimeBR(b.iniciado_em)}
                  </div>
                </div>
                <StatusBadge status={b.status} />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <Stat label="Total" value={b.total_documentos} />
                  <Stat label="Sucessos" value={b.sucessos} accent="emerald" />
                  <Stat label="Erros" value={b.erros} accent={b.erros > 0 ? 'red' : undefined} />
                  <Stat label="Duplicados" value={b.duplicados} />
                </div>
                {b.erro_mensagem && (
                  <p className="mt-3 text-xs text-destructive">{b.erro_mensagem}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EscrituracaoBatch['status'] }) {
  const map: Record<EscrituracaoBatch['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    preparando: { label: 'Preparando', variant: 'outline' },
    enviando: { label: 'Enviando', variant: 'secondary' },
    concluido: { label: 'Concluído', variant: 'default' },
    erro_total: { label: 'Erro', variant: 'destructive' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'emerald' | 'red';
}) {
  const cls =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'red'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
