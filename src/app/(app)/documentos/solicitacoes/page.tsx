import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTimeBR, formatCompetencia, formatPhone } from '@/lib/format';
import { TriggerButtons } from './trigger-buttons';
import type {
  SolicitacaoDocumento,
  SolicitacaoStatus,
  ExternalClient,
  ExternalClientContact,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SolicitacoesPage() {
  const sb = createServiceClient();
  const { data: solicitacoes } = await sb
    .from('solicitacoes_documentos')
    .select('*')
    .order('agendada_para', { ascending: false })
    .limit(200);

  const list = (solicitacoes ?? []) as SolicitacaoDocumento[];

  const clienteIds = Array.from(new Set(list.map((s) => s.external_client_id)));
  const contatoIds = Array.from(new Set(list.map((s) => s.contact_id)));
  const [clientesRes, contatosRes] = await Promise.all([
    sb
      .from('external_clients')
      .select('id, razao_social')
      .in('id', clienteIds.length > 0 ? clienteIds : ['00000000-0000-0000-0000-000000000000']),
    sb
      .from('external_client_contacts')
      .select('id, nome, whatsapp')
      .in('id', contatoIds.length > 0 ? contatoIds : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const clienteMap = new Map<string, string>();
  ((clientesRes.data ?? []) as Pick<ExternalClient, 'id' | 'razao_social'>[]).forEach((c) =>
    clienteMap.set(c.id, c.razao_social),
  );

  const contatoMap = new Map<string, Pick<ExternalClientContact, 'nome' | 'whatsapp'>>();
  ((contatosRes.data ?? []) as Pick<ExternalClientContact, 'id' | 'nome' | 'whatsapp'>[]).forEach(
    (c) => contatoMap.set(c.id, { nome: c.nome, whatsapp: c.whatsapp }),
  );

  const byStatus = (s: SolicitacaoStatus) => list.filter((x) => x.status === s);

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
          <h1 className="text-2xl font-semibold tracking-tight">Solicitações</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos automáticos de documentos enviados aos clientes
          </p>
        </div>
        <TriggerButtons />
      </div>

      <Tabs defaultValue="agendada">
        <TabsList>
          <TabsTrigger value="agendada">Agendadas ({byStatus('agendada').length})</TabsTrigger>
          <TabsTrigger value="enviada">Enviadas ({byStatus('enviada').length})</TabsTrigger>
          <TabsTrigger value="respondida">Respondidas ({byStatus('respondida').length})</TabsTrigger>
          <TabsTrigger value="erro">Erro ({byStatus('erro').length})</TabsTrigger>
        </TabsList>
        {(['agendada', 'enviada', 'respondida', 'erro'] as const).map((status) => (
          <TabsContent key={status} value={status}>
            <SolList
              items={byStatus(status)}
              clienteMap={clienteMap}
              contatoMap={contatoMap}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SolList({
  items,
  clienteMap,
  contatoMap,
}: {
  items: SolicitacaoDocumento[];
  clienteMap: Map<string, string>;
  contatoMap: Map<string, Pick<ExternalClientContact, 'nome' | 'whatsapp'>>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center mt-4">
        <p className="text-sm text-muted-foreground">Nenhuma solicitação neste status.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 mt-4">
      {items.map((s) => {
        const c = contatoMap.get(s.contact_id);
        return (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">
                  {clienteMap.get(s.external_client_id) ?? 'Cliente desconhecido'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Competência {formatCompetencia(s.competencia)}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Contato:</span>{' '}
                  {c?.nome ?? '?'} ({formatPhone(c?.whatsapp ?? '')})
                </div>
                <div>
                  <span className="text-muted-foreground">Agendada:</span>{' '}
                  {formatDateTimeBR(s.agendada_para)}
                </div>
                {s.enviada_at && (
                  <div>
                    <span className="text-muted-foreground">Enviada:</span>{' '}
                    {formatDateTimeBR(s.enviada_at)}
                  </div>
                )}
                {s.respondida_at && (
                  <div>
                    <span className="text-muted-foreground">Respondida:</span>{' '}
                    {formatDateTimeBR(s.respondida_at)}
                  </div>
                )}
                {s.documentos_recebidos_count > 0 && (
                  <div>
                    <span className="text-muted-foreground">Docs recebidos:</span>{' '}
                    {s.documentos_recebidos_count}
                  </div>
                )}
              </div>
              {s.erro_mensagem && (
                <p className="mt-2 text-xs text-destructive">{s.erro_mensagem}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: SolicitacaoStatus }) {
  const map: Record<SolicitacaoStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    agendada: { label: 'Agendada', variant: 'outline' },
    enviada: { label: 'Enviada', variant: 'secondary' },
    respondida: { label: 'Respondida', variant: 'default' },
    erro: { label: 'Erro', variant: 'destructive' },
    cancelada: { label: 'Cancelada', variant: 'outline' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
