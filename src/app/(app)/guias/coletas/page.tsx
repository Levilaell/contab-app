import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeBR, formatCompetencia } from '@/lib/format';
import { TriggerColetaButton } from './trigger-button';
import type { Coleta } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ColetasPage() {
  const sb = createServiceClient();
  const { data: coletas } = await sb
    .from('coletas')
    .select('*')
    .order('iniciada_em', { ascending: false })
    .limit(50);

  const list = (coletas ?? []) as Coleta[];

  return (
    <div className="space-y-6">
      <Link
        href="/guias"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para GuiaFlow
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coletas</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de varreduras da pasta do Domínio
          </p>
        </div>
        <TriggerColetaButton />
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma coleta ainda. O cron roda toda hora — você também pode rodar manualmente.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{formatCompetencia(c.competencia)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTimeBR(c.iniciada_em)} · origem {c.origem}
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <Stat label="Arquivos" value={c.total_arquivos_processados} />
                  <Stat label="Guias" value={c.total_guias_extraidas} />
                  <Stat label="Clientes" value={c.total_clientes_identificados} />
                  <Stat
                    label="Órfãs"
                    value={c.total_orfas}
                    accent={c.total_orfas > 0 ? 'amber' : undefined}
                  />
                </div>
                {c.erro_mensagem && (
                  <p className="mt-3 text-xs text-destructive">{c.erro_mensagem}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Coleta['status'] }) {
  const map: Record<Coleta['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    pendente: { label: 'Pendente', variant: 'outline' },
    executando: { label: 'Executando', variant: 'secondary' },
    concluida: { label: 'Concluída', variant: 'default' },
    erro: { label: 'Erro', variant: 'destructive' },
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
  accent?: 'amber';
}) {
  const cls = accent === 'amber' ? 'text-amber-600' : 'text-foreground';
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
