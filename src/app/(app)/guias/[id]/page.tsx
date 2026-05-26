import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileDown, Send } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuiaStatusBadge } from '@/components/guias/status-badge';
import {
  formatDateBR,
  formatCurrency,
  formatPhone,
  formatCompetencia,
  formatDateTimeBR,
} from '@/lib/format';
import { ReenviarPendentes } from './reenviar-pendentes';
import type {
  Guia,
  GuiaEnvio,
  ExternalClient,
  ExternalClientContact,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function GuiaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServiceClient();
  const { data: guia } = await sb.from('guias').select('*').eq('id', id).maybeSingle();
  if (!guia) notFound();
  const g = guia as Guia;

  const [{ data: envios }, { data: cliente }, { data: signed }] = await Promise.all([
    sb.from('guia_envios').select('*').eq('guia_id', g.id).order('created_at'),
    g.external_client_id
      ? sb.from('external_clients').select('id, razao_social, cnpj').eq('id', g.external_client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.storage.from('guias').createSignedUrl(g.storage_path, 3600),
  ]);

  const envioList = (envios ?? []) as GuiaEnvio[];
  const cl = cliente as Pick<ExternalClient, 'id' | 'razao_social' | 'cnpj'> | null;

  const contatoIds = Array.from(new Set(envioList.map((e) => e.contact_id)));
  const { data: contatos } = await sb
    .from('external_client_contacts')
    .select('id, nome, whatsapp')
    .in('id', contatoIds.length > 0 ? contatoIds : ['00000000-0000-0000-0000-000000000000']);

  const contatoMap = new Map(
    ((contatos ?? []) as Pick<ExternalClientContact, 'id' | 'nome' | 'whatsapp'>[]).map((c) => [
      c.id,
      c,
    ]),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/guias"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para fila
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {g.tipo} · {formatCompetencia(g.competencia)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cl?.razao_social ?? 'Cliente não identificado'} · Vencimento {formatDateBR(g.vencimento)}
          </p>
        </div>
        <div className="flex gap-2">
          <ReenviarPendentes guiaId={g.id} />
          <Button variant="outline" render={<a href={`/api/guias/${g.id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
            <FileDown className="h-4 w-4" />
            Exportar prova
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Timeline de envios</CardTitle>
          </CardHeader>
          <CardContent>
            {envioList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum envio configurado. Adicione contatos ao cliente que recebem guias.
              </p>
            ) : (
              <ul className="space-y-3">
                {envioList.map((e) => {
                  const c = contatoMap.get(e.contact_id);
                  return (
                    <li
                      key={e.id}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">
                            {c?.nome ?? '?'}
                            {e.numero_followup > 0 && (
                              <span className="ml-2 text-xs text-amber-600">
                                follow-up #{e.numero_followup}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPhone(c?.whatsapp ?? '')}
                          </div>
                        </div>
                        <GuiaStatusBadge status={e.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        {e.enviado_at && <div>Enviado: {formatDateTimeBR(e.enviado_at)}</div>}
                        {e.entregue_at && <div>Entregue: {formatDateTimeBR(e.entregue_at)}</div>}
                        {e.lido_at && <div>Lido: {formatDateTimeBR(e.lido_at)}</div>}
                        {e.respondido_at && <div>Respondido: {formatDateTimeBR(e.respondido_at)}</div>}
                      </div>
                      {e.erro_mensagem && (
                        <p className="text-xs text-destructive">{e.erro_mensagem}</p>
                      )}
                      {e.cancelado_motivo && (
                        <p className="text-xs text-muted-foreground italic">
                          Cancelado: {e.cancelado_motivo.replace('_', ' ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Tipo" value={g.tipo} />
              <Row label="Competência" value={formatCompetencia(g.competencia)} />
              <Row label="Vencimento" value={formatDateBR(g.vencimento)} />
              {g.valor && <Row label="Valor" value={formatCurrency(g.valor)} />}
              {g.cnpj_identificado && <Row label="CNPJ" value={g.cnpj_identificado} />}
            </CardContent>
          </Card>

          {signed?.signedUrl && (
            <Card>
              <CardHeader>
                <CardTitle>PDF da guia</CardTitle>
              </CardHeader>
              <CardContent>
                <Button render={<a href={signed.signedUrl} target="_blank" rel="noopener noreferrer" />} variant="outline">
                  <Send className="h-4 w-4" />
                  Abrir PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
