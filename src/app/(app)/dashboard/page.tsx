import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getStats() {
  const sb = createServiceClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    docsHoje,
    docsClassif,
    docsPronto,
    docsDuvida,
    docsErro,
    enviosMes,
    enviosLidos,
    enviosErro,
    clientesAtivos,
    iaUsage,
    waMes,
  ] = await Promise.all([
    sb.from('documentos').select('id', { count: 'exact', head: true })
      .gte('recebido_em', todayStart.toISOString()),
    sb.from('documentos').select('id', { count: 'exact', head: true })
      .in('status', ['recebido', 'classificando']),
    sb.from('documentos').select('id', { count: 'exact', head: true })
      .eq('status', 'pronto_envio'),
    sb.from('documentos').select('id', { count: 'exact', head: true })
      .eq('status', 'duvida'),
    sb.from('documentos').select('id', { count: 'exact', head: true })
      .eq('status', 'erro_dominio'),
    sb.from('guia_envios').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
    sb.from('guia_envios').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .in('status', ['lido', 'entregue']),
    sb.from('guia_envios').select('id', { count: 'exact', head: true })
      .eq('status', 'erro'),
    sb.from('external_clients').select('id', { count: 'exact', head: true })
      .eq('ativo', true),
    sb.from('ai_usage').select('custo_usd')
      .gte('created_at', monthStart.toISOString()),
    sb.from('bot_messages').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
  ]);

  const custoIA = ((iaUsage.data as { custo_usd: number | null }[] | null) || []).reduce(
    (acc, r) => acc + (Number(r.custo_usd) || 0),
    0,
  );

  return {
    docsHoje: docsHoje.count ?? 0,
    docsClassif: docsClassif.count ?? 0,
    docsPronto: docsPronto.count ?? 0,
    docsDuvida: docsDuvida.count ?? 0,
    docsErro: docsErro.count ?? 0,
    enviosMes: enviosMes.count ?? 0,
    enviosLidos: enviosLidos.count ?? 0,
    enviosErro: enviosErro.count ?? 0,
    clientesAtivos: clientesAtivos.count ?? 0,
    custoIA,
    waMes: waMes.count ?? 0,
  };
}

export default async function DashboardPage() {
  let s;
  try {
    s = await getStats();
  } catch {
    s = {
      docsHoje: 0, docsClassif: 0, docsPronto: 0, docsDuvida: 0, docsErro: 0,
      enviosMes: 0, enviosLidos: 0, enviosErro: 0,
      clientesAtivos: 0, custoIA: 0, waMes: 0,
    };
  }

  const engagementRate = s.enviosMes > 0
    ? Math.round((s.enviosLidos / s.enviosMes) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do escritório
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>DocFlow</CardTitle>
            <CardDescription>Documentos do mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Recebidos hoje" value={s.docsHoje} />
            <Row label="Em classificação" value={s.docsClassif} />
            <Row label="Pronto pra escrituração" value={s.docsPronto} />
            <Row label="Com dúvida" value={s.docsDuvida} accent={s.docsDuvida > 0} />
            <Row label="Erros Domínio" value={s.docsErro} accent={s.docsErro > 0} danger />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GuiaFlow</CardTitle>
            <CardDescription>Envios do mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Enviadas no mês" value={s.enviosMes} />
            <Row label="Engajamento" value={`${engagementRate}%`} />
            <Row label="Com erro" value={s.enviosErro} accent={s.enviosErro > 0} danger />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Geral</CardTitle>
            <CardDescription>Operação do escritório</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Clientes ativos" value={s.clientesAtivos} />
            <Row label="Custo IA mês" value={formatCurrency(s.custoIA * 5)} />
            <Row label="Mensagens WhatsApp" value={s.waMes} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          danger
            ? 'font-semibold text-destructive'
            : accent
              ? 'font-semibold text-foreground'
              : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  );
}
